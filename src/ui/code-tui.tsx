import React, { useState, useCallback, useRef } from 'react';
import { render, Box, Text, useInput, useApp, useAnimation } from 'ink';
import { KobApiClient } from '../utils/api.js';
import { getConfig } from '../utils/config.js';
import { handleApiError } from '../utils/errors.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';

const brand = '#38bdf8';	
const accent = '#a78bfa';
const green = '#34d399';
const pink = '#f472b6';
const yellow = '#fbbf24';
const red = '#ef4444';
const gray = '#6b7280';

function formatV2Model(provider: string, model?: string): string {
    const m = model || 'deepseek-chat';
    return m.includes('/') ? m : `${provider.toLowerCase()}/${m}`;
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
                // Look for filename in lines before code block
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
            // Detect filename from first code lines (e.g. # filename: app.py)
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

const statusMessages = [
    'Analyzing request...',
    'Designing architecture...',
    'Writing code...',
    'Optimizing implementation...',
    'Reviewing output...',
    'Finalizing...',
];

interface InputAreaProps {
    onSubmit: (text: string) => void;
    placeholder?: string;
}

function InputArea({ onSubmit, placeholder = "What's next?" }: InputAreaProps) {
    const [value, setValue] = useState('');

    useInput((char, key) => {
        if (key.ctrl && char === 'c') {
            process.stdout.write('\x1B[?25h');
            process.exit(0);
        }
        if (key.return) {
            const trimmed = value.trim();
            if (trimmed) {
                if (trimmed === '/exit' || trimmed === '/quit') {
                    process.stdout.write('\x1B[?25h');
                    process.exit(0);
                }
                onSubmit(trimmed);
                setValue('');
            }
            return;
        }
        if (key.backspace || key.delete) {
            setValue(prev => prev.slice(0, -1));
            return;
        }
        if (char && char.length === 1) {
            setValue(prev => prev + char);
        }
    });

    return (
        <Box flexDirection="column" marginTop={1}>
            <Box>
                <Text color={accent}>{'  ┃  '}</Text>
                <Text color={gray}>{placeholder}</Text>
            </Box>
            <Box marginLeft={5}>
                <Text color="white">{value}</Text>
                <Text color={brand}>{'█'}</Text>
            </Box>
        </Box>
    );
}

const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const shimmerColors = ['#38bdf8', '#34d399', '#a78bfa', '#f472b6', '#fbbf24', '#a78bfa', '#34d399', '#38bdf8'];
const stepInterval = 2500;

function GeneratingAnimation({ messages, elapsed }: { messages: string[]; elapsed: number }) {
    const { frame } = useAnimation({ interval: 80 });

    const spinner = spinnerChars[frame % spinnerChars.length]!;
    const colorIdx = frame % shimmerColors.length;
    const secs = Math.floor(elapsed / 1000);
    const timeStr = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;

    const currentStep = Math.min(Math.floor(elapsed / stepInterval), messages.length - 1);

    return (
        <Box flexDirection="column" marginTop={1}>
            <Box>
                <Text color={gray}>{'  ╭'}{'─'.repeat(44)}{'╮'}</Text>
            </Box>
            {messages.map((msg, i) => {
                const isDone = i < currentStep;
                const isActive = i === currentStep;
                const isPending = i > currentStep;

                let icon = '○';
                let textColor = gray;
                let iconColor = gray;

                if (isDone) {
                    icon = '✅';
                    textColor = green;
                    iconColor = green;
                } else if (isActive) {
                    icon = spinner!;
                    textColor = shimmerColors[(colorIdx + i * 3) % shimmerColors.length]!;
                    iconColor = shimmerColors[colorIdx]!;
                }

                return (
                    <Box key={i}>
                        <Text color={gray}>{'  │'}</Text>
                        <Text>{'  '}</Text>
                        <Text color={iconColor}>{icon}</Text>
                        <Text>{'  '}</Text>
                        <Text color={textColor}>{msg}</Text>
                        <Text color={gray}>{'  │'}</Text>
                    </Box>
                );
            })}
            <Box>
                <Text color={gray}>{'  │'}</Text>
                <Text>{'  '}</Text>
                <Text color={gray}>{'⏱ '}{timeStr}</Text>
                <Text color={gray}>{'  │'}</Text>
            </Box>
            <Box>
                <Text color={gray}>{'  ╰'}{'─'.repeat(44)}{'╮'}</Text>
            </Box>
        </Box>
    );
}

interface FileChangesProps {
    files: FileChange[];
    created: string[];
}

function FileChanges({ files, created }: FileChangesProps) {
    if (files.length === 0) {
        return (
            <Box marginLeft={3} marginTop={1}>
                <Text color={gray}>No file changes detected</Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" marginTop={1}>
            {files.map((f, i) => {
                const isCreated = created.includes(f.filename);
                return (
                    <Box key={i} marginLeft={3}>
                        {isCreated ? (
                            <Text color={green}>{'✅ '}</Text>
                        ) : (
                            <Text color={yellow}>{'📄 '}</Text>
                        )}
                        <Text bold color={isCreated ? green : 'white'}>{f.filename}</Text>
                        <Text>{'  '}</Text>
                        <Text color={green}>{'+' + f.addLines}</Text>
                        {f.delLines > 0 && (
                            <>
                                <Text>{'  '}</Text>
                                <Text color={red}>{'-' + f.delLines}</Text>
                            </>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
}

interface UsageBarProps {
    model: string;
    inTokens: number;
    outTokens: number;
}

function UsageBar({ model, inTokens, outTokens }: UsageBarProps) {
    const total = inTokens + outTokens;
    return (
        <Box flexDirection="column" marginTop={1}>
            <Box>
                <Text color={gray}>{'  ╭'}{'─'.repeat(44)}{'╮'}</Text>
            </Box>
            <Box>
                <Text color={gray}>{'  │'}</Text>
                <Text>{'  '}</Text>
                <Text color={brand}>{'🤖 '}{model}</Text>
                <Text color={gray}>{'  │'}</Text>
            </Box>
            <Box>
                <Text color={gray}>{'  │'}</Text>
                <Text>{'  '}</Text>
                <Text color={gray}>{'📥 '}{inTokens}{' tok'}</Text>
                <Text>{'  ·  '}</Text>
                <Text color={gray}>{'📤 '}{outTokens}{' tok'}</Text>
                <Text>{'  ·  '}</Text>
                <Text color={gray}>{'📊 '}{total}{' tok'}</Text>
                <Text color={gray}>{'  │'}</Text>
            </Box>
            <Box>
                <Text color={gray}>{'  ╰'}{'─'.repeat(44)}{'╯'}</Text>
            </Box>
        </Box>
    );
}

interface Exchange {
    input: string;
    output: string;
    model: string;
    inTokens: number;
    outTokens: number;
    files: FileChange[];
    created: string[];
}

function ConversationView({ exchanges }: { exchanges: Exchange[] }) {
    return (
        <Box flexDirection="column">
            {exchanges.map((exc, i) => (
                <Box key={i} flexDirection="column" marginTop={1}>
                    <Box marginLeft={2} marginBottom={1}>
                        <Text color={accent}>{'✦  Round '}{i + 1}</Text>
                    </Box>
                    <FileChanges files={exc.files} created={exc.created} />
                    <UsageBar model={exc.model} inTokens={exc.inTokens} outTokens={exc.outTokens} />
                    {i < exchanges.length - 1 && (
                        <Box marginTop={1} marginLeft={2}>
                            <Text color={gray}>{'─'.repeat(44)}</Text>
                        </Box>
                    )}
                </Box>
            ))}
        </Box>
    );
}

export function runCodeTui(): Promise<void> {
    return new Promise((resolve) => {
        const { waitUntilExit } = render(<CodeEngine />, { exitOnCtrlC: false });
        waitUntilExit().then(() => resolve());
    });
}

function CodeEngine() {
    const [exchanges, setExchanges] = useState<Exchange[]>([]);
    const [phase, setPhase] = useState<'input' | 'generating'>('input');
    const [startMs, setStartMs] = useState(0);
    const model = formatV2Model('DeepSeek', getConfig().modelId);
    const messagesRef = useRef<{ role: string; content: string }[]>([]);

    const handleSubmit = useCallback(async (input: string) => {
        setPhase('generating');
        setStartMs(Date.now());

        messagesRef.current.push({ role: 'user', content: input });
        const inTokens = countTokens(input);

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            let outTokens = 0;
            let fullContent = '';
            let usedModel = model;

            const sysPrompt = 'You are an expert programmer. Generate clean, production-ready code. Always indicate the filename at the top of each code block with a comment like: // filename: path/to/file.ext or # filename: path/to/file.ext. Respond with code blocks only, keep explanations brief.';

            for await (const chunk of client.chatStream(
                model,
                messagesRef.current,
                { temperature: 0.3, max_tokens: 8192, system_prompt: sysPrompt }
            )) {
                const delta = chunk.choices?.[0]?.delta?.content;
                if (delta) {
                    fullContent += delta;
                    outTokens += countTokens(delta);
                }
                if (chunk.model) usedModel = chunk.model;
            }

            messagesRef.current.push({ role: 'assistant', content: fullContent });
            const files = parseFileChanges(fullContent);
            const created = writeFiles(files);

            setExchanges(prev => [...prev, {
                input,
                output: fullContent,
                model: usedModel,
                inTokens,
                outTokens,
                files,
                created,
            }]);
            setPhase('input');
        } catch (error) {
            handleApiError(error);
            process.exit(1);
        }
    }, [model]);

    return (
        <Box flexDirection="column" padding={1}>
            <Box flexDirection="column" marginBottom={1}>
                <Box>
                    <Text color={brand}>{'  ╭'}{'─'.repeat(44)}{'╮'}</Text>
                </Box>
                <Box>
                    <Text color={brand}>{'  │'}</Text>
                    <Text>{'    '}</Text>
                    <Text color={brand} bold>KOB</Text>
                    <Text color={gray}>{'  Code Engineer'}</Text>
                    <Text color={brand}>{'  │'}</Text>
                </Box>
                <Box>
                    <Text color={brand}>{'  │'}</Text>
                    <Text>{'    '}</Text>
                    <Text color={gray}>{'multi-turn code generation'}</Text>
                    <Text color={brand}>{'  │'}</Text>
                </Box>
                <Box>
                    <Text color={brand}>{'  ╰'}{'─'.repeat(44)}{'╯'}</Text>
                </Box>
            </Box>

            <ConversationView exchanges={exchanges} />

            {phase === 'generating' && (
                <GeneratingAnimation messages={statusMessages} elapsed={Date.now() - startMs} />
            )}

            {phase === 'input' && (
                <InputArea
                    onSubmit={handleSubmit}
                    placeholder={exchanges.length === 0 ? "What do you want to build?" : "What's next? (or /exit)"}
                />
            )}
        </Box>
    );
}
