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

export function kobHistoryDir(): string {
    const dir = join(homedir(), '.kob-cli', 'history');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
}

export function getHistoryFilePath(): string {
    const cwd = process.cwd();
    const slug = cwd.replace(/[\\/:\s]+/g, '_').slice(0, 120);
    return join(kobHistoryDir(), `${slug}.json`);
}

export function loadChatHistory(): {
    exchanges: Exchange[];
    messages: { role: string; content: string }[];
} {
    const path = getHistoryFilePath();
    if (!existsSync(path)) return { exchanges: [], messages: [] };
    try {
        const raw = readFileSync(path, 'utf-8');
        const data = JSON.parse(raw);
        if (data.exchanges && Array.isArray(data.exchanges)) {
            return {
                exchanges: data.exchanges,
                messages: data.messages || [],
            };
        }
    } catch { /* ignore corrupted history */ }
    return { exchanges: [], messages: [] };
}

export function saveChatHistory(
    exchanges: Exchange[],
    messages: { role: string; content: string }[]
): void {
    const path = getHistoryFilePath();
    try {
        writeFileSync(
            path,
            JSON.stringify({ exchanges, messages, savedAt: Date.now() }, null, 2),
            'utf-8'
        );
    } catch { /* ignore write errors */ }
}

export function clearChatHistory(): void {
    const path = getHistoryFilePath();
    try {
        if (existsSync(path)) writeFileSync(path, '{}', 'utf-8');
    } catch { /* ignore write errors */ }
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
    const dotColor = c.green;
    const statusText = 'ready';
    const statusIcon = '●';

    const K = c.brand;     // cyan for KOB
    const C = c.green;     // green for CLI

    return (
        <Box flexDirection="column" marginTop={2}>
            {/* Big ASCII KOB CLI logo */}
            <Box flexDirection="column" alignItems="center">
                <Box>
                    <Text color={c.blue}>██╗  ██╗ ██████╗ ██████╗    </Text>
                    <Text color={C}>██████╗██╗     ██╗</Text>
                </Box>
                <Box>
                    <Text color={c.blue}>██║ ██╔╝██╔═══██╗██╔══██╗  </Text>
                    <Text color={C}>██╔════╝██║     ██║</Text>
                </Box>
                <Box>
                    <Text color="white">█████╔╝ ██║   ██║██████╔╝  </Text>
                    <Text color={C}>██║     ██║     ██║</Text>
                </Box>
                <Box>
                    <Text color="white">██╔═██╗ ██║   ██║██╔══██╗  </Text>
                    <Text color={C}>██║     ██║     ██║</Text>
                </Box>
                <Box>
                    <Text color={c.red}>██║  ██╗╚██████╔╝██████╔╝  </Text>
                    <Text color={C}>╚██████╗███████╗██║</Text>
                </Box>
                <Box>
                    <Text color={c.red}>╚═╝  ╚═╝ ╚═════╝ ╚═════╝   </Text>
                    <Text color={C}>╚═════╝╚══════╝╚═╝</Text>
                </Box>
            </Box>

            {/* Tagline */}
            <Box justifyContent="center" marginTop={1}>
                <Text color={c.textMuted} italic>Made in Thailand</Text>
            </Box>

            {/* Info bar with brand identity + live status */}
            <Box
                borderStyle="single"
                borderTop={false}
                borderLeft={false}
                borderRight={false}
                borderColor={c.brand}
                paddingX={1}
                flexDirection="column"
                marginTop={1}
            >
                <Box>
                    <Box>
                        <Text color={c.text} bold>KOB CLI</Text>
                        <Text color={c.textDim}>  ·  </Text>
                        <Text color={c.green} bold>Tavon Seesenpila</Text>
                        <Text color={c.textDim}>  </Text>
                        <Text color={c.textMuted} italic>Founder of Kob AI</Text>
                    </Box>
                    <Box flexGrow={1} />
                    <Box>
                        <Text color={c.textDim}>v{version}</Text>
                    </Box>
                </Box>

                {/* Row 2: model info */}
                <Box>
                    <Box>
                        <Text color={c.textDim}>model </Text>
                        <Text color={c.pink} bold>{modelName}</Text>
                        <Text color={c.textDim}>  ·  </Text>
                        <Text color={c.text}>{provider}</Text>
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
                        <Text color={dotColor}>{statusIcon}</Text>
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

// ============================================================================
// LINE BUFFER — flat list of renderable lines, built once per render.
// This is what makes scrolling smooth: the buffer is a stable array of
// lines, and the viewport is just a slice. No re-slicing of responses, no
// re-computation of heights, no layout shift while you scroll.
// ============================================================================
const MAX_RESP_LINES = 14;
const MAX_CMD_CHARS = 1200;
const MAX_CMD_LINES = 8;

type LineItem =
    | { kind: 'header'; roundIdx: number; durationMs: number; modeIcon: string; modeLabel: string; modeColor: string }
    | { kind: 'input'; text: string }
    | { kind: 'response-line'; text: string; modeColor: string; isFirst: boolean }
    | { kind: 'response-trunc'; totalChars: number; totalLines: number }
    | { kind: 'no-response' }
    | { kind: 'code-block'; lang: string; lines: string[] }
    | { kind: 'file-line'; filename: string; add: number; del: number; created: boolean }
    | { kind: 'cmd-header'; cmd: string; ok: boolean; statusColor: string; exitCode: number; durationMs: number }
    | { kind: 'cmd-output'; text: string; statusColor: string }
    | { kind: 'cmd-trunc'; hidden: number; statusColor: string }
    | { kind: 'meta'; exc: Exchange }
    | { kind: 'separator' }
    | { kind: 'blank' };

function buildLineBuffer(exchanges: Exchange[]): LineItem[] {
    const buf: LineItem[] = [];
    exchanges.forEach((exc, i) => {
        const m = getMode(exc.mode);
        const isLast = i === exchanges.length - 1;

        // Round header
        buf.push({
            kind: 'header',
            roundIdx: i,
            durationMs: exc.durationMs,
            modeIcon: m.icon,
            modeLabel: m.label,
            modeColor: m.color,
        });

        // Input
        buf.push({ kind: 'input', text: exc.input });

        // Response (truncated ONCE here, at build time, so it never re-slices)
        if (exc.output.trim().length > 0) {
            const respLines = exc.output.split('\n');
            const total = respLines.length;
            const trunc = total > MAX_RESP_LINES;
            const shown = trunc ? respLines.slice(0, MAX_RESP_LINES) : respLines;

            let inCode = false;
            let codeBuf: string[] = [];
            let codeLang = '';

            const flushCode = () => {
                if (codeBuf.length > 0) {
                    buf.push({ kind: 'code-block', lang: codeLang, lines: codeBuf });
                    codeBuf = [];
                    codeLang = '';
                }
            };

            shown.forEach((line, j) => {
                const trimmed = line.trim();
                if (trimmed.startsWith('```')) {
                    if (inCode) {
                        flushCode();
                        inCode = false;
                    } else {
                        flushCode(); // flush any prose before code block
                        inCode = true;
                        codeLang = trimmed.slice(3).trim();
                    }
                    return;
                }
                if (inCode) {
                    codeBuf.push(line);
                } else {
                    buf.push({
                        kind: 'response-line',
                        text: line,
                        modeColor: m.color,
                        isFirst: j === 0,
                    });
                }
            });

            if (inCode) flushCode(); // response ended inside code block

            if (trunc) {
                buf.push({ kind: 'response-trunc', totalChars: exc.output.length, totalLines: total });
            }
        } else {
            buf.push({ kind: 'no-response' });
        }

        // Files
        exc.files.forEach((f) => {
            buf.push({
                kind: 'file-line',
                filename: f.filename,
                add: f.addLines,
                del: f.delLines,
                created: exc.created.includes(f.filename),
            });
        });

        // Commands
        exc.commandResults.forEach((r) => {
            const statusColor = r.ok ? c.green : c.red;
            buf.push({
                kind: 'cmd-header',
                cmd: r.cmd,
                ok: r.ok,
                statusColor,
                exitCode: r.exitCode,
                durationMs: r.durationMs,
            });
            const out = (r.stdout || '') + (r.stderr ? '\n' + r.stderr : '');
            const trimmed = out.length > MAX_CMD_CHARS ? out.slice(0, MAX_CMD_CHARS) : out;
            const lines = trimmed.split('\n');
            const outTrunc = lines.length > MAX_CMD_LINES;
            const shownLines = outTrunc ? lines.slice(0, MAX_CMD_LINES) : lines;
            shownLines.forEach((line) => {
                buf.push({ kind: 'cmd-output', text: line, statusColor });
            });
            if (outTrunc) {
                buf.push({ kind: 'cmd-trunc', hidden: lines.length - MAX_CMD_LINES, statusColor });
            }
        });

        // Meta
        buf.push({ kind: 'meta', exc });

        if (!isLast) {
            buf.push({ kind: 'blank' });
            buf.push({ kind: 'separator' });
            buf.push({ kind: 'blank' });
        }
    });
    return buf;
}

function renderLine(item: LineItem, idx: number): React.ReactNode {
    const key = `L${idx}-${item.kind}`;
    switch (item.kind) {
        case 'header':
            return (
                <Box key={key}>
                    <Text color={c.accent} bold>✦ Round {item.roundIdx + 1}</Text>
                    <Text color={c.textDim}>  ·  {formatDuration(item.durationMs)}</Text>
                    <Text color={c.textDim}>  ·  </Text>
                    <Text color={item.modeColor}>{item.modeIcon} {item.modeLabel}</Text>
                </Box>
            );
        case 'input':
            return (
                <Box key={key} marginLeft={2}>
                    <Text color={c.textDim}>❯ </Text>
                    <Text color={c.text}>{item.text.length > 70 ? item.text.slice(0, 67) + '...' : item.text}</Text>
                </Box>
            );
        case 'response-line':
            return (
                <Box key={key} marginLeft={2}>
                    {item.isFirst ? (
                        <Text color={item.modeColor} bold>◀ </Text>
                    ) : (
                        <Text>{'  '}</Text>
                    )}
                    <Text color={c.text}>{item.text.length === 0 ? ' ' : item.text}</Text>
                </Box>
            );
        case 'response-trunc':
            return (
                <Box key={key} marginLeft={2}>
                    <Text color={c.textDim}>  … (truncated, full response: {item.totalChars} chars / {item.totalLines} lines)</Text>
                </Box>
            );
        case 'no-response':
            return (
                <Box key={key} marginLeft={2}>
                    <Text color={c.red}>✗ (no response received)</Text>
                </Box>
            );
        case 'code-block':
            return (
                <Box key={key} marginLeft={2} marginTop={1} marginBottom={1}>
                    <Box
                        borderStyle="round"
                        borderColor={c.borderDim}
                        backgroundColor={c.panel}
                        paddingX={1}
                        paddingY={1}
                        flexDirection="column"
                    >
                        <Box>
                            <Text color={c.accent}>◆ {item.lang || 'code'}</Text>
                        </Box>
                        {item.lines.map((line, i) => (
                            <Box key={i}>
                                <Text color={c.green}>{line.length === 0 ? ' ' : line}</Text>
                            </Box>
                        ))}
                    </Box>
                </Box>
            );
        case 'file-line':
            return (
                <Box key={key} marginLeft={2}>
                    <Text color={item.created ? c.green : c.yellow}>{item.created ? '✓' : '●'}</Text>
                    <Text>  </Text>
                    <Text color={c.text} bold>{item.filename}</Text>
                    <Text color={c.textDim}>  </Text>
                    <Text color={c.green}>+{item.add}</Text>
                    {item.del > 0 && (
                        <>
                            <Text color={c.textDim}>  </Text>
                            <Text color={c.red}>-{item.del}</Text>
                        </>
                    )}
                </Box>
            );
        case 'cmd-header':
            return (
                <Box key={key} marginLeft={2} marginTop={1}>
                    <Text color={item.statusColor} bold>{item.ok ? '✓ ' : '✗ '}</Text>
                    <Text color={c.textDim}>$ </Text>
                    <Text color={c.text} bold>{item.cmd.length > 80 ? item.cmd.slice(0, 77) + '...' : item.cmd}</Text>
                    <Text color={c.textDim}>  ·  </Text>
                    <Text color={item.statusColor}>exit {item.exitCode}</Text>
                    <Text color={c.textDim}>  ·  {formatDuration(item.durationMs)}</Text>
                </Box>
            );
        case 'cmd-output':
            return (
                <Box key={key} marginLeft={4}>
                    <Text color={c.textMuted}>{item.text.length === 0 ? ' ' : item.text}</Text>
                </Box>
            );
        case 'cmd-trunc':
            return (
                <Box key={key} marginLeft={4}>
                    <Text color={c.textDim}>  … ({item.hidden} more lines)</Text>
                </Box>
            );
        case 'meta':
            return (
                <Box key={key} marginLeft={2} marginTop={1}>
                    <Text color={c.textDim}>↳ </Text>
                    <Text color={c.textMuted}>{item.exc.output.length} </Text>
                    <Text color={c.yellow}>chars</Text>
                    <Text color={c.textDim}>  ·  </Text>
                    <Text color={c.blue}>↓ {formatNum(item.exc.inTokens)}</Text>
                    <Text color={c.textDim}>  </Text>
                    <Text color={c.pink}>↑ {formatNum(item.exc.outTokens)} </Text>
                    <Text color={c.yellow}>tok</Text>
                    <Text color={c.textDim}>  ·  </Text>
                    <Text color={c.brand}>{item.exc.model}</Text>
                </Box>
            );
        case 'separator':
            return (
                <Box key={key}>
                    <Text color={c.borderDim}>{'─'.repeat(60)}</Text>
                </Box>
            );
        case 'blank':
            return <Box key={key}><Text> </Text></Box>;
    }
}

function ConversationView({
    exchanges,
    maxHeight,
    scrollOffset,
}: {
    exchanges: Exchange[];
    maxHeight: number;
    scrollOffset: number;
}) {
    if (exchanges.length === 0) return null;

    // Build the flat line buffer once per render. The buffer is the
    // single source of truth for layout heights — scroll position is
    // just an index into it, so the view never re-slices responses.
    const buffer = buildLineBuffer(exchanges);
    const totalH = buffer.length;

    // scrollOffset = lines hidden from the top of the buffer.
    // 0        → bottom of conversation (latest content)
    // max      → top of conversation (oldest content)
    const totalScrollable = Math.max(0, totalH - maxHeight);
    const effOffset = Math.max(0, Math.min(scrollOffset, totalScrollable));
    const startIdx = totalH - maxHeight - effOffset;
    const endIdx = Math.min(totalH, startIdx + maxHeight);
    const hiddenAbove = startIdx;
    const hiddenBelow = Math.max(0, totalH - endIdx);

    const window = buffer.slice(Math.max(0, startIdx), endIdx);

    return (
        // No border, no header — keep this area open and spacious.
        // The welcome / tips now live at the bottom of the screen.
        <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
            {hiddenAbove > 0 && (
                <Box>
                    <Text color={c.textDim}>  ↑ {hiddenAbove} line{hiddenAbove === 1 ? '' : 's'} above (↑/PgUp scroll)</Text>
                </Box>
            )}
            {window.map((item, i) => renderLine(item, startIdx + i))}
            {hiddenBelow > 0 && (
                <Box>
                    <Text color={c.textDim}>  ↓ {hiddenBelow} line{hiddenBelow === 1 ? '' : 's'} below (↓/PgDn scroll)</Text>
                </Box>
            )}
        </Box>
    );
}

function ConversationPanel({
    exchanges,
    maxHeight,
    scrollOffset,
    onScrollChange,
}: {
    exchanges: Exchange[];
    maxHeight: number;
    scrollOffset: number;
    onScrollChange: (newOffset: number) => void;
}) {
    // Build the same buffer to compute scroll bounds. We could lift the
    // buffer into CodeEngine and pass it down, but rebuilding it is cheap
    // (O(n) over the exchanges, which is small).
    const buffer = exchanges.length === 0 ? [] : buildLineBuffer(exchanges);
    const totalScrollable = Math.max(0, buffer.length - maxHeight);

    // Scroll input — handles both line-by-line (↑/↓) and page (PgUp/PgDn)
    // so users get smooth single-line motion AND big jumps when they want
    // to fly through long histories.
    useInput((input, key) => {
        if (totalScrollable <= 0) return;

        const PAGE_STEP = Math.max(2, maxHeight - 2);
        if (key.pageUp) {
            onScrollChange(Math.min(totalScrollable, scrollOffset + PAGE_STEP));
        } else if (key.pageDown) {
            onScrollChange(Math.max(0, scrollOffset - PAGE_STEP));
        } else if (key.upArrow) {
            onScrollChange(Math.min(totalScrollable, scrollOffset + 1));
        } else if (key.downArrow) {
            onScrollChange(Math.max(0, scrollOffset - 1));
        } else if (input === 'g' && !key.shift) {
            onScrollChange(totalScrollable); // top of buffer
        } else if (input === 'G' || (input === 'g' && key.shift)) {
            onScrollChange(0); // bottom of buffer (latest)
        }
    }, { isActive: true });

    return (
        // Borderless, headerless — the conversation flows freely so the
        // middle of the screen stays open and spacious. When there are
        // no rounds yet, we render nothing here; the welcome content
        // (modes + tips) lives at the bottom of the screen.
        <Box flexDirection="column" flexGrow={1}>
            {exchanges.length === 0 ? (
                <Box paddingX={1} paddingY={2}>
                    <Text color={c.textMuted}>  </Text>
                </Box>
            ) : (
                <ConversationView
                    exchanges={exchanges}
                    maxHeight={maxHeight}
                    scrollOffset={scrollOffset}
                />
            )}
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
        // Tab: fill highlighted slash command if popup is open
        if (key.tab && slashOpen) {
            const cmd = slashMatches[slashIdx];
            if (cmd) setValue('/' + cmd.name + ' ');
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
            {/* Attachment chips */}
            {attachments.length > 0 && (
                <Box paddingX={1} flexWrap="wrap">
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

            <Box paddingX={1}>
                {visionSupported && <Text color={c.green}>🖼️  </Text>}
                <Text color={modeInfo.color}>❯ </Text>
                {isEmpty ? (
                    <>
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
// HELP SCREEN — full-screen overlay shown by /help
// A self-contained beginner's manual. Closes on Esc, Enter, or q.
// ============================================================================
function HelpScreen({ onClose }: { onClose: () => void }) {
    useInput((input, key) => {
        if (key.escape || key.return || input === 'q') {
            onClose();
        }
    }, { isActive: true });

    return (
        <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={c.brand}
            paddingX={2}
            paddingY={1}
            marginTop={1}
        >
            {/* Header */}
            <Box>
                <Text color={c.brand} bold>? /help</Text>
                <Text color={c.textDim}>  </Text>
                <Text color={c.text} bold>KOB CLI · beginner's guide</Text>
                <Box flexGrow={1} />
                <Text color={c.textDim}>Esc / Enter / q to close</Text>
            </Box>

            {/* Getting started */}
            <Box marginTop={1} flexDirection="column">
                <Text color={c.accent} bold>◆ Getting started</Text>
                <Box marginLeft={2} flexDirection="column">
                    <Box>
                        <Text color={c.brand}>/config</Text>
                        <Text color={c.textMuted}>   set API key, model, base URL → </Text>
                        <Text color={c.text}>.env</Text>
                    </Box>
                    <Box>
                        <Text color={c.brand}>/models</Text>
                        <Text color={c.textMuted}>   pick a model from the catalog</Text>
                    </Box>
                    <Box>
                        <Text color={c.brand}>/help</Text>
                        <Text color={c.textMuted}>     show this guide</Text>
                    </Box>
                </Box>
            </Box>

            {/* Modes */}
            <Box marginTop={1} flexDirection="column">
                <Text color={c.accent} bold>◆ Modes (press </Text>
                <Text color={c.pink}>Tab</Text>
                <Text color={c.accent} bold> to cycle)</Text>
                <Box marginLeft={2} flexDirection="column">
                    {MODES.map((m) => (
                        <Box key={m.key}>
                            <Text color={m.color} bold>{m.icon} {m.label}</Text>
                            <Text color={c.textDim}>  [{m.shortcut}]   </Text>
                            <Text color={c.textMuted}>{m.description}</Text>
                        </Box>
                    ))}
                </Box>
            </Box>

            {/* While typing */}
            <Box marginTop={1} flexDirection="column">
                <Text color={c.accent} bold>◆ While typing</Text>
                <Box marginLeft={2} flexDirection="column">
                    <Box>
                        <Text color={c.yellow}>Esc</Text>
                        <Text color={c.textMuted}>        clear input</Text>
                    </Box>
                    <Box>
                        <Text color={c.green}>⏎</Text>
                        <Text color={c.textMuted}>          submit</Text>
                    </Box>
                    <Box>
                        <Text color={c.pink}>↑</Text>
                        <Text color={c.textMuted}> </Text>
                        <Text color={c.pink}>↓</Text>
                        <Text color={c.textMuted}>          scroll history (line by line)</Text>
                    </Box>
                    <Box>
                        <Text color={c.pink}>PgUp</Text>
                        <Text color={c.textMuted}> </Text>
                        <Text color={c.pink}>PgDn</Text>
                        <Text color={c.textMuted}>    scroll history (page)</Text>
                    </Box>
                    <Box>
                        <Text color={c.pink}>g</Text>
                        <Text color={c.textMuted}> </Text>
                        <Text color={c.pink}>G</Text>
                        <Text color={c.textMuted}>          jump to oldest / latest</Text>
                    </Box>
                </Box>
            </Box>

            {/* Session */}
            <Box marginTop={1} flexDirection="column">
                <Text color={c.accent} bold>◆ Session</Text>
                <Box marginLeft={2} flexDirection="column">
                    <Box>
                        <Text color={c.brand}>/clear</Text>
                        <Text color={c.textMuted}>     forget chat history</Text>
                    </Box>
                    <Box>
                        <Text color={c.brand}>/reset</Text>
                        <Text color={c.textMuted}>     reset model to .env default</Text>
                    </Box>
                    <Box>
                        <Text color={c.brand}>/exit</Text>
                        <Text color={c.textMuted}>      quit KOB CLI</Text>
                    </Box>
                </Box>
            </Box>

            {/* Tips */}
            <Box marginTop={1} flexDirection="column">
                <Text color={c.yellow} bold>◆ First time?</Text>
                <Box marginLeft={2} flexDirection="column">
                    <Text color={c.textMuted}>1. Run </Text>
                    <Text color={c.brand}>/config</Text>
                    <Text color={c.textMuted}> to paste your KOB API key and pick a model.</Text>
                    <Text color={c.textMuted}>2. Type a task, pick a mode with </Text>
                    <Text color={c.pink}>Tab</Text>
                    <Text color={c.textMuted}>, press </Text>
                    <Text color={c.green}>⏎</Text>
                    <Text color={c.textMuted}>.</Text>
                    <Text color={c.textMuted}>3. In </Text>
                    <Text color={c.green}>Code</Text>
                    <Text color={c.textMuted}> mode the agent can write files and run shell commands.</Text>
                </Box>
            </Box>
        </Box>
    );
}

// ============================================================================
// BOTTOM BAR
// ============================================================================
function BottomBar({ phase, mode, isFirstStart }: { phase: Phase; mode: Mode; isFirstStart: boolean }) {
    const modeInfo = getMode(mode);
    return (
        <Box
            borderStyle="round"
            borderColor={c.borderDim}
            paddingX={1}
            justifyContent="space-between"
        >
            <Box flexWrap="wrap">
                <Text color={c.green}>⏎ </Text>
                <Text color={c.textDim}>submit</Text>
                <Text color={c.borderDim}>  ·  </Text>
                <Text color={c.brand}>/models</Text>
                <Text color={c.textDim}> switch</Text>
                <Text color={c.borderDim}>  ·  </Text>
                <Text color={c.accent}>/config</Text>
                <Text color={c.textDim}> {isFirstStart ? 'for first start' : 'edit'}</Text>
                <Text color={c.borderDim}>  ·  </Text>
                <Text color={c.accent}>/help</Text>
                <Text color={c.textDim}> guide</Text>
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
    const [helpOpen, setHelpOpen] = useState<boolean>(false);
    const [banner, setBanner] = useState<string | null>(null);
    const messagesRef = useRef<{ role: string; content: string }[]>([]);
    const modeRef = useRef<Mode>(mode);
    const exchangesLenRef = useRef<number>(0);
    const configRef = useRef(initialConfig);

    // "First start" = no .env file at the project root. The user is running
    // KOB CLI for the very first time (or in a fresh clone), so we surface
    // the /config hint more prominently.
    const isFirstStart = (() => {
        try {
            const fs = require('fs') as typeof import('fs');
            const path = require('path') as typeof import('path');
            return !fs.existsSync(path.join(process.cwd(), '.env'));
        } catch {
            return false;
        }
    })();

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

    // Load chat history on mount
    useEffect(() => {
        const { exchanges: savedExchanges, messages: savedMessages } = loadChatHistory();
        if (savedExchanges.length > 0) {
            setExchanges(savedExchanges);
            messagesRef.current = savedMessages;
            exchangesLenRef.current = savedExchanges.length;
        }
    }, []);

    // Save chat history whenever exchanges change
    useEffect(() => {
        if (exchanges.length > 0) {
            saveChatHistory(exchanges, messagesRef.current);
        }
    }, [exchanges]);

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

    // Reserve rows for: brand header (~10), input area (~2), bottom bar (~1),
    // welcome footer when present (~5), and margins/padding (~3).
    const RESERVED_ROWS = 21;
    const convMaxHeight = Math.max(8, viewportRows - RESERVED_ROWS);

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
            case 'newchat':
            case 'clear':
                setExchanges([]);
                messagesRef.current = [];
                exchangesLenRef.current = 0;
                setScrollOffset(0);
                clearChatHistory();
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
                clearChatHistory();
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
                setHelpOpen(true);
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
                    onScrollChange={setScrollOffset}
                />
            </Box>

            {palette === 'models' && (
                <ModelPicker
                    onSelect={(modelId, displayName) => {
                        setModel(modelId);
                        configRef.current = { ...configRef.current, modelId };
                        setPalette(null);
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

            {helpOpen && <HelpScreen onClose={() => setHelpOpen(false)} />}

            {phase === 'generating' ? (
                <GeneratingPanel messages={getMode(mode).statusMessages} elapsed={now - startMs} />
            ) : (
                <InputBox
                    onSubmit={handleSubmit}
                    mode={mode}
                    onModeChange={setMode}
                    visionSupported={modelSupportsVision(model)}
                    isActive={palette === null && !configOpen && !helpOpen && phase === 'input'}
                />
            )}

            <BottomBar phase={phase} mode={mode} isFirstStart={isFirstStart} />

            <Box justifyContent="center">
                <Text color={c.textDim}>📁 {process.cwd()}</Text>
            </Box>
        </Box>
    );
}
