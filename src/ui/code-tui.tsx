import React, { useState, useCallback, useRef, useEffect } from 'react';
import { render, Box, Text, useInput, useApp, useAnimation, usePaste } from 'ink';
import { KobApiClient } from '../utils/api.js';
import { getConfig } from '../utils/config.js';
import { handleApiError } from '../utils/errors.js';
import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync, copyFileSync } from 'fs';
import { resolve, basename, join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { tmpdir, homedir } from 'os';
import { c } from './colors.js';
import { ModelPicker } from './model-picker.js';
import { ConfigForm } from './config-form.js';
import { readEnvFile, writeEnvFile, describeEnvPath } from '../utils/env-file.js';

// ============================================================================
// COLOR TOKENS (moved to ./colors.ts so sub-components can share)
// ============================================================================

function readVersion(): string {
    try {
        const here = dirname(fileURLToPath(import.meta.url));
        const pkg = JSON.parse(readFileSync(join(here, '..', '..', 'package.json'), 'utf-8'));
        return pkg.version || '0.0.0';
    } catch {
        return '0.0.0';
    }
}

// ============================================================================
// UTILITIES (unchanged logic)
// ============================================================================
function formatV2Model(provider: string, model?: string): string {
    const m = model || 'deepseek-chat';
    return m.includes('/') ? m : `${provider.toLowerCase()}/${m}`;
}

// Detect whether the model supports vision/images.
// Heuristic: any model name containing vision-related tokens OR
// the well-known multimodal families (claude-3, gpt-4o, gpt-4-vision, gemini, deepseek-vl, etc.)
export function modelSupportsVision(model: string): boolean {
    const m = model.toLowerCase();
    if (!m) return false;
    const visionTokens = [
        'vision', 'vl', 'gpt-4o', 'gpt-4-vision', 'gpt-4-turbo',
        'claude-3', 'claude-3.5', 'claude-3.7', 'claude-sonnet-4', 'claude-opus-4',
        'gemini', 'gemini-1.5', 'gemini-2',
        'llava', 'qwen-vl', 'pixtral', 'llama-3.2-vision',
        'v4-flash', 'flash',   // treat deepseek-v4-flash as multimodal
    ];
    return visionTokens.some(t => m.includes(t));
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.heic', '.heif']);
export function isImagePath(p: string): boolean {
    return IMAGE_EXTS.has(extname(p).toLowerCase());
}

export function kobImagesDir(): string {
    const dir = join(homedir(), '.kob-cli', 'images');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
}

// Save a local file path into our images dir and return the absolute path.
export function attachImagePath(srcPath: string): string {
    const abs = resolve(srcPath);
    if (!existsSync(abs)) throw new Error(`File not found: ${abs}`);
    if (!isImagePath(abs)) throw new Error(`Not an image: ${abs}`);
    const dest = join(kobImagesDir(), `pasted-${Date.now()}${extname(abs)}`);
    copyFileSync(abs, dest);
    return dest;
}

// Try to read an image from the system clipboard.
// Returns the absolute path of the saved file, or null if no image in clipboard.
// Best-effort: Windows via PowerShell, macOS via osascript, Linux via xclip.
export function pasteImageFromClipboard(): string | null {
    const platform = process.platform;
    try {
        if (platform === 'win32') {
            // PowerShell: read clipboard image, save to temp png
            const dest = join(kobImagesDir(), `clipboard-${Date.now()}.png`);
            const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$img = [System.Windows.Forms.Clipboard]::GetImage()
if ($img -eq $null) { exit 1 }
$img.Save('${dest.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "OK"
`;
            const out = execSync(`powershell -NoProfile -Command "${script.replace(/\n/g, '; ')}"`, { stdio: ['ignore', 'pipe', 'ignore'] });
            if (out.toString().includes('OK') && existsSync(dest)) return dest;
        } else if (platform === 'darwin') {
            const dest = join(kobImagesDir(), `clipboard-${Date.now()}.png`);
            execSync(`osascript -e 'set theFile to (open for access "${dest}" with write permission)
write (the clipboard as «class PNGf») to theFile
close access theFile'`, { stdio: 'ignore' });
            if (existsSync(dest) && statSync(dest).size > 0) return dest;
        } else {
            // Linux: xclip / wl-paste
            const dest = join(kobImagesDir(), `clipboard-${Date.now()}.png`);
            try {
                execSync(`xclip -selection clipboard -t image/png -o > "${dest}"`, { stdio: 'ignore', shell: '/bin/sh' });
            } catch {
                execSync(`wl-paste --type image/png > "${dest}"`, { stdio: 'ignore', shell: '/bin/sh' });
            }
            if (existsSync(dest) && statSync(dest).size > 0) return dest;
        }
    } catch { /* fall through */ }
    return null;
}

function countTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

export interface FileChange {
    filename: string;
    content: string;
    addLines: number;
    delLines: number;
}

export function writeFiles(files: FileChange[]): string[] {
    const created: string[] = [];
    for (const f of files) {
        if (!f.content) continue;
        const filePath = resolve(process.cwd(), f.filename);
        const dir = dirname(filePath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        const existed = existsSync(filePath);
        writeFileSync(filePath, f.content, 'utf-8');
        created.push(f.filename);
    }
    return created;
}

export function parseFileChanges(content: string): FileChange[] {
    const files: FileChange[] = [];
    const lines = content.split('\n');
    let currentFilename = '';
    let inCode = false;
    let collected: string[] = [];
    let lineCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] || '';
        const trimmed = line.trimStart();

        if (trimmed.startsWith('```')) {
            if (inCode) {
                if (currentFilename) {
                    files.push({ filename: currentFilename, content: collected.join('\n'), addLines: lineCount, delLines: 0 });
                }
                currentFilename = '';
                collected = [];
                lineCount = 0;
                inCode = false;
            } else {
                inCode = true;
                lineCount = 0;
                collected = [];
                const lang = trimmed.slice(3).trim();
                for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
                    const prev = (lines[j] || '').trim();
                    const fnMatch = prev.match(/(?:file|filepath|filename|create|edit|update|write):\s*([\w./\\@-]+)/i);
                    if (fnMatch && fnMatch[1]) { currentFilename = fnMatch[1]; break; }
                    const fnMatch2 = prev.match(/^([\w./\\@-]+\.[a-z]+)\s*$/i);
                    if (fnMatch2 && fnMatch2[1] && !prev.includes('```') && !prev.startsWith('#')) {
                        currentFilename = fnMatch2[1]; break;
                    }
                    const fnMatch3 = prev.match(/^[#/]+\s*([\w./\\@-]+\.[a-z]+)/i);
                    if (fnMatch3 && fnMatch3[1]) { currentFilename = fnMatch3[1]; break; }
                }
                if (!currentFilename) currentFilename = lang || 'file';
            }
            continue;
        }

        if (inCode) {
            if (lineCount < 3) {
                const codeFn = line.match(/(?:file|filepath|filename):\s*([\w./\\@-]+\.[a-z0-9]+)/i);
                if (codeFn && codeFn[1]) {
                    currentFilename = codeFn[1];
                }
            }
            collected.push(line);
            lineCount++;
        }
    }
    if (inCode && currentFilename && lineCount > 0) {
        files.push({ filename: currentFilename, content: collected.join('\n'), addLines: lineCount, delLines: 0 });
    }

    return files;
}

// ============================================================================
// SHELL COMMAND PARSING + EXECUTION
// ============================================================================
export interface CommandResult {
    cmd: string;
    ok: boolean;
    stdout: string;
    stderr: string;
    durationMs: number;
    exitCode: number;
}

const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', 'powershell', 'ps1', 'cmd', 'bat', 'console']);

export function parseShellCommands(content: string): string[] {
    const commands: string[] = [];
    const lines = content.split('\n');
    let inShellBlock = false;
    let collected: string[] = [];

    for (const line of lines) {
        const trimmed = line.trimStart();
        if (trimmed.startsWith('```')) {
            if (inShellBlock) {
                const cmd = collected.join('\n').trim();
                if (cmd) commands.push(cmd);
                inShellBlock = false;
                collected = [];
            } else {
                const lang = trimmed.slice(3).trim().toLowerCase().split(/[\s,]+/)[0] || '';
                if (SHELL_LANGS.has(lang)) {
                    inShellBlock = true;
                    collected = [];
                }
            }
            continue;
        }
        if (inShellBlock) {
            collected.push(line);
        }
    }
    if (inShellBlock) {
        const cmd = collected.join('\n').trim();
        if (cmd) commands.push(cmd);
    }
    return commands;
}

export function runShellCommand(cmd: string, cwd: string = process.cwd()): CommandResult {
    const t0 = Date.now();
    // Strip a leading "$ " or "❯ " prompt if the model wrote one
    const cleaned = cmd.split('\n').map(l => l.replace(/^\s*[\$❯]\s?/, '')).join('\n');
    try {
        const stdout = execSync(cleaned, {
            encoding: 'utf-8',
            timeout: 60_000,
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
        });
        return {
            cmd: cleaned,
            ok: true,
            stdout: (stdout || '').toString(),
            stderr: '',
            durationMs: Date.now() - t0,
            exitCode: 0,
        };
    } catch (err: any) {
        const e = err as any;
        return {
            cmd: cleaned,
            ok: false,
            stdout: e.stdout ? e.stdout.toString() : '',
            stderr: e.stderr ? e.stderr.toString() : (e.message || 'command failed'),
            durationMs: Date.now() - t0,
            exitCode: typeof e.status === 'number' ? e.status : 1,
        };
    }
}

function formatDuration(ms: number): string {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatNum(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return n.toString();
}

// ============================================================================
// MODE CONFIG — ask / plan / code
// ============================================================================
type Mode = 'ask' | 'plan' | 'code';

interface ModeInfo {
    key: Mode;
    label: string;
    icon: string;
    shortcut: string;
    color: string;
    description: string;
    placeholder: string;
    statusMessages: string[];
    systemPrompt: string;
    writesFiles: boolean;
}

const MODES: ModeInfo[] = [
    {
        key: 'ask',
        label: 'Ask',
        icon: '💡',
        shortcut: '1',
        color: c.blue,
        description: 'Just answer questions. No files written.',
        placeholder: 'Ask me anything...',
        statusMessages: ['Thinking...', 'Looking up information', 'Composing answer', 'Reviewing', 'Finalizing'],
        systemPrompt: 'You are a helpful AI assistant. Answer questions concisely and accurately. Use plain text with light markdown for clarity. Do not produce code blocks unless the user explicitly asks for code.',
        writesFiles: false,
    },
    {
        key: 'plan',
        label: 'Plan',
        icon: '◐',
        shortcut: '2',
        color: c.yellow,
        description: 'Plan first, then implement. Files only written after approval.',
        placeholder: 'Describe what you want to build...',
        statusMessages: ['Analyzing request', 'Researching approach', 'Drafting plan', 'Reviewing trade-offs', 'Finalizing plan'],
        systemPrompt: 'You are an expert software architect. When the user describes what to build, first present a clear implementation plan with bullet points covering: (1) files to create/modify, (2) key components and their responsibilities, (3) data flow, (4) any trade-offs. DO NOT write code yet. Wait for the user to confirm with "go" or similar, then in the next turn you may output code with proper filename comments like // filename: path/to/file.ext.',
        writesFiles: false,
    },
    {
        key: 'code',
        label: 'Code',
        icon: '◉',
        shortcut: '3',
        color: c.green,
        description: 'Write code, run commands. Fully autonomous — 128k context.',
        placeholder: 'What do you want to build?',
        statusMessages: ['Analyzing request', 'Designing architecture', 'Writing code', 'Installing dependencies', 'Running tests', 'Reviewing output', 'Finalizing'],
        systemPrompt: `You are an expert programmer working in a fully autonomous CLI agent. The user wants hands-off execution — they will not confirm anything.

OUTPUT FORMAT (strict):
- For each file: open a code block with a FILENAME COMMENT on the first line inside the block.
  Example: \`\`\`ts\n// filename: src/server.ts\n<code here>\n\`\`\`
  Accepted filename comment styles: \`// filename:\`, \`# filename:\`, \`<!-- filename:\` — pick the one that matches the file's language.
- For each shell command you want to run (install deps, run tests, start servers, etc.): open a code block with language "bash".
  Example: \`\`\`bash\nnpm install express\n\`\`\`
  These will be EXECUTED AUTOMATICALLY. Never ask for permission.
- Mix files and commands in any order. Do not write any other prose — only files, bash blocks, and one short summary line at the end.
- Keep going iteratively. If a command fails, fix the code and try again. Loop until the task is fully done.

IMPORTANT:
- You can run MANY rounds in one turn. The user has a 128k context window — use it.
- Never end with "let me know if you want me to..." — just complete the task.`,
        writesFiles: true,
    },
];

function getMode(key: Mode): ModeInfo {
    return MODES.find(m => m.key === key) || MODES[2]!;
}

// ============================================================================
// SHARED ATOMS
// ============================================================================
// PanelTitle and Field helpers were used by the old right-side panel that has
// been merged into the top BrandHeader. The header now renders the same info
// inline, so the helpers are intentionally gone.

// ============================================================================
// SLASH COMMANDS — shown as autocomplete when user types "/"
// ============================================================================
interface SlashCommand {
    name: string;
    desc: string;
    icon: string;
    group: 'mode' | 'session' | 'meta';
}
const SLASH_COMMANDS: SlashCommand[] = [
    { name: 'ask',     desc: 'switch to Ask mode (questions only)',    icon: '💡', group: 'mode' },
    { name: 'plan',    desc: 'switch to Plan mode (design first)',     icon: '○',  group: 'mode' },
    { name: 'code',    desc: 'switch to Code mode (full agent)',       icon: '●',  group: 'mode' },
    { name: 'clear',   desc: 'clear this session (forget history)',    icon: '⌫',  group: 'session' },
    { name: 'reset',   desc: 'reset model to the .env default',        icon: '↺',  group: 'session' },
    { name: 'models',  desc: 'pick a model from the catalog',          icon: '◆',  group: 'session' },
    { name: 'config',  desc: 'edit base_url, key, model → .env',       icon: '⚙',  group: 'meta' },
    { name: 'help',    desc: 'list every slash command',               icon: '?',  group: 'meta' },
    { name: 'exit',    desc: 'quit KOB CLI',                           icon: '⎋',  group: 'meta' },
];

// ============================================================================
// MODE SELECTOR — Tab/1/2/3 to switch
// ============================================================================
// Each mode button has a fixed visual width so the tab bar lines up
const MODE_BTN_WIDTH = 11;

function ModeButton({ m, isActive }: { m: ModeInfo; isActive: boolean }) {
    // Wrap in a fixed-width Box so columns line up
    return (
        <Box width={MODE_BTN_WIDTH} justifyContent="center">
            <Text
                color={isActive ? c.bg : c.textMuted}
                bold={isActive}
                backgroundColor={isActive ? m.color : undefined}
            >
                {' '}{m.icon} {m.label}{' '}
            </Text>
        </Box>
    );
}

function ModeSelector({ mode }: { mode: Mode }) {
    return (
        <Box>
            {MODES.map((m) => (
                <ModeButton key={m.key} m={m} isActive={m.key === mode} />
            ))}
        </Box>
    );
}

// ============================================================================
// BRAND HEADER — big logo + info bar + quick start (always at top)
// ============================================================================
type Phase = 'input' | 'generating';

function BrandHeader({
    phase,
    modelName,
    provider,
    version,
    session,
}: {
    phase: Phase;
    modelName: string;
    provider: string;
    version: string;
    session: {
        rounds: number;
        files: number;
        commands: number;
        elapsed: number;
        totalIn: number;
        totalOut: number;
    };
}) {
    const { frame } = useAnimation({ interval: 600 });
    const isThinking = phase === 'generating';
    const dotColor = isThinking ? c.yellow : c.green;
    const statusText = isThinking ? 'thinking' : 'ready';
    const statusIcon = isThinking ? '⟳' : '✓';

    const K = c.brand;     // cyan for KOB
    const C = c.pink;      // pink for CLI

    return (
        <Box flexDirection="column">
            {/* Big ASCII KOB CLI logo */}
            <Box flexDirection="column" alignItems="center">
                <Box>
                    <Text color={K}>██╗  ██╗ ██████╗ ██████╗    </Text>
                    <Text color={C}>██████╗██╗     ██╗</Text>
                </Box>
                <Box>
                    <Text color={K}>██║ ██╔╝██╔═══██╗██╔══██╗  </Text>
                    <Text color={C}>██╔════╝██║     ██║</Text>
                </Box>
                <Box>
                    <Text color={K}>█████╔╝ ██║   ██║██████╔╝  </Text>
                    <Text color={C}>██║     ██║     ██║</Text>
                </Box>
                <Box>
                    <Text color={K}>██╔═██╗ ██║   ██║██╔══██╗  </Text>
                    <Text color={C}>██║     ██║     ██║</Text>
                </Box>
                <Box>
                    <Text color={K}>██║  ██╗╚██████╔╝██████╔╝  </Text>
                    <Text color={C}>╚██████╗███████╗██║</Text>
                </Box>
                <Box>
                    <Text color={K}>╚═╝  ╚═╝ ╚═════╝ ╚═════╝   </Text>
                    <Text color={C}>╚═════╝╚══════╝╚═╝</Text>
                </Box>
            </Box>

            {/* Info bar with brand identity + live status */}
            <Box
                borderStyle="round"
                borderColor={c.brand}
                paddingX={1}
                flexDirection="column"
                marginTop={1}
            >
                <Box>
                    <Text color={c.text} bold>KOB CLI</Text>
                    <Text color={c.textDim}>  </Text>
                    <Text color={c.pink} italic>Thailand</Text>
                    <Text>  </Text>
                    <Text backgroundColor="red" color="red">▰▰</Text>
                    <Text> </Text>
                    <Text color="white" bold>▰</Text>
                    <Text> </Text>
                    <Text backgroundColor="blue" color="blue">▰▰</Text>
                    <Text color={c.textDim}>  ·  </Text>
                    <Text color={c.brand} bold>powered by</Text>
                    <Text>  </Text>
                    <Text color={c.green} bold>Tavon Seesenpila</Text>
                    <Text color={c.textDim}>  </Text>
                    <Text color={c.textMuted} italic>Founder of Kob AI</Text>
                </Box>

                {/* Row 2: version + model info */}
                <Box>
                    <Box>
                        <Text color={c.textDim}>v{version}  ·  AI Command-Line Interface</Text>
                    </Box>
                    <Box flexGrow={1} />
                    <Box>
                        <Text color={c.textDim}>model </Text>
                        <Text color={c.pink} bold>{modelName}</Text>
                        <Text color={c.textDim}>  ·  </Text>
                        <Text color={c.text}>{provider}</Text>
                        <Text color={c.textDim}>  ·  </Text>
                        <Text color={c.textMuted}>/v2/chat</Text>
                        <Text color={c.textDim}>  ·  </Text>
                        <Text color={c.green}>bearer</Text>
                        <Text color={c.textDim}>  ·  </Text>
                        {modelSupportsVision(modelName) ? (
                            <Text color={c.accent} bold>👁 vision</Text>
                        ) : (
                            <Text color={c.borderDim}>◌ text-only</Text>
                        )}
                        <Text color={c.textDim}>  ·  </Text>
                        <Text color={c.green}>stream ✓</Text>
                    </Box>
                </Box>

                {/* Row 3: session stats */}
                <Box>
                    <Box>
                        <Text color={c.textDim}>session  </Text>
                        <Text color={c.text}>{session.rounds}</Text>
                        <Text color={c.textDim}> rounds  ·  </Text>
                        <Text color={c.green}>{session.files}</Text>
                        <Text color={c.textDim}> files  ·  </Text>
                        <Text color={c.yellow}>{session.commands}</Text>
                        <Text color={c.textDim}> cmds  ·  </Text>
                        <Text color={c.yellow}>{formatDuration(session.elapsed)}</Text>
                    </Box>
                    <Box flexGrow={1} />
                    <Box>
                        <Text color={c.textDim}>ctx </Text>
                        <Text color={c.brand}>{formatNum(session.totalIn + session.totalOut)}</Text>
                        <Text color={c.textDim}>/{formatNum(131072)}</Text>
                        <Text color={c.textDim}>  ·  </Text>
                        <Text color={c.blue}>↓ {formatNum(session.totalIn)}</Text>
                        <Text color={c.textDim}>  </Text>
                        <Text color={c.pink}>↑ {formatNum(session.totalOut)}</Text>
                        <Text color={c.textDim}>  ·  </Text>
                        <Text color={dotColor}>{statusIcon} {statusText}</Text>
                    </Box>
                </Box>
            </Box>

            {/* Quick start REMOVED — user said it's redundant */}
        </Box>
    );
}

// ============================================================================
// LEFT PANEL — conversation history
// ============================================================================
interface Exchange {
    input: string;
    output: string;
    model: string;
    inTokens: number;
    outTokens: number;
    files: FileChange[];
    created: string[];
    commandResults: CommandResult[];
    durationMs: number;
    mode: Mode;
}

function ResponseBox({ content, modeColor, maxLines = 14 }: { content: string; modeColor: string; maxLines?: number }) {
    const MAX_CHARS = 4000;
    const wasCharTruncated = content.length > MAX_CHARS;
    let text = wasCharTruncated ? content.slice(0, MAX_CHARS) : content;
    const allLines = text.split('\n');
    const wasLineTruncated = allLines.length > maxLines;
    if (wasLineTruncated) {
        text = allLines.slice(0, maxLines).join('\n');
    }
    const finalLines = text.split('\n');

    return (
        <Box flexDirection="column" marginTop={1} marginLeft={2}>
            {finalLines.map((line, i) => (
                <Box key={i}>
                    {i === 0 ? (
                        <Text color={modeColor} bold>◀ </Text>
                    ) : (
                        <Text>{'  '}</Text>
                    )}
                    <Text color={c.text}>{line.length === 0 ? ' ' : line}</Text>
                </Box>
            ))}
            {(wasCharTruncated || wasLineTruncated) && (
                <Text color={c.textDim}>  … (truncated, full response: {content.length} chars / {allLines.length} lines)</Text>
            )}
        </Box>
    );
}

function CommandResultBox({ result }: { result: CommandResult }) {
    const MAX_OUT_CHARS = 1200;
    const MAX_OUT_LINES = 8;
    const out = (result.stdout || '') + (result.stderr ? '\n' + result.stderr : '');
    const trimmed = out.length > MAX_OUT_CHARS ? out.slice(0, MAX_OUT_CHARS) : out;
    const lines = trimmed.split('\n');
    const truncated = lines.length > MAX_OUT_LINES ? lines.slice(0, MAX_OUT_LINES) : lines;
    const statusColor = result.ok ? c.green : c.red;
    const statusIcon = result.ok ? '✓' : '✗';

    return (
        <Box flexDirection="column" borderStyle="single" borderColor={statusColor} paddingX={1} marginTop={1} marginLeft={2}>
            <Box>
                <Text color={statusColor} bold>{statusIcon} </Text>
                <Text color={c.textDim}>$ </Text>
                <Text color={c.text} bold>{result.cmd.length > 80 ? result.cmd.slice(0, 77) + '...' : result.cmd}</Text>
                <Text color={c.textDim}>  ·  </Text>
                <Text color={statusColor}>exit {result.exitCode}</Text>
                <Text color={c.textDim}>  ·  {formatDuration(result.durationMs)}</Text>
            </Box>
            {truncated.length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                    {truncated.map((line, i) => (
                        <Text key={i} color={c.textMuted}>{line.length === 0 ? ' ' : line}</Text>
                    ))}
                    {lines.length > MAX_OUT_LINES && (
                        <Text color={c.textDim}>  … ({lines.length - MAX_OUT_LINES} more lines)</Text>
                    )}
                </Box>
            )}
        </Box>
    );
}

function estimateRoundHeight(exc: Exchange, respMax: number): number {
    const totalResp = exc.output === '' ? 0 : exc.output.split('\n').length;
    const shownResp = Math.min(respMax, totalResp);
    const truncMarker = exc.output.trim().length > 0 && totalResp > respMax ? 1 : 0;
    const noRespLine = exc.output.trim().length === 0 ? 1 : 0;

    let h = 0;
    h += 1; // round header
    h += 1; // input line
    h += 1; // response top margin
    h += shownResp + truncMarker + noRespLine;

    if (exc.files.length > 0) h += 1 + exc.files.length;

    for (const r of exc.commandResults) {
        h += 1; // top margin
        h += 2; // top + bottom border
        h += 1; // header
        const out = (r.stdout || '') + (r.stderr ? '\n' + r.stderr : '');
        const outLines = Math.min(8, out.split('\n').length);
        h += outLines;
    }

    h += 1; // meta margin
    h += 1; // meta line
    h += 2; // blank + separator
    return h;
}

function getVisibleWindow(
    exchanges: Exchange[],
    maxHeight: number,
    scrollOffset: number,
    defaultRespMax: number
): { visible: Array<{ exc: Exchange; respMax: number; isFirst: boolean; isLast: boolean }>; hiddenAbove: number; hiddenBelow: number } {
    if (exchanges.length === 0 || maxHeight <= 0) {
        return { visible: [], hiddenAbove: 0, hiddenBelow: 0 };
    }

    const items = exchanges.map((exc) => ({
        exc,
        respMax: defaultRespMax,
        height: estimateRoundHeight(exc, defaultRespMax),
    }));
    const totalH = items.reduce((s, it) => s + it.height, 0);

    if (totalH <= maxHeight) {
        return {
            visible: items.map((it) => ({ exc: it.exc, respMax: it.respMax, isFirst: false, isLast: false })),
            hiddenAbove: 0,
            hiddenBelow: 0,
        };
    }

    // scrollOffset = lines hidden from top (0 = bottom-aligned)
    const maxScroll = totalH - maxHeight;
    const effOffset = Math.max(0, Math.min(scrollOffset, maxScroll));
    const startLine = totalH - maxHeight - effOffset;
    const endLine = startLine + maxHeight;

    const visible: Array<{ exc: Exchange; respMax: number; isFirst: boolean; isLast: boolean }> = [];
    let accum = 0;
    let isFirst = true;
    for (const it of items) {
        const itemStart = accum;
        const itemEnd = accum + it.height;
        accum = itemEnd;

        if (itemEnd <= startLine) continue; // fully above
        if (itemStart >= endLine) break;     // fully below

        const visTop = Math.max(0, startLine - itemStart);
        const visBot = Math.min(it.height, endLine - itemStart);

        if (visTop === 0 && visBot === it.height) {
            // fully visible
            visible.push({ exc: it.exc, respMax: it.respMax, isFirst, isLast: false });
        } else {
            // partially visible — slice response to fit
            const linesBefore = 3; // round header + input + response top margin
            const respTotal = it.exc.output.split('\n').length;
            const respTrunc = it.exc.output.trim().length > 0 && respTotal > it.respMax ? 1 : 0;
            const noResp = it.exc.output.trim().length === 0 ? 1 : 0;
            const respBlock = Math.min(it.respMax, respTotal) + respTrunc + noResp;
            const linesAfter = Math.max(0, it.height - linesBefore - respBlock);

            const available = visBot - visTop;
            const slicedRespMax = Math.max(0, available - linesBefore - linesAfter);
            visible.push({ exc: it.exc, respMax: slicedRespMax, isFirst, isLast: false });
        }
        isFirst = false;
    }

    return {
        visible,
        hiddenAbove: startLine,
        hiddenBelow: Math.max(0, totalH - endLine),
    };
}

function ConversationView({
    exchanges,
    maxHeight,
    scrollOffset,
    defaultRespMax,
}: {
    exchanges: Exchange[];
    maxHeight: number;
    scrollOffset: number;
    defaultRespMax: number;
}) {
    if (exchanges.length === 0) {
        return (
            <Box flexDirection="column" paddingX={1} paddingY={1}>
                <Text color={c.textDim}>No rounds yet.</Text>
                <Text color={c.textMuted}>  Ask the model to start generating code.</Text>
            </Box>
        );
    }

    const { visible, hiddenAbove, hiddenBelow } = getVisibleWindow(
        exchanges,
        maxHeight,
        scrollOffset,
        defaultRespMax
    );

    return (
        <Box flexDirection="column" paddingX={1} paddingY={1}>
            {hiddenAbove > 0 && (
                <Box>
                    <Text color={c.textDim}>  ↑ {hiddenAbove} line{hiddenAbove === 1 ? '' : 's'} above (PgUp to scroll)</Text>
                </Box>
            )}
            {visible.map((v, i) => {
                const m = getMode(v.exc.mode);
                const isLast = i === visible.length - 1;
                return (
                    <Box key={i} flexDirection="column" marginBottom={isLast ? 0 : 1}>
                        <Box>
                            <Text color={c.accent} bold>✦ Round {i + 1}</Text>
                            <Text color={c.textDim}>  ·  {formatDuration(v.exc.durationMs)}</Text>
                            <Text color={c.textDim}>  ·  </Text>
                            <Text color={m.color}>{m.icon} {m.label}</Text>
                        </Box>

                        {/* Input line */}
                        <Box marginTop={1} marginLeft={2}>
                            <Text color={c.textDim}>❯ </Text>
                            <Text color={c.text}>{v.exc.input.length > 70 ? v.exc.input.slice(0, 67) + '...' : v.exc.input}</Text>
                        </Box>

                        {/* Response content — the actual AI output */}
                        {v.exc.output.trim().length > 0 ? (
                            <ResponseBox content={v.exc.output} modeColor={m.color} maxLines={v.respMax} />
                        ) : (
                            <Box marginTop={1} marginLeft={2}>
                                <Text color={c.red}>✗ (no response received)</Text>
                            </Box>
                        )}

                        {/* Files written (code mode only) */}
                        {v.exc.files.length > 0 && (
                            <Box flexDirection="column" marginTop={1} marginLeft={2}>
                                {v.exc.files.map((f, j) => {
                                    const isCreated = v.exc.created.includes(f.filename);
                                    return (
                                        <Box key={j}>
                                            <Text color={isCreated ? c.green : c.yellow}>{isCreated ? '✓' : '●'}</Text>
                                            <Text>  </Text>
                                            <Text color={c.text} bold>{f.filename}</Text>
                                            <Text color={c.textDim}>  </Text>
                                            <Text color={c.green}>+{f.addLines}</Text>
                                            {f.delLines > 0 && (
                                                <>
                                                    <Text color={c.textDim}>  </Text>
                                                    <Text color={c.red}>-{f.delLines}</Text>
                                                </>
                                            )}
                                        </Box>
                                    );
                                })}
                            </Box>
                        )}

                        {/* Commands run (auto-executed bash blocks) */}
                        {v.exc.commandResults.length > 0 && (
                            <Box flexDirection="column">
                                {v.exc.commandResults.map((r, j) => (
                                    <CommandResultBox key={j} result={r} />
                                ))}
                            </Box>
                        )}

                        {/* Meta line */}
                        <Box marginTop={1} marginLeft={2}>
                            <Text color={c.textDim}>↳ </Text>
                            <Text color={c.textMuted}>{v.exc.output.length} chars</Text>
                            <Text color={c.textDim}>  ·  </Text>
                            <Text color={c.textMuted}>↓ {formatNum(v.exc.inTokens)} ↑ {formatNum(v.exc.outTokens)} tok</Text>
                            <Text color={c.textDim}>  ·  </Text>
                            <Text color={c.brand}>{v.exc.model}</Text>
                        </Box>

                        {!isLast && (
                            <Box marginTop={1}>
                                <Text color={c.borderDim}>{'─'.repeat(60)}</Text>
                            </Box>
                        )}
                    </Box>
                );
            })}
            {hiddenBelow > 0 && (
                <Box>
                    <Text color={c.textDim}>  ↓ {hiddenBelow} line{hiddenBelow === 1 ? '' : 's'} below (PgDn to scroll)</Text>
                </Box>
            )}
        </Box>
    );
}

function ConversationPanel({
    exchanges,
    maxHeight,
    scrollOffset,
    defaultRespMax,
    onScrollChange,
}: {
    exchanges: Exchange[];
    maxHeight: number;
    scrollOffset: number;
    defaultRespMax: number;
    onScrollChange: (newOffset: number) => void;
}) {
    const { hiddenAbove, hiddenBelow, totalScrollable } = getScrollStats(
        exchanges,
        maxHeight,
        defaultRespMax
    );

    // Detect mouse wheel on the panel (only when exchanges overflow)
    useInput((input, key) => {
        if (exchanges.length === 0 || totalScrollable <= 0) return;

        const STEP = 3;
        if (key.pageUp) {
            onScrollChange(Math.min(totalScrollable, scrollOffset + STEP));
        } else if (key.pageDown) {
            onScrollChange(Math.max(0, scrollOffset - STEP));
        } else if (input === 'g' && key.shift) {
            onScrollChange(totalScrollable);
        } else if (input === 'G') {
            onScrollChange(totalScrollable);
        } else if (input === 'g' && !key.shift) {
            onScrollChange(0);
        }
    }, { isActive: true });

    return (
        <Box
            flexDirection="column"
            flexGrow={1}
            borderStyle="round"
            borderColor={c.border}
        >
            <Box paddingX={1} borderStyle="single" borderColor={c.borderDim} borderTop={false} borderLeft={false} borderRight={false}>
                <Text color={c.brand} bold>◇ </Text>
                <Text color={c.text} bold>Conversation</Text>
                <Box flexGrow={1} />
                <Text color={c.textDim}>{exchanges.length} round{exchanges.length === 1 ? '' : 's'}</Text>
                {totalScrollable > 0 && (
                    <Text color={c.textDim}>
                        {'  '}↑ {hiddenAbove}/{hiddenAbove + hiddenBelow + maxHeight}
                    </Text>
                )}
            </Box>
            {exchanges.length === 0 ? (
                <WelcomeHero />
            ) : (
                <ConversationView
                    exchanges={exchanges}
                    maxHeight={maxHeight}
                    scrollOffset={scrollOffset}
                    defaultRespMax={defaultRespMax}
                />
            )}
        </Box>
    );
}

function getScrollStats(
    exchanges: Exchange[],
    maxHeight: number,
    defaultRespMax: number
): { hiddenAbove: number; hiddenBelow: number; totalScrollable: number } {
    if (exchanges.length === 0 || maxHeight <= 0) {
        return { hiddenAbove: 0, hiddenBelow: 0, totalScrollable: 0 };
    }
    const totalH = exchanges.reduce((s, e) => s + estimateRoundHeight(e, defaultRespMax), 0);
    if (totalH <= maxHeight) {
        return { hiddenAbove: 0, hiddenBelow: 0, totalScrollable: 0 };
    }
    return { hiddenAbove: 0, hiddenBelow: totalH - maxHeight, totalScrollable: totalH - maxHeight };
}

// ============================================================================
// WELCOME HERO — shown when no rounds yet
// ============================================================================
function WelcomeHero() {
    const { frame } = useAnimation({ interval: 1000 });
    const pulse = ['█', '▓', '▒', '░', '▒', '▓'];
    const wave = pulse[frame % pulse.length]!;

    return (
        <Box flexDirection="column" paddingX={1} paddingY={1}>
            {/* Big greeting line */}
            <Box>
                <Text color={c.brand} bold>{wave} </Text>
                <Text color={c.text} bold>Welcome to KOB Code Engine</Text>
            </Box>
            <Box marginTop={1}>
                <Text color={c.textMuted}>  Multi-turn code generation powered by AI.</Text>
            </Box>
            <Box>
                <Text color={c.textMuted}>  Choose a mode and start chatting. Switch any time with </Text>
                <Text color={c.pink}>Tab</Text>
                <Text color={c.textMuted}>.</Text>
            </Box>

            {/* Modes */}
            <Box marginTop={2}>
                <Text color={c.accent} bold>✦ Three modes</Text>
            </Box>
            <Box flexDirection="column" marginTop={1} marginLeft={2}>
                {MODES.map(m => (
                    <Box key={m.key}>
                        <Text color={m.color} bold>{m.icon} {m.label}</Text>
                        <Text color={c.textDim}>  [{m.shortcut}]  </Text>
                        <Text color={c.textMuted}>{m.description}</Text>
                    </Box>
                ))}
            </Box>

            {/* Try saying REMOVED */}

            {/* Tips */}
            <Box marginTop={2}>
                <Text color={c.yellow} bold>✦ Tips</Text>
            </Box>
            <Box flexDirection="column" marginTop={1} marginLeft={2}>
                <Box>
                    <Text color={c.borderAccent}>• </Text>
                    <Text color={c.textMuted}>Press </Text>
                    <Text color={c.pink}>Tab</Text>
                    <Text color={c.textMuted}> to cycle modes, or </Text>
                    <Text color={c.pink}>1</Text>
                    <Text color={c.textDim}>/</Text>
                    <Text color={c.pink}>2</Text>
                    <Text color={c.textDim}>/</Text>
                    <Text color={c.pink}>3</Text>
                    <Text color={c.textMuted}> to jump</Text>
                </Box>
                <Box>
                    <Text color={c.borderAccent}>• </Text>
                    <Text color={c.textMuted}>Mode can be changed any time between rounds</Text>
                </Box>
                <Box>
                    <Text color={c.borderAccent}>• </Text>
                    <Text color={c.textMuted}>Type </Text>
                    <Text color={c.pink}>/exit</Text>
                    <Text color={c.textMuted}> to quit, </Text>
                    <Text color={c.pink}>Esc</Text>
                    <Text color={c.textMuted}> to clear the input</Text>
                </Box>
            </Box>
        </Box>
    );
}

// ============================================================================
// GENERATING ANIMATION
// ============================================================================
const statusMessages = [
    'Analyzing request',
    'Designing architecture',
    'Writing code',
    'Optimizing implementation',
    'Reviewing output',
    'Finalizing',
];
const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const shimmerColors = [c.brand, c.green, c.accent, c.pink, c.yellow, c.accent, c.green, c.brand];
const stepInterval = 2500;

function GeneratingPanel({ messages, elapsed }: { messages: string[]; elapsed: number }) {
    const { frame } = useAnimation({ interval: 80 });
    const spinner = spinnerChars[frame % spinnerChars.length]!;
    const colorIdx = frame % shimmerColors.length;
    const currentStep = Math.min(Math.floor(elapsed / stepInterval), messages.length - 1);
    const timeStr = formatDuration(elapsed);

    return (
        <Box flexDirection="column" borderStyle="round" borderColor={c.yellow} marginTop={1}>
            <Box paddingX={1} borderStyle="single" borderColor={c.borderDim} borderTop={false} borderLeft={false} borderRight={false}>
                <Text color={c.yellow} bold>⟳ </Text>
                <Text color={c.text} bold>Generating</Text>
                <Box flexGrow={1} />
                <Text color={c.yellow}>{spinner} {timeStr}</Text>
            </Box>
            <Box flexDirection="column" paddingX={1} paddingY={1}>
                {messages.map((msg, i) => {
                    const isDone = i < currentStep;
                    const isActive = i === currentStep;
                    const isPending = i > currentStep;

                    let icon: string;
                    let iconColor: string;
                    let textColor: string;

                    if (isDone) {
                        icon = '✓';
                        iconColor = c.green;
                        textColor = c.textMuted;
                    } else if (isActive) {
                        icon = spinner;
                        iconColor = shimmerColors[colorIdx] || c.brand;
                        textColor = shimmerColors[(colorIdx + i * 3) % shimmerColors.length] || c.brand;
                    } else {
                        icon = '○';
                        iconColor = c.borderDim;
                        textColor = c.borderDim;
                    }

                    return (
                        <Box key={i}>
                            <Text color={iconColor}>{icon}  </Text>
                            <Text color={textColor}>{msg}</Text>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}

// ============================================================================
// INPUT BOX
// ============================================================================
interface InputAreaProps {
    onSubmit: (text: string, attachments: string[]) => void;
    mode: Mode;
    onModeChange: (m: Mode) => void;
    visionSupported: boolean;
    placeholder?: string;
    disabled?: boolean;
    /**
     * When false, this input ignores all keystrokes. Used to surrender
     * focus to overlays like the model picker or config form, so an
     * Enter inside the overlay doesn't simultaneously fire onSubmit here.
     */
    isActive?: boolean;
}

function InputBox({ onSubmit, mode, onModeChange, visionSupported, placeholder, disabled = false, isActive = true }: InputAreaProps) {
    const [value, setValue] = useState('');
    const [attachments, setAttachments] = useState<string[]>([]);
    const [pasteHint, setPasteHint] = useState<string | null>(null);
    const [slashIdx, setSlashIdx] = useState<number>(0);
    const { frame } = useAnimation({ interval: 500 });
    const cursorVisible = frame % 2 === 0;
    const modeInfo = getMode(mode);
    const ph = placeholder ?? modeInfo.placeholder;

    // Slash-command autocomplete: only show when the user typed "/" and
    // has not yet pressed space (which would mean they're past the command).
    const isSlashQuery = value.startsWith('/') && !/\s/.test(value);
    const slashQuery = value.slice(1).toLowerCase();
    const slashMatches = isSlashQuery
        ? SLASH_COMMANDS.filter((c) => c.name.toLowerCase().startsWith(slashQuery))
        : [];
    const slashOpen = isSlashQuery && slashMatches.length > 0;
    // Reset highlight whenever the filter set or query changes
    useEffect(() => { setSlashIdx(0); }, [value]);
    // Clamp highlight if matches shrink
    useEffect(() => {
        if (slashIdx >= slashMatches.length) setSlashIdx(0);
    }, [slashMatches.length, slashIdx]);

    // Ink-native text paste (handles multi-line pastes as a single insert).
    // This does NOT capture images — those arrive through Ctrl+V in useInput below.
    usePaste((text) => {
        if (disabled) return;
        if (!isActive) return;
        if (!text) return;
        // If the pasted text looks like a single image path, attach it instead of inserting
        const trimmed = text.trim();
        if (visionSupported && isImagePath(trimmed) && existsSync(resolve(trimmed))) {
            try {
                const dest = attachImagePath(trimmed);
                setAttachments(prev => [...prev, dest]);
                setPasteHint(`📎 ${basename(dest)}`);
                setTimeout(() => setPasteHint(null), 2500);
                return;
            } catch {/* fall through to text insert */}
        }
        setValue(prev => prev + text);
    });

    useInput((char, key) => {
        if (disabled) return;
        if (!isActive) return;
        if (key.ctrl && char === 'c') {
            process.stdout.write('\x1B[?25h');
            process.exit(0);
        }
        // Ctrl+V → try to read an image from the system clipboard
        if (key.ctrl && (char === 'v' || key.meta)) {
            if (!visionSupported) {
                setPasteHint('⚠ model does not support images');
                setTimeout(() => setPasteHint(null), 2500);
                return;
            }
            const path = pasteImageFromClipboard();
            if (path) {
                setAttachments(prev => [...prev, path]);
                setPasteHint(`📎 pasted ${basename(path)}`);
            } else {
                setPasteHint('⚠ no image in clipboard');
            }
            setTimeout(() => setPasteHint(null), 2500);
            return;
        }
        if (key.escape) {
            // ESC clears the input AND any attachments
            if (value.length > 0 || attachments.length > 0) {
                setValue('');
                setAttachments([]);
                return;
            }
            return;
        }
        // Tab: cycle modes UNLESS the slash popup is open (then it fills the highlighted command)
        if (key.tab) {
            if (slashOpen) {
                const cmd = slashMatches[slashIdx];
                if (cmd) setValue('/' + cmd.name + ' ');
                return;
            }
            const i = MODES.findIndex(m => m.key === mode);
            const next = MODES[(i + 1) % MODES.length]!;
            onModeChange(next.key);
            return;
        }
        if (!key.shift && (char === '1' || char === '2' || char === '3') && value.length === 0) {
            const target = MODES.find(m => m.shortcut === char);
            if (target) {
                onModeChange(target.key);
                return;
            }
        }
        if (key.upArrow) {
            if (slashOpen) {
                setSlashIdx((i) => (i - 1 + slashMatches.length) % slashMatches.length);
                return;
            }
            return;
        }
        if (key.downArrow) {
            if (slashOpen) {
                setSlashIdx((i) => (i + 1) % slashMatches.length);
                return;
            }
            return;
        }
        if (key.return) {
            const trimmed = value.trim();
            // If the popup is open, Enter fills the highlighted command (or executes it
            // if there's an exact match)
            if (slashOpen) {
                const cmd = slashMatches[slashIdx];
                if (cmd) {
                    if (cmd.name === slashQuery) {
                        // Exact match — execute immediately
                        onSubmit('/' + cmd.name, attachments);
                        setValue('');
                        setAttachments([]);
                    } else {
                        // Partial — fill in the rest, user can keep typing
                        setValue('/' + cmd.name + ' ');
                    }
                }
                return;
            }
            if (trimmed || attachments.length > 0) {
                if (trimmed === '/exit' || trimmed === '/quit') {
                    process.stdout.write('\x1B[?25h');
                    process.exit(0);
                }
                onSubmit(trimmed, attachments);
                setValue('');
                setAttachments([]);
            }
            return;
        }
        if (key.backspace || key.delete) {
            if (value.length > 0) {
                setValue(prev => prev.slice(0, -1));
            } else if (attachments.length > 0) {
                setAttachments(prev => prev.slice(0, -1));
            }
            return;
        }
        if (char && char.length === 1) {
            setValue(prev => prev + char);
        }
    }, { isActive });

    const isEmpty = value.length === 0 && attachments.length === 0;
    const borderColor = disabled ? c.borderDim : modeInfo.color;
    const showCursor = !disabled && isActive && cursorVisible;

    return (
        <Box flexDirection="column" borderStyle="round" borderColor={borderColor} marginTop={1}>
            <Box paddingX={1} borderStyle="single" borderColor={c.borderDim} borderTop={false} borderLeft={false} borderRight={false} justifyContent="space-between">
                <Box>
                    <Text color={modeInfo.color} bold>▶ </Text>
                    <Text color={c.text} bold>Input</Text>
                    <Text color={c.textDim}>  ·  </Text>
                    <ModeSelector mode={mode} />
                </Box>
                <Box>
                    <Text color={c.textDim}>{visionSupported ? '⌘V ' : ''}</Text>
                    <Text color={c.textMuted}>{visionSupported ? 'paste image' : 'text only'}</Text>
                    <Text color={c.borderDim}>  ·  </Text>
                    <Text color={c.textDim}>Tab </Text>
                    <Text color={c.textMuted}>switch</Text>
                </Box>
            </Box>

            {/* Attachment chips */}
            {attachments.length > 0 && (
                <Box paddingX={1} paddingTop={1} flexWrap="wrap">
                    {attachments.map((a, i) => (
                        <Box key={i} marginRight={1}>
                            <Text color={c.accent}>📎 </Text>
                            <Text color={c.text}>{basename(a)}</Text>
                            <Text color={c.textDim}>  </Text>
                        </Box>
                    ))}
                </Box>
            )}

            {/* Toast for paste feedback */}
            {pasteHint && (
                <Box paddingX={1}>
                    <Text color={c.yellow}>{pasteHint}</Text>
                </Box>
            )}

            <Box paddingX={1} paddingY={1}>
                <Text color={modeInfo.color}>❯ </Text>
                {isEmpty ? (
                    <>
                        <Text color={c.borderDim}>{ph}</Text>
                        {showCursor && <Text color={modeInfo.color}>{'▌'}</Text>}
                    </>
                ) : (
                    <>
                        <Text color={c.text}>{value}</Text>
                        {showCursor && <Text color={modeInfo.color}>{'▌'}</Text>}
                    </>
                )}
            </Box>

            {/* Slash-command autocomplete popup */}
            {slashOpen && (
                <Box
                    flexDirection="column"
                    borderStyle="single"
                    borderColor={c.borderAccent}
                    borderTop={true}
                    borderBottom={false}
                    borderLeft={false}
                    borderRight={false}
                    paddingX={1}
                    marginBottom={0}
                >
                    <Box>
                        <Text color={c.borderAccent} bold>◆ commands</Text>
                        <Text color={c.textDim}>  {slashMatches.length} match{slashMatches.length === 1 ? '' : 'es'}</Text>
                        <Box flexGrow={1} />
                        <Text color={c.textDim}>↑↓ move · ↵ fill · Tab fill · esc close</Text>
                    </Box>
                    {slashMatches.map((cmd, i) => {
                        const isSel = i === slashIdx;
                        const groupColor = cmd.group === 'mode' ? c.brand : cmd.group === 'session' ? c.green : c.accent;
                        return (
                            <Box key={cmd.name}>
                                <Text color={isSel ? c.brand : c.textDim}>{isSel ? '▶ ' : '  '}</Text>
                                <Text color={isSel ? c.text : c.text} bold={isSel}>
                                    /{cmd.name.padEnd(7)}
                                </Text>
                                <Text color={groupColor}>  {cmd.icon}</Text>
                                <Text color={c.textDim}>  {cmd.desc}</Text>
                            </Box>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
}

// ============================================================================
// BOTTOM BAR
// ============================================================================
function BottomBar({ phase, mode }: { phase: Phase; mode: Mode }) {
    const modeInfo = getMode(mode);
    return (
        <Box
            marginTop={1}
            borderStyle="round"
            borderColor={c.borderDim}
            paddingX={1}
            justifyContent="space-between"
        >
            <Box>
                <Text color={c.green}>⏎ </Text>
                <Text color={c.textDim}>submit</Text>
                <Text color={c.borderDim}>  ·  </Text>
                <Text color={c.yellow}>Esc</Text>
                <Text color={c.textDim}> clear</Text>
                <Text color={c.borderDim}>  ·  </Text>
                <Text color={c.pink}>Tab</Text>
                <Text color={c.textDim}> mode</Text>
                <Text color={c.borderDim}>  ·  </Text>
                <Text color={c.brand}>/models</Text>
                <Text color={c.textDim}> switch</Text>
                <Text color={c.borderDim}>  ·  </Text>
                <Text color={c.accent}>Ctrl+C</Text>
                <Text color={c.textDim}> quit</Text>
            </Box>
            <Box>
                <Text color={modeInfo.color}>{modeInfo.icon} {modeInfo.label} mode</Text>
                <Text color={c.borderDim}>  ·  </Text>
                <Text color={c.textDim}>{phase === 'generating' ? '⏳ streaming...' : '💤 idle'}</Text>
            </Box>
        </Box>
    );
}

// ============================================================================
// MAIN APP
// ============================================================================
export function runCodeTui(): Promise<void> {
    return new Promise((resolve) => {
        const { waitUntilExit } = render(<CodeEngine />, { exitOnCtrlC: false });
        waitUntilExit().then(() => resolve());
    });
}

function CodeEngine() {
    const [exchanges, setExchanges] = useState<Exchange[]>([]);
    const [phase, setPhase] = useState<Phase>('input');
    const [startMs, setStartMs] = useState<number>(0);
    const [now, setNow] = useState<number>(Date.now());
    const [mode, setMode] = useState<Mode>('code');
    const [scrollOffset, setScrollOffset] = useState<number>(0);
    const version = readVersion();
    const initialConfig = getConfig();
    const [model, setModel] = useState<string>(formatV2Model('DeepSeek', initialConfig.modelId));
    const [palette, setPalette] = useState<null | 'models'>(null);
    const [configOpen, setConfigOpen] = useState<boolean>(false);
    const [banner, setBanner] = useState<string | null>(null);
    const messagesRef = useRef<{ role: string; content: string }[]>([]);
    const modeRef = useRef<Mode>(mode);
    const exchangesLenRef = useRef<number>(0);
    const configRef = useRef(initialConfig);

    const showBanner = useCallback((msg: string, ms = 2200) => {
        setBanner(msg);
        setTimeout(() => setBanner((cur) => (cur === msg ? null : cur)), ms);
    }, []);

    // Live viewport height — listen to terminal resize events
    const [viewportRows, setViewportRows] = useState<number>(
        typeof process !== 'undefined' && process.stdout && process.stdout.rows
            ? process.stdout.rows
            : 30
    );
    useEffect(() => {
        const onResize = () => {
            const r = (process.stdout && process.stdout.rows) || 30;
            setViewportRows(r);
        };
        process.stdout.on('resize', onResize);
        return () => {
            process.stdout.off('resize', onResize);
        };
    }, []);

    // Keep ref in sync so async handleSubmit reads the latest mode
    useEffect(() => { modeRef.current = mode; }, [mode]);

    // Tick once per second to update the elapsed time in side panel
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    // Auto-scroll to bottom on each new round
    useEffect(() => {
        if (exchanges.length !== exchangesLenRef.current) {
            exchangesLenRef.current = exchanges.length;
            setScrollOffset(0);
        }
    }, [exchanges.length]);

    const totalIn = exchanges.reduce((s, e) => s + e.inTokens, 0);
    const totalOut = exchanges.reduce((s, e) => s + e.outTokens, 0);
    const totalFiles = exchanges.reduce((s, e) => s + e.created.length, 0);
    const totalCommands = exchanges.reduce((s, e) => s + e.commandResults.length, 0);
    const elapsed = phase === 'generating'
        ? now - startMs
        : (exchanges.length > 0 ? exchanges.reduce((s, e) => s + e.durationMs, 0) : 0);

    // Reserve rows for: brand header (~10), input area (~3), bottom bar (~1), margins/padding (~6)
    const RESERVED_ROWS = 22;
    const convMaxHeight = Math.max(8, viewportRows - RESERVED_ROWS);
    const DEFAULT_RESP_MAX = 14;

    // Dispatch a /slash command. Returns true if the input was a slash command
    // (and therefore should NOT be sent to the model).
    const handleSlashCommand = useCallback((raw: string): boolean => {
        const trimmed = raw.trim();
        if (!trimmed.startsWith('/')) return false;
        const body = trimmed.slice(1);
        const space = body.indexOf(' ');
        const name = (space === -1 ? body : body.slice(0, space)).toLowerCase();
        const arg = space === -1 ? '' : body.slice(space + 1).trim();

        switch (name) {
            case 'ask':
                setMode('ask');
                showBanner('◆ mode → Ask');
                return true;
            case 'plan':
                setMode('plan');
                showBanner('◆ mode → Plan');
                return true;
            case 'code':
                setMode('code');
                showBanner('◆ mode → Code');
                return true;
            case 'clear':
                setExchanges([]);
                messagesRef.current = [];
                exchangesLenRef.current = 0;
                showBanner('◆ session cleared');
                return true;
            case 'reset': {
                // Re-read the .env file to recover the original model id,
                // and re-snapshot the config so the rest of the app reverts.
                const envModelId = readEnvFile().KOB_MODEL_ID;
                const newModel = formatV2Model('DeepSeek', envModelId);
                setModel(newModel);
                if (envModelId) {
                    configRef.current = { ...configRef.current, modelId: envModelId };
                }
                setExchanges([]);
                messagesRef.current = [];
                exchangesLenRef.current = 0;
                showBanner(`◆ reset → model ${newModel}`);
                return true;
            }
            case 'models':
                setPalette('models');
                return true;
            case 'config':
                setConfigOpen(true);
                return true;
            case 'help':
            case '?':
                showBanner('◆ /ask /plan /code /clear /reset /models /config /help /exit');
                return true;
            case 'exit':
            case 'quit':
                process.stdout.write('\x1B[?25h');
                process.exit(0);
                return true;
            default:
                showBanner(`◆ unknown command: /${name}  (try /help)`);
                return true;
        }
    }, [showBanner]);

    const handleSubmit = useCallback(async (input: string, attachments: string[] = []) => {
        // Slash commands are intercepted before the model call
        if (input.startsWith('/')) {
            handleSlashCommand(input);
            return;
        }
        const t0 = Date.now();
        const currentMode = modeRef.current;
        const modeInfo = getMode(currentMode);
        setPhase('generating');
        setStartMs(t0);

        // If images are attached, include them as a clear hint in the user message
        // (proper multimodal sending would require extending the API client)
        const fullInput = attachments.length > 0
            ? `${input}\n\n[Attached images — paths saved for reference:]\n${attachments.map(a => `  - ${a}`).join('\n')}`
            : input;
        messagesRef.current.push({ role: 'user', content: fullInput });
        const inTokens = countTokens(fullInput);

        try {
            const client = new KobApiClient(configRef.current);

            let outTokens = 0;
            let fullContent = '';
            const usedModel = model; // capture the model that was active when streaming started

            for await (const chunk of client.chatStream(
                model,
                messagesRef.current,
                {
                    temperature: currentMode === 'code' ? 0.3 : 0.5,
                    max_tokens: 16384,         // 128k context, plenty of room for long output
                    system_prompt: modeInfo.systemPrompt,
                }
            )) {
                const delta = chunk.choices?.[0]?.delta?.content;
                if (delta) {
                    fullContent += delta;
                    outTokens += countTokens(delta);
                }
            }

            // After the response finishes, run files AND shell commands automatically
            // (no prompts, no confirmations — the user wants hands-off execution)
            const files = modeInfo.writesFiles ? parseFileChanges(fullContent) : [];
            const created = modeInfo.writesFiles ? writeFiles(files) : [];
            const shellCommands = currentMode === 'code' ? parseShellCommands(fullContent) : [];
            const commandResults: CommandResult[] = [];
            for (const cmd of shellCommands) {
                commandResults.push(runShellCommand(cmd));
            }

            // Build a follow-up assistant message that summarises the command outputs
            // so the model has full context of what happened in the next turn
            if (commandResults.length > 0) {
                const summary = commandResults.map(r => {
                    const out = (r.stdout || r.stderr || '(no output)').trim().slice(0, 1500);
                    return `[ran] $ ${r.cmd}\n[exit ${r.exitCode}, ${r.durationMs}ms]\n${out}`;
                }).join('\n\n');
                messagesRef.current.push({
                    role: 'assistant',
                    content: `Command execution results:\n\n${summary}`,
                });
            }

            messagesRef.current.push({ role: 'assistant', content: fullContent });
            setExchanges(prev => [...prev, {
                input,
                output: fullContent,
                model: usedModel,
                inTokens,
                outTokens,
                files,
                created,
                commandResults,
                mode: currentMode,
                durationMs: Date.now() - t0,
            }]);
            setPhase('input');
        } catch (error) {
            handleApiError(error);
            process.exit(1);
        }
    }, [model, handleSlashCommand]);

    return (
        <Box flexDirection="column" paddingX={1}>
            <BrandHeader
                phase={phase}
                modelName={model}
                provider="DeepSeek"
                version={version}
                session={{
                    rounds: exchanges.length,
                    files: totalFiles,
                    commands: totalCommands,
                    elapsed,
                    totalIn,
                    totalOut,
                }}
            />

            {banner && (
                <Box marginTop={1}>
                    <Text color={c.brand}>{banner}</Text>
                </Box>
            )}

            <Box flexDirection="column" marginTop={1} flexGrow={1}>
                <ConversationPanel
                    exchanges={exchanges}
                    maxHeight={convMaxHeight}
                    scrollOffset={scrollOffset}
                    defaultRespMax={DEFAULT_RESP_MAX}
                    onScrollChange={setScrollOffset}
                />
            </Box>

            {palette === 'models' && (
                <ModelPicker
                    onSelect={(modelId, displayName) => {
                        setModel(modelId);
                        configRef.current = { ...configRef.current, modelId };
                        setPalette(null);
                        setExchanges([]);
                        messagesRef.current = [];
                        exchangesLenRef.current = 0;
                        showBanner(`◆ model → ${displayName} (${modelId})`);
                    }}
                    onClose={() => setPalette(null)}
                    currentModel={model}
                />
            )}

            {configOpen && (
                <ConfigForm onDone={(saved) => {
                    setConfigOpen(false);
                    if (saved) {
                        // After saving, refresh our in-memory model from the new env
                        const env = readEnvFile();
                        if (env.KOB_MODEL_ID) {
                            setModel(formatV2Model('DeepSeek', env.KOB_MODEL_ID));
                            configRef.current = { ...configRef.current, modelId: env.KOB_MODEL_ID };
                        }
                    }
                }} />
            )}

            {phase === 'generating' ? (
                <GeneratingPanel messages={getMode(mode).statusMessages} elapsed={now - startMs} />
            ) : (
                <InputBox
                    onSubmit={handleSubmit}
                    mode={mode}
                    onModeChange={setMode}
                    visionSupported={modelSupportsVision(model)}
                    isActive={palette === null && !configOpen && phase === 'input'}
                />
            )}

            <BottomBar phase={phase} mode={mode} />
        </Box>
    );
}
