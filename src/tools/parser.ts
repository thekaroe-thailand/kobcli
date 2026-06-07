// ════════════════════════════════════════════════════════════
//  PARSER — extract file blocks, tool calls and shell commands
//           from a model's streamed response.
// ════════════════════════════════════════════════════════════

import type { ToolCall } from '../core/types.js';

export interface ParsedFileBlock {
    filename: string;
    content: string;
    lines: number;
}

function tryExtractFilename(line: string): string | null {
    const patterns = [
        /\/\/\s*(.+?)\s*={2,}/,        // // path ====
        /\/\/\s*(.+?\.\w+)\s*$/,       // // path.ext
        /#\s*(.+?\.\w+)\s*$/,          // # path.ext
        /--\s*(.+?\.\w+)\s*$/,         // -- path.ext
        /\/\*\s*(.+?\.\w+)\s*\*\//,    // /* path.ext */
    ];
    for (const re of patterns) {
        const m = line.match(re);
        if (m && m[1]) return m[1].trim();
    }
    return null;
}

/**
 * Parse fenced code blocks whose info string carries a file path, e.g.
 *   ```ts:src/foo.ts
 *   ```python path/to/foo.py
 * or whose first line is a `// path.ext` comment.
 */
export function parseFileBlocks(content: string): ParsedFileBlock[] {
    const files: ParsedFileBlock[] = [];
    const lines = content.split('\n');
    let inCode = false;
    let filename = '';
    let collected: string[] = [];
    let sawFirstLine = false;

    for (const raw of lines) {
        const trimmed = raw.trimStart();
        if (trimmed.startsWith('```')) {
            if (inCode) {
                if (filename && collected.length > 0) {
                    files.push({ filename, content: collected.join('\n'), lines: collected.length });
                }
                inCode = false;
                filename = '';
                collected = [];
                sawFirstLine = false;
            } else {
                inCode = true;
                const header = trimmed.slice(3).trim();
                // lang:path  OR  lang path.ext
                const m = header.match(/^([\w+-]+)[\s:]+(.+?\.[\w.]+)\s*$/);
                if (m && m[2]) filename = m[2].trim();
            }
            continue;
        }
        if (inCode) {
            if (!filename && !sawFirstLine && collected.length === 0) {
                const fn = tryExtractFilename(trimmed);
                if (fn) { filename = fn; sawFirstLine = true; continue; }
            }
            sawFirstLine = true;
            collected.push(raw);
        }
    }
    if (inCode && filename && collected.length > 0) {
        files.push({ filename, content: collected.join('\n'), lines: collected.length });
    }
    return files;
}

function extractTag(body: string, tag: string): string | undefined {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
    return body.match(re)?.[1];
}

export function parseToolCalls(content: string): ToolCall[] {
    const calls: ToolCall[] = [];
    const re = /<tool:(read_file|str_replace|write_file)>([\s\S]*?)<\/tool:\1>/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
        const kind = match[1] as ToolCall['kind'];
        const body = match[2]!;
        const path = extractTag(body, 'path')?.trim();
        if (!path) continue;
        if (kind === 'read_file') {
            calls.push({ kind, path });
        } else if (kind === 'str_replace') {
            const oldStr = extractTag(body, 'old_str');
            const newStr = extractTag(body, 'new_str');
            if (oldStr !== undefined && newStr !== undefined) {
                calls.push({
                    kind,
                    path,
                    oldStr: oldStr.replace(/^\n/, '').replace(/\n$/, ''),
                    newStr: newStr.replace(/^\n/, '').replace(/\n$/, ''),
                });
            }
        } else if (kind === 'write_file') {
            const fileContent = extractTag(body, 'content');
            if (fileContent !== undefined) {
                calls.push({ kind, path, content: fileContent.replace(/^\n/, '').replace(/\n$/, '') });
            }
        }
    }
    return calls;
}

const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', 'cmd', 'powershell', 'pwsh', 'terminal', 'console']);

export function parseShellCommands(content: string): string[] {
    const cmds: string[] = [];
    const lines = content.split('\n');
    let inCode = false;
    let lang = '';
    let hasFilePath = false;

    for (const raw of lines) {
        const trimmed = raw.trim();
        if (trimmed.startsWith('```')) {
            if (inCode) { inCode = false; lang = ''; hasFilePath = false; }
            else {
                inCode = true;
                const header = trimmed.slice(3).trim();
                lang = (header.split(/[\s:]+/)[0] || '').toLowerCase();
                hasFilePath = /[:\s].+\.[\w.]+\s*$/.test(header); // this is a file block, not shell
            }
            continue;
        }
        if (!inCode || hasFilePath) continue;
        if (SHELL_LANGS.has(lang)) {
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
            cmds.push(trimmed.startsWith('$ ') ? trimmed.slice(2) : trimmed);
        } else if (trimmed.startsWith('$ ')) {
            cmds.push(trimmed.slice(2));
        }
    }
    return cmds;
}

/** Strip tool tags + file/shell code blocks for clean prose display. */
export function stripToolSyntax(content: string): string {
    return content
        .replace(/<tool:(read_file|str_replace|write_file)>[\s\S]*?<\/tool:\1>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function parseCommandArgs(input: string): string[] {
    const args: string[] = [];
    let current = '';
    let quote: '"' | '\'' | null = null;
    let escaped = false;

    for (const ch of input.trim()) {
        if (escaped) {
            current += ch;
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            continue;
        }
        if (quote) {
            if (ch === quote) quote = null;
            else current += ch;
            continue;
        }
        if (ch === '"' || ch === '\'') {
            quote = ch;
            continue;
        }
        if (/\s/.test(ch)) {
            if (current) {
                args.push(current);
                current = '';
            }
            continue;
        }
        current += ch;
    }

    if (escaped) current += '\\';
    if (current) args.push(current);
    return args;
}
