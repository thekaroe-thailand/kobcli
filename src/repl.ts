// REPL - the interactive KOB CLI loop

import chalk from 'chalk';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    createInitialState, handleSubmit, applySlashState, formatModel,
    type EngineState,
} from './core/engine.js';
import { getConfig, loadEnv } from './core/config.js';
import { getMode } from './core/modes.js';
import { readEnvFile } from './core/env-file.js';
import type { UndoEntry } from './core/types.js';
import { getGitInfo } from './tools/git.js';
import { runShellCommand } from './tools/shell.js';
import { restoreFile, generateFileTree, searchTextInFiles, replaceTextInFiles, safeReadFile } from './tools/files.js';
import { parseCommandArgs } from './tools/parser.js';
import { copyToClipboard } from './tools/clipboard.js';
import { showBanner } from './ui/banner.js';
import {
    showWelcome, showStatus, showHelp, showResponse, replayExchange, beginRound,
    reportRead, reportFileChange, reportStrReplace, reportCommand,
    banner, errorBox, printDiff, showTokens, showSearchResults, showReplaceResults,
} from './ui/render.js';
import { tintCode } from './ui/markdown.js';
import { Spinner } from './ui/spinner.js';
import {
    promptInput, pickSlashCommand, pickModel, editConfig, confirmCommand,
    promptSearchQuery, promptSearchAction, promptReplacementText, pickSearchFile,
    promptOpenFile,
} from './ui/prompts.js';
import { C, dim, disableMouse } from './ui/theme.js';

const KNOWN_COMMANDS = new Set([
    'chat', 'ask', 'plan', 'code', 'clear', 'newchat', 'reset', 'exit', 'quit',
    'help', 'models', 'config', 'git', 'diff', 'undo', 'tokens', 'init', 'find', 'replace',
    'openfile', 'open', 'read', 'ls', 'dir',
]);

interface LocalSearchState {
    query?: string;
    paths: string[];
}

class TurnIO {
    ac = new AbortController();
    spinner = new Spinner();
    private listening = false;
    private handler = (chunk: Buffer) => {
        // Only react to a LONE Esc / Ctrl-C keypress. Mouse wheel and arrow
        // keys arrive as multi-byte escape sequences and must be ignored.
        if (chunk.length === 1 && chunk[0] === 0x1b) this.ac.abort();          // Esc
        else if (chunk.length === 1 && chunk[0] === 0x03) { this.disableEsc(); process.exit(130); } // Ctrl-C
    };
    enableEsc(): void {
        if (this.listening || !process.stdin.isTTY) return;
        try { process.stdin.setRawMode?.(true); } catch { /* */ }
        disableMouse();
        process.stdin.resume();
        process.stdin.on('data', this.handler);
        this.listening = true;
    }
    disableEsc(): void {
        if (!this.listening) return;
        process.stdin.off('data', this.handler);
        try { process.stdin.setRawMode?.(false); } catch { /* */ }
        process.stdin.pause();
        this.listening = false;
    }
}

export async function runRepl(version: string): Promise<void> {
    loadEnv();
    disableMouse();

    let cfg = getConfig();
    if (!cfg) {
        banner('Let\'s set up your API key first.', C.amber);
        await editConfig();
        loadEnv();
        cfg = getConfig();
        if (!cfg) { errorBox('No API key configured. Exiting.'); return; }
    }

    let state = createInitialState(cfg);
    let lastUndo: UndoEntry[] = [];
    let lastSearch: LocalSearchState = { paths: [] };

    showBanner(version);
    if (state.exchanges.length === 0) {
        showWelcome(state.mode);
    } else {
        banner(`Resumed session · ${state.exchanges.length} previous rounds`, C.slate);
        for (const e of state.exchanges.slice(-2)) replayExchange(e, state.exchanges.indexOf(e));
    }

    while (true) {
        const git = getGitInfo(process.cwd());
        showStatus(state, git);

        const mi = getMode(state.mode);
        const promptLabel = `${chalk.hex(mi.color)(mi.icon + ' ' + mi.label)}`;
        const input = await promptInput(promptLabel);
        if (input === null) { banner('See you next time! · แล้วเจอกันนะ', C.cyan); break; }

        let trimmed = input.trim();
        if (!trimmed) continue;

        // ── direct shell command ──────────────────────────
        if (trimmed.startsWith('$ ') || trimmed.startsWith('> ')) {
            const r = runShellCommand(trimmed.slice(2).trim(), process.cwd());
            reportCommand(r);
            continue;
        }

        // ── copy last response ────────────────────────────
        if (trimmed === 'y' && state.exchanges.length > 0) {
            const last = state.exchanges[state.exchanges.length - 1]!;
            banner(copyToClipboard(last.output) ? 'Copied to clipboard' : 'Copy failed', last.output ? C.green : C.red);
            continue;
        }

        // ── slash commands ────────────────────────────────
        if (trimmed.startsWith('/')) {
            const name = trimmed.slice(1).split(/\s+/)[0]!.toLowerCase();
            // "/" alone, or an unrecognised command → open the command menu
            if (trimmed === '/' || !KNOWN_COMMANDS.has(name)) {
                const picked = await pickSlashCommand(trimmed);
                if (!picked) continue;
                trimmed = picked;
            }
            const result = await handleCommand(state, trimmed, lastUndo, lastSearch);
            if (result.exit) { banner('See you next time! · แล้วเจอกันนะ', C.cyan); break; }
            state = result.state;
            if (result.clearUndo) lastUndo = [];
            if (result.nextUndo) lastUndo = result.nextUndo;
            if (result.nextSearch) lastSearch = result.nextSearch;
            continue;
        }

        // ── normal agent turn ─────────────────────────────
        const turn = await runTurn(state, trimmed, cfg, (u) => { lastUndo = u; });
        state = turn.state;
        if (turn.connectionError) {
            // Offer a one-key retry instead of forcing the user to retype.
            const hint = chalk.hex(C.amber)('  Press ') + chalk.bold('R') + chalk.hex(C.amber)(' to retry, any other key to continue.');
            console.log(hint);
            if (await waitForRetryKey()) {
                const retry = await runTurn(state, trimmed, cfg, (u) => { lastUndo = u; });
                state = retry.state;
            }
        }
    }
}

function isRetriableErrorMessage(msg: string | undefined): boolean {
    if (!msg) return false;
    return msg.includes('Connection failed') || msg.includes('fetch failed') || msg.includes('socket');
}

/**
 * Wait for a single keypress. Resolves with `true` if the user pressed R/r
 * (retry the previous request), or `false` for any other key (skip retry).
 */
function waitForRetryKey(): Promise<boolean> {
    return new Promise((resolve) => {
        if (!process.stdin.isTTY) { resolve(false); return; }
        const stdin = process.stdin;
        const previousRawMode = stdin.isRaw;
        const onData = (chunk: Buffer) => {
            stdin.off('data', onData);
            try { stdin.setRawMode?.(Boolean(previousRawMode)); } catch { /* */ }
            const s = chunk.toString('utf8');
            if (s === 'r' || s === 'R') resolve(true);
            else resolve(false);
        };
        try { stdin.setRawMode?.(true); } catch { /* */ }
        stdin.resume();
        stdin.on('data', onData);
    });
}

async function runTurn(
    state: EngineState,
    input: string,
    cfg: ReturnType<typeof getConfig>,
    setUndo: (u: UndoEntry[]) => void,
): Promise<{ state: EngineState; connectionError: boolean }> {
    const io = new TurnIO();
    const showDiff = state.mode === 'code';

    // open the framed round (sets the rail colour for all the report* output)
    beginRound(state.mode, input, state.exchanges.length);

    io.spinner.start('Thinking');
    io.enableEsc();

    const result = await handleSubmit(state, input, {
        signal: io.ac.signal,
        onProgress: (label) => io.spinner.setText(label),
        onReadFile: (i) => { io.spinner.stop(); reportRead(i.path, i.lines); io.spinner.start('Working'); },
        onFileChange: (fc) => { io.spinner.stop(); reportFileChange(fc, showDiff); io.spinner.start('Working'); },
        onStrReplace: (r) => { io.spinner.stop(); reportStrReplace(r, showDiff); io.spinner.start('Working'); },
        onCommand: (r) => { io.spinner.stop(); reportCommand(r); io.spinner.start('Working'); },
        approveCommand: async (cmd, kind) => {
            if (kind === 'readonly' && cfg?.autoApproveReadonly) return true;
            io.spinner.stop();
            io.disableEsc();
            const ok = await confirmCommand(cmd, kind === 'dangerous' ? 'dangerous' : 'mutating');
            io.enableEsc();
            io.spinner.start('Working');
            return ok;
        },
    });

    io.spinner.stop();
    io.disableEsc();

    if (result.error && result.state === state) {
        errorBox(result.error);
        return { state, connectionError: isRetriableErrorMessage(result.error) };
    }
    setUndo(result.undo);
    if (result.error) banner(result.error, C.amber);

    const last = result.state.exchanges[result.state.exchanges.length - 1];
    if (last) {
        showResponse(last);
        if (state.mode === 'code' && last.files.length === 0 && last.strReplaceResults.length === 0 && last.commandResults.length === 0) {
            console.log('  ' + chalk.hex(C.amber)('⚠ No files changed. ') + dim('Try /models to pick a stronger coding model.'));
            console.log('');
        }
    }
    return { state: result.state, connectionError: false };
}


async function handleCommand(
    state: EngineState,
    cmd: string,
    lastUndo: UndoEntry[],
    lastSearch: LocalSearchState,
): Promise<{ state: EngineState; exit?: boolean; clearUndo?: boolean; nextUndo?: UndoEntry[]; nextSearch?: LocalSearchState }> {
    const body = cmd.slice(1).trim();
    const space = body.search(/\s/);
    const name = (space === -1 ? body : body.slice(0, space)).toLowerCase();
    const rawArgs = space === -1 ? '' : body.slice(space + 1);
    const args = parseCommandArgs(rawArgs);

    const t = applySlashState(state, name);
    if (t.handled) {
        if (t.message) banner(t.message, getMode(t.state.mode).color);
        return { state: t.state, exit: t.exit };
    }

    switch (name) {
        case 'help':
            showHelp();
            return { state };

        case 'models': {
            const m = await pickModel(state.model);
            if (m) { state = { ...state, model: m }; banner(`Model → ${m}`, C.amber); }
            return { state };
        }

        case 'config': {
            const ok = await editConfig();
            if (ok) {
                const env = readEnvFile();
                if (env.KOB_MODEL_ID) state = { ...state, model: formatModel(env.KOB_MODEL_ID) };
                banner('Configuration saved', C.green);
            }
            return { state };
        }

        case 'git': {
            const g = getGitInfo(process.cwd());
            if (!g.isRepo) { banner('Not a git repository', C.gray); return { state }; }
            const r = runShellCommand('git status --short --branch', process.cwd());
            console.log('');
            console.log('  ' + chalk.hex(C.green)('⎇ ' + (g.branch || '?')) + dim(`  · ${g.dirty} changed`));
            for (const line of (r.stdout || '').split('\n').filter(Boolean).slice(0, 30)) console.log('    ' + dim(line));
            console.log('');
            return { state };
        }

        case 'find': {
            return await runFindFlow(state, args, lastSearch);
        }

        case 'replace': {
            let oldText = '';
            let newText = '';
            let scopedPaths: string[] | undefined;

            if (args.length === 1 && lastSearch.query) {
                oldText = lastSearch.query;
                newText = args[0]!;
                scopedPaths = lastSearch.paths;
            } else if (args.length >= 2) {
                oldText = args[0]!;
                newText = args.slice(1).join(' ');
                scopedPaths = lastSearch.query === oldText ? lastSearch.paths : undefined;
            } else {
                banner('Usage: /replace "ข้อความเดิม" "ข้อความใหม่"', C.amber);
                banner('หรือใช้ /find ก่อน แล้วตามด้วย /replace "ข้อความใหม่"', C.slate);
                return { state };
            }

            const results = replaceTextInFiles(oldText, newText, process.cwd(), scopedPaths);
            showReplaceResults(oldText, newText, results);
            return {
                state,
                nextUndo: results.map((item) => ({ path: item.path, previous: item.previous ?? null })),
                nextSearch: {
                    query: newText,
                    paths: results.map((item) => item.path),
                },
            };
        }

        case 'diff': {
            const last = state.exchanges[state.exchanges.length - 1];
            if (!last || (last.files.length === 0 && last.strReplaceResults.length === 0)) {
                banner('No changes to show', C.gray);
                return { state };
            }
            console.log('');
            for (const f of last.files) {
                console.log('  ' + chalk.hex(f.existed ? C.amber : C.green)((f.existed ? '~ ' : '+ ') + f.filename));
                printDiff(f.existed ? (f.previous ?? '') : '', f.content, 40);
                console.log('');
            }
            for (const r of last.strReplaceResults) {
                if (!r.ok || r.previous === undefined || r.next === undefined) continue;
                console.log('  ' + chalk.hex(C.amber)('~ ' + r.path));
                printDiff(r.previous, r.next, 40);
                console.log('');
            }
            return { state };
        }

        case 'ls':
        case 'dir': {
            const r = runShellCommand(name === 'ls' ? 'ls -la' : 'dir', process.cwd());
            reportCommand(r);
            return { state };
        }

        case 'openfile':
        case 'open':
        case 'read': {
            let targetFile = args.length > 0 ? args.join(' ') : null;
            if (!targetFile) {
                targetFile = await promptOpenFile(process.cwd());
            }
            
            if (targetFile) {
                const content = safeReadFile(targetFile, process.cwd());
                if (content.startsWith('[ERROR:')) {
                    errorBox(content);
                } else {
                    console.log('');
                    console.log('  ' + chalk.hex(C.cyan)('╭─ ' + targetFile));
                    const lines = content.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        const l = lines[i]!;
                        const num = String(i + 1).padStart(4, ' ');
                        console.log('  ' + chalk.hex(C.slate)('│ ') + chalk.dim(num + ' ') + tintCode(l));
                    }
                    console.log('  ' + chalk.hex(C.cyan)('╰─ ') + dim(`${lines.length} lines`));
                    console.log('');
                }
            }
            return { state };
        }

        case 'undo': {
            if (lastUndo.length === 0) { banner('Nothing to undo', C.gray); return { state }; }
            let n = 0;
            for (const u of lastUndo) { if (restoreFile(u.path, u.previous, process.cwd())) n++; }
            banner(`Reverted ${n} file${n !== 1 ? 's' : ''}`, C.orange);
            return { state, clearUndo: true };
        }

        case 'tokens':
            showTokens(state);
            return { state };

        case 'init': {
            const path = join(process.cwd(), 'AGENTS.md');
            if (existsSync(path)) { banner('AGENTS.md already exists', C.gray); return { state }; }
            const tree = generateFileTree(process.cwd(), 3);
            let pkgName = 'this project';
            try {
                const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
                pkgName = pkg.name || pkgName;
            } catch { /* */ }
            writeFileSync(path, makeAgentsMd(pkgName, tree), 'utf-8');
            banner('Created AGENTS.md', C.green);
            return { state };
        }

        default:
            banner(`Unknown command: /${name}  ·  try /help`, C.gray);
            return { state };
    }
}

async function runFindFlow(
    state: EngineState,
    args: string[],
    lastSearch: LocalSearchState,
): Promise<{ state: EngineState; nextUndo?: UndoEntry[]; nextSearch?: LocalSearchState }> {
    let query = args.length > 0 ? args.join(' ') : (await promptSearchQuery(lastSearch.query || ''));
    if (!query) return { state };

    while (true) {
        const result = searchTextInFiles(query, process.cwd());
        showSearchResults(result);

        const nextSearch: LocalSearchState = {
            query,
            paths: result.files.map((file) => file.path),
        };

        const action = await promptSearchAction(query, result.totalFiles > 0);
        if (action === null || action === 'done') return { state, nextSearch };

        if (action === 'search_again') {
            const nextQuery = await promptSearchQuery(query);
            if (!nextQuery) return { state, nextSearch };
            query = nextQuery;
            continue;
        }

        const newText = await promptReplacementText(query);
        if (newText === null) return { state, nextSearch };

        let scopedPaths: string[] | undefined = result.files.map((file) => file.path);
        if (action === 'replace_file') {
            const pickedPath = await pickSearchFile(scopedPaths);
            if (!pickedPath) return { state, nextSearch };
            scopedPaths = [pickedPath];
        }

        const results = replaceTextInFiles(query, newText, process.cwd(), scopedPaths);
        showReplaceResults(query, newText, results);
        return {
            state,
            nextUndo: results.map((item) => ({ path: item.path, previous: item.previous ?? null })),
            nextSearch: {
                query: newText,
                paths: results.map((item) => item.path),
            },
        };
    }
}

function makeAgentsMd(name: string, tree: string): string {
    return `# AGENTS.md

Guidance for AI coding agents working in **${name}**.

## Project structure

\`\`\`
${tree}
\`\`\`

## Conventions

- Keep changes small and focused.
- Match the existing code style.
- Run the test suite before considering a task done.

## Commands

- Install: \`npm install\`
- Test: \`npm test\`
- Build: \`npm run build\`

_Generated by KOB CLI._
`;
}
