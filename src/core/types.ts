// ════════════════════════════════════════════════════════════
//  TYPES — shared type definitions for KOB CLI v2
// ════════════════════════════════════════════════════════════

export type Mode = 'chat' | 'ask' | 'plan' | 'code';

export interface CliConfig {
    baseUrl: string;
    apiKey: string;
    apiToken?: string;
    bearerToken: string;
    modelId?: string;
    maxTokens: number;
    autoApproveReadonly: boolean;
}

export interface ModeInfo {
    id: Mode;
    label: string;
    icon: string;
    color: string;
    blurb: string;
    placeholder: string;
    systemPrompt: string;
    /** whether this mode is allowed to write files / run commands */
    canMutate: boolean;
    statusMessages: string[];
}

export interface FileChange {
    filename: string;
    content: string;
    addLines: number;
    delLines: number;
    /** previous content if the file already existed (for diff + undo) */
    previous?: string;
    existed: boolean;
}

export interface CommandResult {
    cmd: string;
    ok: boolean;
    stdout: string;
    stderr: string;
    durationMs: number;
    exitCode: number;
    skipped?: boolean;
}

export interface StrReplaceResult {
    path: string;
    ok: boolean;
    addLines: number;
    delLines: number;
    error?: string;
    previous?: string;
    next?: string;
}

export interface ReadFileInfo {
    path: string;
    lines: number;
}

export interface Exchange {
    input: string;
    output: string;
    model: string;
    mode: Mode;
    inTokens: number;
    outTokens: number;
    files: FileChange[];
    created: string[];
    commandResults: CommandResult[];
    strReplaceResults: StrReplaceResult[];
    readFiles: ReadFileInfo[];
    durationMs: number;
}

export type ToolKind = 'read_file' | 'str_replace' | 'write_file';

export interface ToolCall {
    kind: ToolKind;
    path: string;
    oldStr?: string;
    newStr?: string;
    content?: string;
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/** A single snapshot we can restore for /undo */
export interface UndoEntry {
    path: string;
    previous: string | null; // null means the file did not exist before
}
