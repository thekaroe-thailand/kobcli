// ENGINE - the agentic conversation loop

import { KobApiClient } from './api.js';
import { getConfig } from './config.js';
import { getMode } from './modes.js';
import { loadHistory, saveHistory, clearHistory } from './history.js';
import { readEnvFile } from './env-file.js';
import type {
    Mode, Exchange, ChatMessage, FileChange, CommandResult, StrReplaceResult, ReadFileInfo, UndoEntry, CliConfig,
} from './types.js';
import {
    parseFileBlocks, parseToolCalls, parseShellCommands,
} from '../tools/parser.js';
import {
    writeFile, applyStrReplace, safeReadFile, generateFileTree, normalizeRelPath,
} from '../tools/files.js';
import { runShellCommand, isReadonly, isDangerous, skippedResult } from '../tools/shell.js';

export interface EngineState {
    exchanges: Exchange[];
    messages: ChatMessage[];
    mode: Mode;
    model: string;
}

export type ApproveKind = 'readonly' | 'mutating' | 'dangerous';

export interface SubmitHooks {
    onProgress?: (label: string) => void;
    onToken?: (delta: string) => void;
    onRoundStart?: (round: number) => void;
    approveCommand?: (cmd: string, kind: ApproveKind) => Promise<boolean>;
    onFileChange?: (fc: FileChange) => void;
    onStrReplace?: (r: StrReplaceResult) => void;
    onCommand?: (r: CommandResult) => void;
    onReadFile?: (info: ReadFileInfo) => void;
    signal?: AbortSignal;
}

export function formatModel(model?: string): string {
    const m = model || 'deepseek/deepseek-chat';
    return m.includes('/') ? m : `deepseek/${m}`;
}

export function createInitialState(cfg: CliConfig): EngineState {
    const saved = loadHistory();
    const model = cfg.modelId ? formatModel(cfg.modelId) : 'deepseek/deepseek-coder';
    return {
        exchanges: saved.exchanges,
        messages: saved.messages,
        mode: 'code',
        model,
    };
}

export const CONTEXT_WINDOWS: Record<string, number> = {
    'deepseek/deepseek-chat': 64000,
    'deepseek/deepseek-coder': 128000,
    'deepseek/deepseek-v4-flash': 128000,
    'openai/gpt-4o': 128000,
    'openai/gpt-4-turbo': 128000,
    'openai/gpt-3.5-turbo': 16385,
    'anthropic/claude-3-opus': 200000,
    'anthropic/claude-3-sonnet': 200000,
    'anthropic/claude-3-haiku': 200000,
    'google/gemini-1.5-pro': 1048576,
};

export function getContextWindow(model: string): number {
    return CONTEXT_WINDOWS[model] || 128000;
}

export function countTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

export function contextUsage(messages: ChatMessage[]): number {
    return messages.reduce((s, m) => s + countTokens(m.content), 0);
}

const MAX_ROUNDS = 20;

export async function handleSubmit(
    state: EngineState,
    input: string,
    hooks: SubmitHooks = {},
): Promise<{ state: EngineState; error?: string; undo: UndoEntry[] }> {
    const t0 = Date.now();
    const modeInfo = getMode(state.mode);
    const cfg = getConfig({ quiet: true });
    if (!cfg) return { state, error: 'Missing configuration. Run /config.', undo: [] };

    const cwd = process.cwd();
    const messages: ChatMessage[] = [...state.messages, { role: 'user', content: input }];
    const inTokens = countTokens(input);

    let systemPrompt = modeInfo.systemPrompt;
    if (state.mode === 'code' || state.mode === 'ask' || state.mode === 'plan') {
        const tree = generateFileTree(cwd);
        systemPrompt += `\n\n<working_directory>${cwd}</working_directory>\n\n<file_tree>\n${tree}\n</file_tree>\n\nUse exact paths from <file_tree>. Do not run find/grep/ls to locate files.`;
    }

    const client = new KobApiClient(cfg);
    const undo: UndoEntry[] = [];
    const allFiles: FileChange[] = [];
    const allCreated: string[] = [];
    const allCmd: CommandResult[] = [];
    const allReplace: StrReplaceResult[] = [];
    const allRead: ReadFileInfo[] = [];
    let outTokens = 0;
    let lastContent = '';
    let nudgeCount = 0;
    const MAX_NUDGES = 4;

    try {
        for (let round = 0; round < MAX_ROUNDS; round++) {
            hooks.onRoundStart?.(round);
            const label = modeInfo.statusMessages[Math.min(round, modeInfo.statusMessages.length - 1)] || 'Working';
            hooks.onProgress?.(label);

            let content = '';
            const streamLive = state.mode !== 'code';
            
            // Regex to match an incomplete tool block or fenced code block at the end of the stream
            const toolRe = /<tool:(str_replace|write_file|read_file)>[\s\S]*?(?:<path>\s*(.*?)\s*<\/path>)?([\s\S]*)$/;
            const codeBlockRe = /```[a-z]*[\s:]([\w./\\-]+)\s*\n([\s\S]*)$/i;

            try {
                for await (const chunk of client.chatStream(state.model, messages, {
                    temperature: state.mode === 'code' ? 0.1 : 0.5,
                    max_tokens: cfg.maxTokens,
                    system_prompt: systemPrompt,
                    signal: hooks.signal,
                    reasoning: cfg.enableThinking,
                })) {
                    const delta = chunk.choices?.[0]?.delta?.content;
                    if (delta) {
                        content += delta;
                        outTokens += countTokens(delta);
                        if (streamLive) {
                            hooks.onToken?.(delta);
                        } else {
                            // Live update the spinner with line counts during Code mode
                            const toolMatch = content.match(toolRe);
                            if (toolMatch) {
                                const toolName = toolMatch[1];
                                const path = toolMatch[2] || '...';
                                if (toolName === 'read_file') {
                                    hooks.onProgress?.(`Reading ${path}`);
                                } else {
                                    const lines = (toolMatch[3] || '').split('\n').length;
                                    const action = toolName === 'str_replace' ? 'Editing' : 'Writing';
                                    hooks.onProgress?.(`${action} ${path} (+${lines})`);
                                }
                            } else {
                                const blockMatch = content.match(codeBlockRe);
                                if (blockMatch) {
                                    const path = blockMatch[1] || '...';
                                    const lines = (blockMatch[2] || '').split('\n').length;
                                    hooks.onProgress?.(`Writing ${path} (+${lines})`);
                                } else {
                                    hooks.onProgress?.(label);
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                if (msg.includes('aborted') || msg.includes('abort')) {
                    return finalize(state, input, lastContent || content, { allFiles, allCreated, allCmd, allReplace, allRead, inTokens, outTokens, t0, messages, undo }, 'Interrupted.');
                }
                return { state, error: redact(msg), undo };
            }

            lastContent = content;
            messages.push({ role: 'assistant', content });

            // Non-mutating modes: one round, done.
            if (!modeInfo.canMutate && state.mode !== 'ask' && state.mode !== 'plan') break;

            // ── execute tools ──────────────────────────────
            const toolResults: string[] = [];

            const calls = parseToolCalls(content);
            for (const call of calls) {
                const rel = normalizeRelPath(call.path);
                if (call.kind === 'read_file') {
                    const data = safeReadFile(rel, cwd);
                    const lines = data.split('\n').length;
                    allRead.push({ path: rel, lines });
                    hooks.onReadFile?.({ path: rel, lines });
                    toolResults.push(`<tool_result:read_file path="${rel}">\n${data}\n</tool_result:read_file>`);
                } else if (call.kind === 'str_replace' && modeInfo.canMutate) {
                    const r = applyStrReplace(rel, call.oldStr!, call.newStr!, cwd);
                    allReplace.push(r);
                    if (r.ok && r.previous !== undefined) undo.push({ path: r.path, previous: r.previous });
                    hooks.onStrReplace?.(r);
                    toolResults.push(r.ok
                        ? `<tool_result:str_replace path="${rel}">OK +${r.addLines} -${r.delLines}</tool_result:str_replace>`
                        : `<tool_result:str_replace path="${rel}">ERROR: ${r.error}</tool_result:str_replace>`);
                } else if (call.kind === 'write_file' && modeInfo.canMutate) {
                    const fc = writeFile(rel, call.content || '', cwd);
                    allFiles.push(fc);
                    if (fc.existed) allCreated.push(fc.filename);
                    undo.push({ path: fc.filename, previous: fc.existed ? (fc.previous ?? '') : null });
                    hooks.onFileChange?.(fc);
                    toolResults.push(`<tool_result:write_file path="${rel}">OK (${fc.content.split('\n').length} lines)</tool_result:write_file>`);
                }
            }

            // fenced file blocks (code mode only)
            if (modeInfo.canMutate) {
                for (const block of parseFileBlocks(content)) {
                    const fc = writeFile(block.filename, block.content, cwd);
                    allFiles.push(fc);
                    allCreated.push(fc.filename);
                    undo.push({ path: fc.filename, previous: fc.existed ? (fc.previous ?? '') : null });
                    hooks.onFileChange?.(fc);
                }
            }

            // shell commands (code mode only)
            if (modeInfo.canMutate) {
                for (const cmd of parseShellCommands(content)) {
                    const kind: ApproveKind = isDangerous(cmd) ? 'dangerous' : isReadonly(cmd) ? 'readonly' : 'mutating';
                    let approved = true;
                    if (kind === 'readonly' && cfg.autoApproveReadonly) {
                        approved = true;
                    } else if (hooks.approveCommand) {
                        approved = await hooks.approveCommand(cmd, kind);
                    }
                    if (!approved) {
                        const sk = skippedResult(cmd);
                        allCmd.push(sk);
                        hooks.onCommand?.(sk);
                        toolResults.push(`<tool_result:run_command cmd="${cmd}">SKIPPED by user</tool_result:run_command>`);
                        continue;
                    }
                    const r = runShellCommand(cmd, cwd);
                    allCmd.push(r);
                    hooks.onCommand?.(r);
                    const out = (r.stdout || r.stderr || '(no output)').trim().slice(0, 3000);
                    toolResults.push(`<tool_result:run_command cmd="${cmd}" exit="${r.exitCode}">\n${out}\n</tool_result:run_command>`);
                }
            }

            // Nothing executed. In code mode, if the model only talked and made
            // no changes at all, nudge it up to MAX_NUDGES times to actually emit a tool call.
            if (toolResults.length === 0) {
                const nothingDone = allFiles.length === 0 && allReplace.length === 0 && allCmd.length === 0;
                if (modeInfo.canMutate && nudgeCount < MAX_NUDGES && nothingDone) {
                    nudgeCount++;
                    hooks.onProgress?.('Asking the model to apply the edit');
                    
                    let nudgeText = '';
                    if (nudgeCount === 1) {
                        nudgeText = 'YOU DID NOT EMIT ANY TOOLS. NOTHING HAPPENED. YOU MUST EMIT A TOOL NOW. USE <tool:read_file> TO READ THE FILE FIRST, THEN USE <tool:str_replace> TO EDIT IT.';
                    } else if (nudgeCount === 2) {
                        nudgeText = 'STOP DESCRIBING. EMIT A REAL TOOL RIGHT NOW. I AM NOT JOKING. EXAMPLE: <tool:read_file><path>src/ui/banner.ts</path></tool:read_file>';
                    } else if (nudgeCount === 3) {
                        nudgeText = 'THIS IS YOUR FINAL WARNING. EMIT A VALID TOOL CALL NOW OR THE USER WILL BE DISAPPOINTED.';
                    } else {
                        nudgeText = 'I HAVE ASKED YOU 4 TIMES. EMIT THE TOOLS NOW OR THIS SESSION FAILS.';
                    }
                    
                    messages.push({
                        role: 'user',
                        content: nudgeText,
                    });
                    continue;
                }
                break;
            }

            messages.push({ role: 'user', content: toolResults.join('\n\n') });
        }

        return finalize(state, input, lastContent, { allFiles, allCreated, allCmd, allReplace, allRead, inTokens, outTokens, t0, messages, undo });
    } catch (e) {
        return { state, error: redact(e instanceof Error ? e.message : String(e)), undo };
    }
}

function finalize(
    state: EngineState,
    input: string,
    output: string,
    ctx: {
        allFiles: FileChange[]; allCreated: string[]; allCmd: CommandResult[];
        allReplace: StrReplaceResult[]; allRead: ReadFileInfo[];
        inTokens: number; outTokens: number; t0: number; messages: ChatMessage[]; undo: UndoEntry[];
    },
    error?: string,
): { state: EngineState; error?: string; undo: UndoEntry[] } {
    const exchange: Exchange = {
        input,
        output,
        model: state.model,
        mode: state.mode,
        inTokens: ctx.inTokens,
        outTokens: ctx.outTokens,
        files: ctx.allFiles,
        created: [...new Set(ctx.allCreated)],
        commandResults: ctx.allCmd,
        strReplaceResults: ctx.allReplace,
        readFiles: ctx.allRead,
        durationMs: Date.now() - ctx.t0,
    };
    const newState: EngineState = {
        ...state,
        exchanges: [...state.exchanges, exchange],
        messages: ctx.messages,
    };
    saveHistory(newState.exchanges, newState.messages);
    return { state: newState, error, undo: ctx.undo };
}

function redact(msg: string): string {
    return msg.replace(/kob_[A-Za-z0-9:_-]+/g, 'kob_***');
}

export function applySlashState(
    state: EngineState,
    name: string,
): { state: EngineState; message?: string; exit?: boolean; handled: boolean } {
    switch (name) {
        case 'chat': return { state: { ...state, mode: 'chat' }, message: 'mode → Chat', handled: true };
        case 'ask': return { state: { ...state, mode: 'ask' }, message: 'mode → Ask', handled: true };
        case 'plan': return { state: { ...state, mode: 'plan' }, message: 'mode → Plan', handled: true };
        case 'code': return { state: { ...state, mode: 'code' }, message: 'mode → Code', handled: true };
        case 'clear':
        case 'newchat':
            clearHistory();
            return { state: { ...state, exchanges: [], messages: [] }, message: 'session cleared', handled: true };
        case 'reset': {
            const envModel = readEnvFile().KOB_MODEL_ID;
            const model = envModel ? formatModel(envModel) : state.model;
            clearHistory();
            return { state: { ...state, exchanges: [], messages: [], model }, message: `reset → ${model}`, handled: true };
        }
        case 'exit':
        case 'quit':
            return { state, exit: true, handled: true };
        default:
            return { state, handled: false };
    }
}
