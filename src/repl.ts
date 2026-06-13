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
import { readEnvFile, writeEnvFile } from './core/env-file.js';
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
    promptOpenFile, pickProject, promptProjectCreate, pickProjectToDelete,
    promptConfigText, promptConfigPassword,
} from './ui/prompts.js';
import { loadProjects, saveProjects, addProject, removeProject } from './core/projects.js';
import { runUpgrade } from './core/upgrade.js';
import { C, dim, disableMouse } from './ui/theme.js';
import { ensureInteractiveStdin, restoreStdin, snapshotStdin, type StdinSnapshot } from './ui/tty.js';

const KNOWN_COMMANDS = new Set([
    'chat', 'ask', 'plan', 'code', 'clear', 'newchat', 'reset', 'exit', 'quit',
    'help', 'models', 'config', 'config-info', 'config:provider', 'config:key', 'config:model',
    'git', 'diff', 'undo', 'tokens', 'init', 'find', 'replace',
    'openfile', 'open', 'read', 'ls', 'dir', 'project:list', 'project:create', 'project:delete', 'upgrade'
]);

interface LocalSearchState {
    query?: string;
    paths: string[];
}

class TurnIO {
    ac = new AbortController();
    spinner = new Spinner();
    exitRequested = false;
    private listening = false;
    private stdinSnapshot: StdinSnapshot | null = null;
    private rawGuardTimer: ReturnType<typeof setInterval> | null = null;
    private handler = (chunk: Buffer) => {
        // Only react to a LONE Esc / Ctrl-C keypress. Mouse wheel and arrow
        // keys arrive as multi-byte escape sequences and must be ignored.
        if (chunk.length === 1 && chunk[0] === 0x1b) this.ac.abort();          // Esc
        else if (chunk.length === 1 && chunk[0] === 0x03) {
            this.disableEsc();
            this.exitRequested = true;
            this.ac.abort();
        } // Ctrl-C
    };
    enableEsc(): void {
        if (this.listening || !process.stdin.isTTY) return;
        this.stdinSnapshot = snapshotStdin(process.stdin);
        ensureInteractiveStdin(process.stdin);
        this.rawGuardTimer = setInterval(() => ensureInteractiveStdin(process.stdin), 250);
        process.stdin.on('data', this.handler);
        this.listening = true;
    }
    disableEsc(): void {
        if (!this.listening) return;
        process.stdin.off('data', this.handler);
        if (this.rawGuardTimer) {
            clearInterval(this.rawGuardTimer);
            this.rawGuardTimer = null;
        }
        if (this.stdinSnapshot) {
            restoreStdin(process.stdin, this.stdinSnapshot);
            this.stdinSnapshot = null;
        }
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
        if (turn.exitRequested) {
            banner('See you next time! · แล้วเจอกันนะ', C.cyan);
            break;
        }
        if (turn.connectionError) {
            // Auto-retry after 10 seconds so the user doesn't have to manually retype.
            console.log(chalk.hex(C.amber)(`  Connection failed. Auto-retrying in 10s... (press any key to skip)`));
            const shouldRetry = await waitWithCountdown(10);
            if (shouldRetry) {
                const retry = await runTurn(state, trimmed, cfg, (u) => { lastUndo = u; });
                if (retry.exitRequested) {
                    banner('See you next time! · แล้วเจอกันนะ', C.cyan);
                    break;
                }
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
 * Wait for up to `seconds` seconds. Resolves with `true` when the timer
 * expires, or `false` if the user presses any key to skip the wait.
 */
function waitWithCountdown(seconds: number): Promise<boolean> {
    return new Promise((resolve) => {
        if (!process.stdin.isTTY) {
            setTimeout(() => resolve(true), seconds * 1000);
            return;
        }
        const stdin = process.stdin;
        const stdinSnapshot = snapshotStdin(stdin);
        let rawGuardTimer: ReturnType<typeof setInterval> | null = null;
        let resolved = false;

        const cleanup = () => {
            if (resolved) return;
            resolved = true;
            if (rawGuardTimer) clearInterval(rawGuardTimer);
            stdin.off('data', onData);
            restoreStdin(stdin, stdinSnapshot);
        };

        const onData = (_chunk: Buffer) => {
            cleanup();
            resolve(false);
        };

        ensureInteractiveStdin(stdin);
        rawGuardTimer = setInterval(() => {
            if (!resolved) ensureInteractiveStdin(stdin);
        }, 250);
        stdin.on('data', onData);

        setTimeout(() => {
            cleanup();
            resolve(true);
        }, seconds * 1000);
    });
}

/**
 * Wait for a single keypress. Resolves with `true` if the user pressed R/r
 * (retry the previous request), or `false` for any other key (skip retry).
 */
function waitForRetryKey(): Promise<boolean> {
    return new Promise((resolve) => {
        if (!process.stdin.isTTY) { resolve(false); return; }
        const stdin = process.stdin;
        const stdinSnapshot = snapshotStdin(stdin);
        let rawGuardTimer: ReturnType<typeof setInterval> | null = null;
        const onData = (chunk: Buffer) => {
            stdin.off('data', onData);
            if (rawGuardTimer) clearInterval(rawGuardTimer);
            restoreStdin(stdin, stdinSnapshot);
            const s = chunk.toString('utf8');
            if (s === 'r' || s === 'R') resolve(true);
            else resolve(false);
        };
        ensureInteractiveStdin(stdin);
        rawGuardTimer = setInterval(() => ensureInteractiveStdin(stdin), 250);
        stdin.on('data', onData);
    });
}

async function runTurn(
    state: EngineState,
    input: string,
    cfg: ReturnType<typeof getConfig>,
    setUndo: (u: UndoEntry[]) => void,
): Promise<{ state: EngineState; connectionError: boolean; exitRequested?: boolean }> {
    const io = new TurnIO();
    const showDiff = false; // User requested: ไม่ต้องเอาโค้ดที่แก้มาให้ดู บอกแค่ไฟล์ กับบรรทัด + - พอ

    // open the framed round (sets the rail colour for all the report* output)
    beginRound(state.mode, input, state.exchanges.length);

    io.spinner.start('Thinking');
    io.enableEsc();

    let result: Awaited<ReturnType<typeof handleSubmit>>;
    try {
        result = await handleSubmit(state, input, {
            signal: io.ac.signal,
            onProgress: (label) => io.spinner.setText(label),
            onReadFile: (i) => { io.spinner.stop(); reportRead(i.path, i.lines); io.spinner.start('Working'); },
            onFileChange: (fc) => { io.spinner.stop(); reportFileChange(fc, showDiff); io.spinner.start('Working'); },
            onStrReplace: (r) => { io.spinner.stop(); reportStrReplace(r, showDiff); io.spinner.start('Working'); },
            onCommand: (r) => { io.spinner.stop(); reportCommand(r); io.spinner.start('Working'); },
            approveCommand: async (cmd, kind) => {
                if (kind === 'readonly' && cfg?.autoApproveReadonly) return true;
                if (kind === 'mutating' && cfg?.autoApproveMutating) return true;
                if (kind === 'dangerous' && cfg?.autoApproveDangerous) return true;
                io.spinner.stop();
                io.disableEsc();
                const ok = await confirmCommand(cmd, kind === 'dangerous' ? 'dangerous' : 'mutating');
                io.enableEsc();
                io.spinner.start('Working');
                return ok;
            },
        });
    } finally {
        io.spinner.stop();
        io.disableEsc();
    }

    if (io.exitRequested) {
        return { state: result.state, connectionError: false, exitRequested: true };
    }

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

        case 'config-info': {
            const cfg = getConfig({ quiet: true });
            if (!cfg) { errorBox('No configuration found. Run /config to set up.'); return { state }; }
            const provider = cfg.modelId?.split('/')[0] || '(not set)';
            const maskedKey = cfg.bearerToken
                ? cfg.bearerToken.slice(0, 6) + '••••••••' + cfg.bearerToken.slice(-4)
                : '(not set)';
            console.log('');
            console.log('  ' + chalk.hex(C.cyan).bold('Provider : ') + chalk.hex(C.green)(provider));
            console.log('  ' + chalk.hex(C.cyan).bold('Model    : ') + chalk.hex(C.green)(cfg.modelId || '(not set)'));
            console.log('  ' + chalk.hex(C.cyan).bold('Base URL : ') + chalk.hex(C.green)(cfg.baseUrl));
            console.log('  ' + chalk.hex(C.cyan).bold('API Key  : ') + chalk.hex(C.amber)(maskedKey));
            console.log('');
            return { state };
        }

        case 'config:provider': {
            const val = await promptConfigText('API Base URL', 'KOB_API_BASE_URL', 'https://www.kob-ai.dev');
            if (val !== null) banner('Provider URL updated', C.green);
            return { state };
        }

        case 'config:key': {
            const val = await promptConfigPassword('API key (kob_xxx:token)');
            if (val !== null) { loadEnv(); banner('API key updated', C.green); }
            return { state };
        }

        case 'config:model': {
            const chosen = await pickModel(state.model || '');
            if (chosen) {
                writeEnvFile({ KOB_MODEL_ID: chosen });
                process.env.KOB_MODEL_ID = chosen;
                state = { ...state, model: formatModel(chosen) };
                banner(`Model → ${chosen}`, C.amber);
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

        case 'project:list': {
            const projects = loadProjects();
            if (projects.length === 0) {
                banner('No projects found. Use /project:create to add one.', C.gray);
                return { state };
            }
            const pickedPath = await pickProject(projects);
            if (pickedPath) {
                if (existsSync(pickedPath)) {
                    process.chdir(pickedPath);
                    banner(`Switched to project at ${pickedPath}`, C.green);
                    // clear session context for the new project
                    const nextState = createInitialState(getConfig()!);
                    // replay history for the new directory
                    if (nextState.exchanges.length > 0) {
                        banner(`Resumed session · ${nextState.exchanges.length} previous rounds`, C.slate);
                        for (const e of nextState.exchanges.slice(-2)) replayExchange(e, nextState.exchanges.indexOf(e));
                    }
                    return { state: nextState, clearUndo: true };
                } else {
                    banner(`Directory not found: ${pickedPath}`, C.red);
                }
            }
            return { state };
        }

        case 'project:create': {
            const result = await promptProjectCreate();
            if (result) {
                if (!existsSync(result.path)) {
                    banner(`Warning: Directory does not exist (${result.path})`, C.amber);
                }
                addProject(result.name, result.path);
                banner(`Project "${result.name}" added`, C.green);
            }
            return { state };
        }

        case 'project:delete': {
            const projects = loadProjects();
            if (projects.length === 0) {
                banner('No projects to delete.', C.gray);
                return { state };
            }
            const pickedName = await pickProjectToDelete(projects);
            if (pickedName) {
                removeProject(pickedName);
                banner(`Project "${pickedName}" removed`, C.orange);
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

        case 'upgrade': {
            const r = await runUpgrade();
            if (r.visibleOutput.length > 0) {
                for (const line of r.visibleOutput) console.log('  ' + line);
            }
            if (r.ok) {
                const ver = r.fromVersion && r.fromVersion !== '?' ? ` (v${r.fromVersion} → v${r.toVersion})` : '';
                banner(`Successfully upgraded!${ver} Please restart KOB CLI to use the new version.`, C.green);
            } else {
                banner('Upgrade failed. Please try running "npm i -g kob-cli@latest" manually.', C.red);
            }
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
