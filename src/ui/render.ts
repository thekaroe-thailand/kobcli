// RENDER - status bar, framed rounds, diffs, help

import chalk from 'chalk';
import { C, dim, bold, rule, termWidth, contentWidth, wrapVisible, disableMouse } from './theme.js';
import { renderMarkdown } from './markdown.js';
import { getMode } from '../core/modes.js';
import { getContextWindow, contextUsage } from '../core/engine.js';
import { diffLines, compactHunks } from '../tools/diff.js';
import type { TextSearchResult, BulkReplaceFileResult } from '../tools/files.js';
import type { EngineState } from '../core/engine.js';
import type { Exchange, FileChange, CommandResult, StrReplaceResult, Mode } from '../core/types.js';
import type { GitInfo } from '../tools/git.js';

function fmtNum(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
}

function fmtDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

// ── the left rail that frames a round ──────────────────────
let RAIL_COLOR: string = C.slate;
export function setRail(color: string): void { RAIL_COLOR = color; }
function bar(): string { return chalk.hex(RAIL_COLOR)('│') + ' '; }
function railWidth(): number { return contentWidth() - 4; } // "  │ "

/** Print body text inside the rail, word-wrapped so nothing overflows. */
function railText(text: string): void {
    const w = railWidth();
    for (const piece of wrapVisible(text, w)) console.log('  ' + bar() + piece);
}

/** Open a framed round: ╭─ header + the user's prompt. */
export function beginRound(mode: Mode, input: string, idx: number): void {
    const mi = getMode(mode);
    RAIL_COLOR = mi.color;
    console.log('');
    console.log('  ' + chalk.hex(mi.color)('╭─ ' + mi.icon) + '  ' + dim(`Round ${idx + 1}`) + dim('  ·  ') + chalk.hex(mi.color)(mi.label));
    const preview = input.length > 200 ? input.slice(0, 197) + '…' : input;
    const w = railWidth() - 2;
    let first = true;
    for (const logical of preview.split('\n')) {
        for (const piece of wrapVisible(logical, w)) {
            console.log('  ' + bar() + (first ? chalk.hex(C.cyan)('❯ ') : '  ') + piece);
            first = false;
        }
    }
}

const COMMANDS: [string, string, string][] = [
    ['/chat', 'Open conversation', C.cyan],
    ['/ask', 'Q&A about your code', C.blue],
    ['/plan', 'Architect a solution', C.violet],
    ['/code', 'Build & edit autonomously', C.green],
    ['/models', 'Switch AI model', C.amber],
    ['/config', 'Edit .env settings', C.pink],
    ['/diff', 'Show last changes', C.orange],
    ['/undo', 'Revert last changes', C.orange],
    ['/git', 'Repo status', C.green],
    ['/find', 'Find text and continue', C.cyan],
    ['/replace', 'Replace text locally', C.orange],
    ['/open', 'Open and read a file', C.blue],
    ['/init', 'Scaffold AGENTS.md', C.blue],
    ['/tokens', 'Usage this session', C.amber],
    ['/project:list', 'List/switch projects', C.blue],
    ['/project:create', 'Create a new project', C.green],
    ['/project:delete', 'Remove a project', C.red],
    ['/clear', 'Clear session', C.red],
    ['/help', 'Show all commands', C.blue],
    ['/exit', 'Quit', C.gray],
];

export function showWelcome(mode: Mode): void {
    console.log(dim('  Commands'));
    console.log('');
    const half = Math.ceil(COMMANDS.length / 2);
    for (let i = 0; i < half; i++) {
        const left = COMMANDS[i]!;
        const right = COMMANDS[i + half];
        const l = '    ' + chalk.hex(left[2])(left[0].padEnd(9)) + ' ' + dim(left[1].padEnd(26));
        const r = right ? chalk.hex(right[2])(right[0].padEnd(9)) + ' ' + dim(right[1]) : '';
        console.log(l + r);
    }
    const mi = getMode(mode);
    console.log('');
    console.log('  ' + dim('Mode:') + ' ' + chalk.hex(mi.color)(`${mi.icon} ${mi.label}`) + dim(`  —  ${mi.blurb}`));
    console.log('');
}

export function showStatus(state: EngineState, git: GitInfo): void {
    disableMouse(); // last thing before the prompt → wheel scrolls the buffer
    const totalIn = state.exchanges.reduce((s, e) => s + e.inTokens, 0);
    const totalOut = state.exchanges.reduce((s, e) => s + e.outTokens, 0);
    const used = contextUsage(state.messages);
    const max = getContextWindow(state.model);
    const pct = Math.min(100, Math.round((used / max) * 100));
    const mi = getMode(state.mode);

    const barW = 14;
    const filled = Math.min(barW, Math.round((used / max) * barW));
    const barColor = pct < 50 ? chalk.hex(C.green) : pct < 80 ? chalk.hex(C.amber) : chalk.hex(C.red);
    const ctxBar = barColor('█'.repeat(filled)) + dim('░'.repeat(barW - filled));

    let gitStr = '';
    if (git.isRepo) {
        const dirtyMark = git.dirty > 0 ? chalk.hex(C.amber)(`*${git.dirty}`) : chalk.hex(C.green)('✓');
        gitStr = `  ${dim('│')}  ${chalk.hex(C.green)('⎇ ' + (git.branch || '?'))} ${dirtyMark}`;
    }

    console.log(rule());
    console.log(
        `  ${chalk.hex(mi.color)(mi.icon + ' ' + mi.label)}  ${dim('│')}  ` +
        `${chalk.hex(C.pink)(state.model)}  ${dim('│')}  ` +
        `${chalk.hex(C.blue)('↓' + fmtNum(totalIn))} ${chalk.hex(C.pink)('↑' + fmtNum(totalOut))}` +
        gitStr,
    );
    console.log(`  ${ctxBar} ${barColor(pct + '%')}  ${dim(fmtNum(used) + '/' + fmtNum(max) + ' ctx')}  ${dim('·')}  ${dim(state.exchanges.length + ' rounds')}`);
    console.log(rule());
}

// ── diffs ──────────────────────────────────────────────────
export function printDiff(oldStr: string, newStr: string, maxLines = 40): void {
    const lines = compactHunks(diffLines(oldStr, newStr), 2);
    const w = contentWidth() - 6;
    let shown = 0;
    for (const l of lines) {
        if (shown >= maxLines) { console.log('    ' + dim(`… (+${lines.length - shown} more lines)`)); break; }
        const t = l.text.length > w ? l.text.slice(0, w - 1) + '…' : l.text;
        if (l.type === 'add') console.log('    ' + chalk.hex(C.green)('+ ' + t));
        else if (l.type === 'del') console.log('    ' + chalk.hex(C.red)('- ' + t));
        else console.log('    ' + dim('  ' + t));
        shown++;
    }
}

function railDiff(oldStr: string, newStr: string, maxLines = 16): void {
    const lines = compactHunks(diffLines(oldStr, newStr), 2);
    const w = railWidth() - 2;
    let shown = 0;
    for (const l of lines) {
        if (shown >= maxLines) { console.log('  ' + bar() + '  ' + dim(`… (+${lines.length - shown} more lines)`)); break; }
        const t = l.text.length > w ? l.text.slice(0, w - 1) + '…' : l.text;
        if (l.type === 'add') console.log('  ' + bar() + '  ' + chalk.hex(C.green)('+ ' + t));
        else if (l.type === 'del') console.log('  ' + bar() + '  ' + chalk.hex(C.red)('- ' + t));
        else console.log('  ' + bar() + '  ' + dim(t));
        shown++;
    }
}

function fileChangeLine(path: string, created: boolean, add: number, del: number, ok = true): string {
    const icon = !ok ? chalk.hex(C.red)('✗') : created ? chalk.hex(C.green)('+') : chalk.hex(C.amber)('~');
    const stat = ok ? `${chalk.hex(C.green)('+' + add)}${del > 0 ? ' ' + chalk.hex(C.red)('-' + del) : ''}` : chalk.hex(C.red)('(failed)');
    return `${icon} ${path}  ${stat}`;
}

// ── live event renderers (inside a framed round) ───────────
export function reportRead(path: string, lines: number): void {
    console.log('  ' + bar() + chalk.hex(C.blue)('↳ read ') + path + dim(`  (${lines} lines)`));
}

export function reportFileChange(fc: FileChange, showDiff: boolean): void {
    console.log('  ' + bar() + fileChangeLine(fc.filename, !fc.existed, fc.addLines, fc.delLines));
    if (showDiff && fc.existed && fc.previous !== undefined) railDiff(fc.previous, fc.content, 16);
}

export function reportStrReplace(r: StrReplaceResult, showDiff: boolean): void {
    console.log('  ' + bar() + fileChangeLine(r.path, false, r.addLines, r.delLines, r.ok));
    if (showDiff && r.ok && r.previous !== undefined && r.next !== undefined) railDiff(r.previous, r.next, 16);
}

export function reportCommand(r: CommandResult): void {
    const mark = r.skipped ? chalk.hex(C.gray)('⊘') : r.ok ? chalk.hex(C.green)('✓') : chalk.hex(C.red)('✗');
    console.log('  ' + bar() + mark + ' ' + dim('$') + ' ' + bold(r.cmd.slice(0, railWidth() - 4)));
    if (r.skipped) return;
    const w = railWidth() - 2;
    const out = (r.stdout || r.stderr || '').split('\n').filter(Boolean).slice(0, 6);
    for (const o of out) console.log('  ' + bar() + '  ' + dim(o.length > w ? o.slice(0, w - 1) + '…' : o));
    console.log('  ' + bar() + '  ' + dim(`exit ${r.exitCode} · ${fmtDuration(r.durationMs)}`));
}

// ── close a framed round: body + ╰─ footer ─────────────────
export function showResponse(exc: Exchange): void {
    const prose = renderMarkdown(stripTags(exc.output));
    if (prose.trim()) {
        console.log('  ' + bar());
        for (const line of prose.split('\n')) {
            const body = line.startsWith('  ') ? line.slice(2) : line;
            if (body.trim() === '') { console.log('  ' + bar()); continue; }
            for (const piece of wrapVisible(body, railWidth())) console.log('  ' + bar() + piece);
        }
    }
    const filesTouched = exc.created.length + exc.strReplaceResults.filter(r => r.ok).length;
    const parts = [
        chalk.hex(C.amber)('⏱ ' + fmtDuration(exc.durationMs)),
        chalk.hex(C.blue)('↓' + fmtNum(exc.inTokens)) + ' ' + chalk.hex(C.pink)('↑' + fmtNum(exc.outTokens)) + dim(' tok'),
    ];
    if (filesTouched > 0) parts.push(chalk.hex(C.green)(`${filesTouched} file${filesTouched !== 1 ? 's' : ''}`));
    if (exc.commandResults.length > 0) parts.push(chalk.hex(C.orange)(`${exc.commandResults.length} cmd`));
    parts.push(chalk.hex(C.slate)(exc.model));
    console.log('  ' + chalk.hex(RAIL_COLOR)('╰─ ') + parts.join(dim('  ·  ')));
    console.log('');
}

function stripTags(s: string): string {
    return s
        .replace(/<tool:(read_file|str_replace|write_file)>[\s\S]*?<\/tool:\1>/g, '')
        .replace(/<tool_result:[\s\S]*?<\/tool_result:[^>]*>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** Replay a saved exchange on launch, using the same framed style. */
export function replayExchange(exc: Exchange, idx: number): void {
    beginRound(exc.mode, exc.input, idx);
    for (const r of exc.readFiles) reportRead(r.path, r.lines);
    for (const f of exc.files) console.log('  ' + bar() + fileChangeLine(f.filename, !f.existed, f.addLines, f.delLines));
    for (const r of exc.strReplaceResults) console.log('  ' + bar() + fileChangeLine(r.path, false, r.addLines, r.delLines, r.ok));
    showResponse(exc);
}

// ── help / banners ─────────────────────────────────────────
export function showHelp(): void {
    console.log('');
    console.log('  ' + bold('KOB CLI — Commands'));
    console.log('  ' + dim('─'.repeat(46)));
    for (const [cmd, desc, clr] of COMMANDS) {
        console.log('    ' + chalk.hex(clr)(cmd.padEnd(10)) + ' ' + dim(desc));
    }
    console.log('');
    console.log('    ' + bold('$ <cmd>'.padEnd(10)) + ' ' + dim('Run a shell command directly'));
    console.log('    ' + bold('/find'.padEnd(18)) + ' ' + dim('Find text, then choose what to do next'));
    console.log('    ' + bold('/replace "old" "new"'.padEnd(18)) + ' ' + dim('Replace exact text without using AI'));
    console.log('    ' + bold('y'.padEnd(10)) + ' ' + dim('Copy last response to clipboard'));
    console.log('    ' + bold('Esc'.padEnd(10)) + ' ' + dim('Interrupt the current generation'));
    console.log('    ' + bold('Ctrl+C'.padEnd(10)) + ' ' + dim('Quit'));
    console.log('');
}

export function showSearchResults(result: TextSearchResult): void {
    console.log('');
    if (result.totalFiles === 0) {
        console.log('  ' + chalk.hex(C.amber)(`No matches for "${result.query}"`));
        console.log('');
        return;
    }

    console.log('  ' + bold(`Found "${result.query}"`));
    console.log('  ' + dim(`in ${result.totalFiles} file${result.totalFiles !== 1 ? 's' : ''} · ${result.totalMatches} match${result.totalMatches !== 1 ? 'es' : ''} · scanned ${result.scannedFiles} text files`));
    console.log('');
    for (const file of result.files.slice(0, 30)) {
        console.log('    ' + chalk.hex(C.cyan)(file.path) + dim(`  (${file.totalMatches} matches)`));
        for (const hit of file.hits) {
            console.log('      ' + dim(`L${hit.line}:C${hit.column}`) + '  ' + hit.preview);
        }
    }
    if (result.files.length > 30) console.log('    ' + dim(`… and ${result.files.length - 30} more files`));
    console.log('');
}

export function showReplaceResults(oldText: string, newText: string, results: BulkReplaceFileResult[]): void {
    console.log('');
    if (results.length === 0) {
        console.log('  ' + chalk.hex(C.amber)(`No replacements made for "${oldText}"`));
        console.log('');
        return;
    }

    const totalReplacements = results.reduce((sum, item) => sum + item.replacements, 0);
    console.log('  ' + bold(`Replaced "${oldText}" → "${newText}"`));
    console.log('  ' + dim(`updated ${results.length} file${results.length !== 1 ? 's' : ''} · ${totalReplacements} replacement${totalReplacements !== 1 ? 's' : ''}`));
    console.log('');
    for (const item of results.slice(0, 30)) {
        console.log('    ' + chalk.hex(C.green)(item.path) + dim(`  (${item.replacements} replacements)`));
    }
    if (results.length > 30) console.log('    ' + dim(`… and ${results.length - 30} more files`));
    console.log('');
}

export function banner(text: string, color: string = C.cyan): void {
    console.log('');
    console.log('  ' + chalk.hex(color)('◆ ') + chalk.hex(color)(text));
    console.log('');
}

export function errorBox(text: string): void {
    console.log('');
    console.log('  ' + chalk.hex(C.red)('✗ ') + chalk.hex(C.red)(text.split('\n').join('\n    ')));
    console.log('');
}

export function showTokens(state: EngineState): void {
    const totalIn = state.exchanges.reduce((s, e) => s + e.inTokens, 0);
    const totalOut = state.exchanges.reduce((s, e) => s + e.outTokens, 0);
    console.log('');
    console.log('  ' + bold('Session usage'));
    console.log('  ' + dim('─'.repeat(30)));
    console.log('    ' + dim('Rounds   ') + state.exchanges.length);
    console.log('    ' + dim('Input    ') + chalk.hex(C.blue)(fmtNum(totalIn) + ' tok'));
    console.log('    ' + dim('Output   ') + chalk.hex(C.pink)(fmtNum(totalOut) + ' tok'));
    console.log('    ' + dim('Total    ') + bold(fmtNum(totalIn + totalOut) + ' tok'));
    console.log('    ' + dim('Context  ') + chalk.hex(C.amber)(fmtNum(contextUsage(state.messages))) + dim(' / ' + fmtNum(getContextWindow(state.model))));
    console.log('');
    void termWidth;
}
