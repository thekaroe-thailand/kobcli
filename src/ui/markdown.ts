// ════════════════════════════════════════════════════════════
//  MARKDOWN — render Markdown to pretty ANSI for the terminal
// ════════════════════════════════════════════════════════════

import chalk from 'chalk';
import { C } from './theme.js';

// ── inline formatting ──────────────────────────────────────
function inline(text: string): string {
    let s = text;
    s = s.replace(/`([^`]+)`/g, (_m, code) => chalk.hex(C.green)(code));            // `code`
    s = s.replace(/\*\*([^*]+)\*\*/g, (_m, t) => chalk.bold(t));                    // **bold**
    s = s.replace(/__([^_]+)__/g, (_m, t) => chalk.bold(t));                        // __bold__
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, (_m, p, t) => p + chalk.italic(t));     // *italic*
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, url) =>                       // [text](url)
        chalk.hex(C.blue).underline(t) + chalk.dim(` (${url})`));
    return s;
}

// ── tiny syntax tint for fenced code ───────────────────────
const KEYWORDS_SRC = `\\b(const|let|var|function|return|if|else|for|while|import|export|from|class|extends|new|async|await|try|catch|throw|def|public|private|static|void|interface|type|enum|struct|fn|use|pub|match|elif|then|fi|echo|true|false|null|undefined|None|True|False)\\b`;
const TOKENIZER = new RegExp(
    `((["'\`])(?:\\\\.|(?!\\2).)*\\2)|(\\b\\d+(?:\\.\\d+)?\\b)|(${KEYWORDS_SRC})`,
    'g'
);

export function tintCode(line: string): string {
    if (/^\s*(\/\/|#|--)/.test(line)) return chalk.hex(C.slate)(line);
    return line.replace(TOKENIZER, (match, strGrp, _quote, numGrp, kwGrp) => {
        if (strGrp) return chalk.hex(C.amber)(strGrp);
        if (numGrp) return chalk.hex(C.orange)(numGrp);
        if (kwGrp) return chalk.hex(C.violet)(kwGrp);
        return match;
    });
}

function renderCodeBlock(lines: string[], lang: string, out: string[]): void {
    const label = lang ? chalk.hex(C.cyan)(lang) : chalk.dim('code');
    const bar = chalk.hex(C.slate)('│ ');
    out.push('  ' + chalk.dim('┌─ ') + label);
    for (const l of lines) out.push('  ' + bar + tintCode(l));
    out.push('  ' + chalk.dim('└─'));
}

/** Render markdown text → ANSI string (indented by 2 spaces). */
export function renderMarkdown(md: string): string {
    const lines = md.split('\n');
    const out: string[] = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i]!;
        const trimmed = line.trim();

        if (trimmed.startsWith('```')) {
            const lang = trimmed.slice(3).trim().split(/[\s:]+/)[0] || '';
            const code: string[] = [];
            i++;
            while (i < lines.length && !lines[i]!.trim().startsWith('```')) { code.push(lines[i]!); i++; }
            i++; // closing fence
            renderCodeBlock(code, lang, out);
            continue;
        }

        const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
        const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/);
        const num = line.match(/^(\s*)(\d+)\.\s+(.*)$/);

        if (h) {
            const level = h[1]!.length;
            const txt = inline(h[2]!);
            if (level === 1) out.push('  ' + chalk.hex(C.cyan).bold.underline(txt));
            else if (level === 2) out.push('  ' + chalk.hex(C.violet).bold(txt));
            else out.push('  ' + chalk.hex(C.blue).bold(txt));
        } else if (/^(\s*[-*_]){3,}\s*$/.test(line) && trimmed.length >= 3 && !bullet) {
            out.push('  ' + chalk.dim('─'.repeat(40)));
        } else if (trimmed.startsWith('>')) {
            out.push('  ' + chalk.hex(C.slate)('▏ ') + chalk.italic(inline(trimmed.replace(/^>\s?/, ''))));
        } else if (bullet) {
            out.push('  ' + ' '.repeat(bullet[1]!.length) + chalk.hex(C.green)('• ') + inline(bullet[2]!));
        } else if (num) {
            out.push('  ' + ' '.repeat(num[1]!.length) + chalk.hex(C.amber)(num[2]! + '. ') + inline(num[3]!));
        } else if (trimmed === '') {
            out.push('');
        } else {
            out.push('  ' + inline(line));
        }
        i++;
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}
