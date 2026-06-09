// PROMPTS - interactive inputs (built on @clack/prompts)

import { text, select, confirm, password, isCancel, spinner, autocomplete } from '@clack/prompts';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { KobApiClient } from '../core/api.js';
import { getConfig } from '../core/config.js';
import { readEnvFile, writeEnvFile, describeEnvPath } from '../core/env-file.js';
import { formatModel } from '../core/engine.js';
import { C, dim, disableMouse, sanitizeInput, visibleLength, contentWidth } from './theme.js';
import chalk from 'chalk';

export { spinner, isCancel } from '@clack/prompts';

// ── prompt history (persisted to .kob/prompt_history.json) ──────────
const HISTORY_LIMIT = 100;
const HISTORY_FILE = path.join(process.cwd(), '.kob', 'prompt_history.json');

function loadPromptHistory(): string[] {
    try {
        if (!fs.existsSync(HISTORY_FILE)) return [];
        const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data?.entries)) return data.entries.filter((s: unknown) => typeof s === 'string');
    } catch { /* ignore */ }
    return [];
}

function savePromptHistory(entries: string[]): void {
    try {
        fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
        fs.writeFileSync(HISTORY_FILE, JSON.stringify({ entries }, null, 2), 'utf-8');
    } catch { /* ignore */ }
}

function recordPromptEntry(value: string): void {
    const trimmed = value.trim();
    if (!trimmed) return;
    const list = loadPromptHistory();
    if (list.length && list[list.length - 1] === trimmed) return; // no dupes
    list.push(trimmed);
    while (list.length > HISTORY_LIMIT) list.shift();
    savePromptHistory(list);
}

type SelectOption = {
    value: string;
    label: string;
    hint?: string;
};

const INPUT_CURSOR = chalk.hex(C.cyan).bold('_');
const INPUT_CURSOR_CHAR = '_';

const SLASH_OPTIONS = [
    { value: '/chat', label: '/chat     Open conversation' },
    { value: '/ask', label: '/ask      Q&A about your code' },
    { value: '/plan', label: '/plan     Architect a solution' },
    { value: '/code', label: '/code     Build & edit autonomously' },
    { value: '/models', label: '/models   Switch AI model' },
    { value: '/config', label: '/config   Edit .env settings' },
    { value: '/diff', label: '/diff     Show last changes' },
    { value: '/undo', label: '/undo     Revert last changes' },
    { value: '/git', label: '/git      Repo status' },
    { value: '/find', label: '/find     Find text in files' },
    { value: '/replace', label: '/replace  Replace text locally' },
    { value: '/open', label: '/open     Open and read a file' },
    { value: '/init', label: '/init     Scaffold AGENTS.md' },
    { value: '/tokens', label: '/tokens   Usage this session' },
    { value: '/project:list', label: '/project:list   List and switch projects' },
    { value: '/project:create', label: '/project:create Create a new project' },
    { value: '/project:delete', label: '/project:delete Remove a project' },
    { value: '/clear', label: '/clear    Clear session' },
    { value: '/help', label: '/help     Show all commands' },
    { value: '/upgrade', label: '/upgrade  Update KOB CLI to latest' },
    { value: '/exit', label: '/exit     Quit' },
];

export async function promptInput(message: string): Promise<string | null> {
    disableMouse();

    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        const result = await text({ message });
        if (isCancel(result)) return null;
        return sanitizeInput((result as string) ?? '');
    }

    return await new Promise<string | null>((resolve) => {
        const stdin = process.stdin;
        const stdout = process.stdout;
        const previousRawMode = stdin.isRaw;
        let value = '';
        let cursor = 0;
        let cursorVisible = true;
        let settled = false;
        let blinkTimer: NodeJS.Timeout | undefined;
        let renderedLines = 1;
        const promptHistory = loadPromptHistory();
        let historyIndex = -1;
        let tempValue = '';

        // ── slash-command suggestions ────────────────────────
        let showSuggestions = false;
        let suggestedCommands: typeof SLASH_OPTIONS = [];
        let selectedSuggestion = 0;
        let suggestionScrollOffset = 0; // index of first visible item

        /** How many suggestion rows fit below the prompt line. */
        const suggestionRows = () => {
            const termRows = process.stdout.rows || 24;
            // 1 row for the prompt itself, 1 margin
            return Math.max(3, termRows - 8);
        };

        const updateSuggestions = () => {
            if (!value.startsWith('/') || value === '/') {
                // Show all commands when only "/" is typed
                suggestedCommands = value === '/' ? SLASH_OPTIONS : [];
                showSuggestions = value === '/';
                selectedSuggestion = 0;
                suggestionScrollOffset = 0;
                return;
            }
            const partial = value.slice(1).toLowerCase();
            // Only show suggestions for partial command names (no arguments yet)
            if (partial.includes(' ')) {
                showSuggestions = false;
                return;
            }
            const filtered = SLASH_OPTIONS.filter((opt) => {
                const cmd = opt.value.slice(1).toLowerCase();
                return cmd.startsWith(partial);
            });
            suggestedCommands = filtered;
            showSuggestions = filtered.length > 0;
            selectedSuggestion = 0;
            suggestionScrollOffset = 0;
        };

        /** Ensure selectedSuggestion is within the visible scroll window. */
        const clampScroll = () => {
            const maxVisible = suggestionRows();
            if (selectedSuggestion < suggestionScrollOffset) {
                suggestionScrollOffset = selectedSuggestion;
            } else if (selectedSuggestion >= suggestionScrollOffset + maxVisible) {
                suggestionScrollOffset = selectedSuggestion - maxVisible + 1;
            }
        };

        // Count how many terminal rows the rendered prompt occupies so the
        // next render can move the cursor back and clear wrapped lines too.
        const countWrappedLines = (text: string): number => {
            const w = contentWidth();
            let count = 0;
            for (const line of text.split('\n')) {
                const len = visibleLength(line);
                count += Math.max(1, Math.ceil(len / w));
            }
            return count;
        };

        readline.emitKeypressEvents(stdin);
        stdin.setRawMode?.(true);
        stdin.resume();
        stdout.write('\x1b[?25l');

        const renderValue = () => {
            const before = value.slice(0, cursor);
            const current = value[cursor];
            const after = value.slice(cursor + 1);

            if (!cursorVisible) return value;
            if (cursor >= value.length) return `${before}${INPUT_CURSOR}`;
            return `${before}${chalk.hex(C.cyan).underline(current)}${after}`;
        };

        const render = () => {
            // Roll the cursor up to the first row of the previous render so
            // wrap lines (which `clearLine` alone can't reach) are wiped.
            if (renderedLines > 1) {
                readline.moveCursor(stdout, 0, -(renderedLines - 1));
            }
            readline.cursorTo(stdout, 0);
            readline.clearScreenDown(stdout);
            const content = value.length > 0 || cursorVisible ? renderValue() : ' ';
            const fullText = `${message} ${content}`;
            stdout.write(fullText);
            renderedLines = countWrappedLines(fullText);

            // ── slash-command suggestions ────────────────────────
            if (showSuggestions && suggestedCommands.length > 0) {
                const maxVisible = suggestionRows();
                const visible = suggestedCommands.slice(suggestionScrollOffset, suggestionScrollOffset + maxVisible);
                for (let i = 0; i < visible.length; i++) {
                    stdout.write('\n');
                    const opt = visible[i]!;
                    const isSelected = (suggestionScrollOffset + i) === selectedSuggestion;
                    const prefix = isSelected ? chalk.hex(C.cyan)('▸ ') : '  ';
                    const line = isSelected
                        ? chalk.bgHex('#1a3a4a').white(opt.label)
                        : chalk.hex(C.slate)(opt.label);
                    stdout.write(prefix + line);
                }
                // Show scroll indicator if there are more items
                const total = suggestedCommands.length;
                if (total > suggestionScrollOffset + visible.length) {
                    stdout.write('\n  ' + chalk.hex(C.slate)('↓ ' + (total - suggestionScrollOffset - visible.length) + ' more'));
                }
                renderedLines += visible.length;
                if (total > suggestionScrollOffset + visible.length) renderedLines += 1;
            }
        };

        const refreshCursor = () => {
            cursorVisible = true;
            render();
        };

        const cleanup = (newline = true) => {
            if (settled) return;
            settled = true;
            stdin.off('keypress', onKeypress);
            if (blinkTimer) clearInterval(blinkTimer);
            stdin.setRawMode?.(Boolean(previousRawMode));
            stdout.write('\x1b[?25h');
            if (newline) {
                // Move cursor below any wrapped prompt rows before the next
                // thing (banner / exchange / etc.) is written.
                for (let i = 0; i < renderedLines; i++) stdout.write('\n');
            }
        };

        const finish = (result: string | null, newline = true) => {
            cleanup(newline);
            resolve(result);
        };

        const onKeypress = async (sequence: string, key: { name?: string; ctrl?: boolean }) => {
            if (key.ctrl && key.name === 'c') {
                finish(null, false);
                console.log('\nExiting...');
                process.exit(130);
                return;
            }
            if (key.ctrl && key.name === 'a') {
                cursor = 0;
                refreshCursor();
                return;
            }
            if (key.ctrl && key.name === 'e') {
                cursor = value.length;
                refreshCursor();
                return;
            }
            if (key.name === 'escape') {
                if (showSuggestions) {
                    showSuggestions = false;
                    refreshCursor();
                    return;
                }
                // Escape without suggestions → let it fall through to the
                // sanity guard below, preserving existing behaviour.
            }
            if (key.name === 'return' || key.name === 'enter') {
                if (showSuggestions && suggestedCommands.length > 0) {
                    const chosen = suggestedCommands[selectedSuggestion];
                    if (chosen) {
                        const out = sanitizeInput(chosen.value);
                        recordPromptEntry(out);
                        finish(out);
                        return;
                    }
                }
                const out = sanitizeInput(value);
                recordPromptEntry(out);
                finish(out);
                return;
            }
            if (key.name === 'left') {
                cursor = Math.max(0, cursor - 1);
                refreshCursor();
                return;
            }
            if (key.name === 'right') {
                cursor = Math.min(value.length, cursor + 1);
                refreshCursor();
                return;
            }
            if (key.name === 'home') {
                cursor = 0;
                refreshCursor();
                return;
            }
            if (key.name === 'end') {
                cursor = value.length;
                refreshCursor();
                return;
            }
            if (key.name === 'backspace') {
                if (cursor > 0) {
                    value = value.slice(0, cursor - 1) + value.slice(cursor);
                    cursor -= 1;
                }
                updateSuggestions();
                refreshCursor();
                return;
            }
            if (key.name === 'delete') {
                if (cursor < value.length) {
                    value = value.slice(0, cursor) + value.slice(cursor + 1);
                }
                updateSuggestions();
                refreshCursor();
                return;
            }
            if (key.name === 'tab') {
                if (showSuggestions && suggestedCommands.length > 0) {
                    const chosen = suggestedCommands[selectedSuggestion] ?? suggestedCommands[0];
                    if (chosen) {
                        value = chosen.value;
                        cursor = value.length;
                        showSuggestions = false;
                        refreshCursor();
                        return;
                    }
                }
                return;
            }
            if (key.ctrl && key.name === 'u') {
                value = '';
                cursor = 0;
                updateSuggestions();
                refreshCursor();
                return;
            }

            // ── suggestion navigation (overrides history when suggestions visible) ─
            if (key.name === 'up') {
                if (showSuggestions && suggestedCommands.length > 0) {
                    selectedSuggestion = Math.max(0, selectedSuggestion - 1);
                    clampScroll();
                    refreshCursor();
                    return;
                }
                if (promptHistory.length === 0) return;
                if (historyIndex === -1) tempValue = value;
                historyIndex = Math.min(promptHistory.length - 1, historyIndex + 1);
                value = promptHistory[promptHistory.length - 1 - historyIndex] ?? '';
                cursor = value.length;
                refreshCursor();
                return;
            }
            if (key.name === 'down') {
                if (showSuggestions && suggestedCommands.length > 0) {
                    selectedSuggestion = Math.min(suggestedCommands.length - 1, selectedSuggestion + 1);
                    clampScroll();
                    refreshCursor();
                    return;
                }
                if (historyIndex <= -1) return;
                historyIndex -= 1;
                value = historyIndex === -1 ? tempValue : (promptHistory[promptHistory.length - 1 - historyIndex] ?? '');
                cursor = value.length;
                refreshCursor();
                return;
            }

            // Sanity guard: arrow keys / mouse / paste etc. may surface as escape
            // sequences or undefined on some terminals. Drop them silently.
            if (sequence === undefined || sequence === null) return;
            if (sequence.startsWith('\u001b')) return;
            if (sequence === '' || sequence.length === 0) return;

            // Typing a new char exits history-walk mode.
            if (historyIndex !== -1) {
                historyIndex = -1;
                tempValue = '';
            }

            value = value.slice(0, cursor) + sequence + value.slice(cursor);
            cursor += sequence.length;
            updateSuggestions();
            refreshCursor();
        };

        stdin.on('keypress', onKeypress);
        // No cursor blink — the terminal's own cursor blink + an underscore
        // glyph was doubling up and strobing at ~2 Hz. Static cursor is calmer.
        render();
    });
}

export async function pickSlashCommand(query?: string): Promise<string | null> {
    let queryText = sanitizeInput(query || '');

    while (true) {
        const search = await text({
            message: 'Command',
            placeholder: 'type /config or config',
            initialValue: queryText,
        });
        if (isCancel(search)) return null;

        queryText = sanitizeInput((search as string) ?? '');
        const raw = queryText.trim();
        const space = raw.search(/\s/);
        const commandToken = (space === -1 ? raw : raw.slice(0, space)).replace(/^\//, '');
        const normalized = commandToken.toLowerCase();
        const exact = normalized
            ? SLASH_OPTIONS.find((option) => option.value.slice(1).toLowerCase() === normalized)
            : undefined;

        if (exact) {
            const suffix = space === -1 ? '' : raw.slice(space);
            return exact.value + suffix;
        }

        const filtered = normalized
            ? SLASH_OPTIONS.filter((option) => {
                const command = option.value.slice(1).toLowerCase();
                const label = option.label.toLowerCase();
                return command.startsWith(normalized) || label.includes(normalized);
            })
            : SLASH_OPTIONS;

        if (filtered.length === 0) {
            console.log('  ' + chalk.hex(C.amber)('No commands match. Try another search.'));
            continue;
        }

        const result = await select({
            message: normalized ? `Commands (${filtered.length} matches)` : 'Commands',
            options: filtered,
            maxItems: 10,
        });
        if (isCancel(result)) continue;
        return result as string;
    }
}

export async function promptOpenFile(cwd: string): Promise<string | null> {
    const { listProjectFiles } = require('../tools/files.js');
    const { relative } = require('node:path');
    const files = listProjectFiles(cwd);
    if (files.length === 0) return null;
    
    const options = files.map((abs: string) => {
        const rel = relative(cwd, abs).replace(/\\/g, '/');
        return { value: rel, label: rel };
    });

    const result = await autocomplete({
        message: 'Select file to open / read',
        options,
    });

    if (isCancel(result)) return null;
    return result as string;
}

export async function promptSearchQuery(initialValue = ''): Promise<string | null> {
    const result = await text({
        message: 'Find text',
        placeholder: 'ข้อความที่ต้องการหา',
        initialValue,
    });
    if (isCancel(result)) return null;
    const query = sanitizeInput((result as string) ?? '').trim();
    return query || null;
}

export async function promptSearchAction(
    query: string,
    hasResults: boolean,
): Promise<'replace_all' | 'replace_file' | 'search_again' | 'done' | null> {
    const options = hasResults
        ? [
            { value: 'replace_all', label: `Replace all "${query}"` },
            { value: 'replace_file', label: 'Replace in one file' },
            { value: 'search_again', label: 'Search again' },
            { value: 'done', label: 'Done' },
        ]
        : [
            { value: 'search_again', label: 'Search again' },
            { value: 'done', label: 'Done' },
        ];
    const result = await select({
        message: hasResults ? 'What next?' : 'No matches. What next?',
        options,
        maxItems: 8,
    });
    if (isCancel(result)) return null;
    return result as 'replace_all' | 'replace_file' | 'search_again' | 'done';
}

export async function promptReplacementText(oldText: string): Promise<string | null> {
    const result = await text({
        message: `Replace "${oldText}" with`,
        placeholder: 'ข้อความใหม่',
    });
    if (isCancel(result)) return null;
    return sanitizeInput((result as string) ?? '');
}

export async function pickSearchFile(paths: string[]): Promise<string | null> {
    if (paths.length === 0) return null;
    const options = paths.map((path) => ({ value: path, label: path }));
    if (options.length > 12) return await pickSearchableOption('Select file to replace', options);
    const result = await select({
        message: 'Select file to replace',
        options,
        maxItems: 12,
    });
    if (isCancel(result)) return null;
    return result as string;
}

function filterOptions(options: SelectOption[], query: string): SelectOption[] {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    const exact: SelectOption[] = [];
    const prefix: SelectOption[] = [];
    const partial: SelectOption[] = [];

    for (const option of options) {
        const value = option.value.toLowerCase();
        const label = option.label.toLowerCase();
        const hint = (option.hint || '').toLowerCase();
        if (value === q || label === q) exact.push(option);
        else if (value.startsWith(q) || label.startsWith(q) || hint.startsWith(q)) prefix.push(option);
        else if (value.includes(q) || label.includes(q) || hint.includes(q)) partial.push(option);
    }

    return [...exact, ...prefix, ...partial];
}

async function pickSearchableOption(
    message: string,
    options: SelectOption[],
    current?: string,
): Promise<string | null> {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        let query = '';
        while (true) {
            const search = await text({
                message: `${message} search`,
                placeholder: 'type to filter, leave blank to show all',
                initialValue: query,
            });
            if (isCancel(search)) return null;

            query = sanitizeInput((search as string) ?? '');
            const filtered = filterOptions(options, query);
            if (filtered.length === 0) {
                console.log('  ' + chalk.hex(C.amber)('No matches found. Try another search.'));
                continue;
            }
            const result = await select({
                message: query ? `${message} (${filtered.length} matches)` : message,
                options: filtered.slice(0, 50),
                initialValue: current,
                maxItems: 12,
            });
            if (isCancel(result)) return null;
            return result as string;
        }
    }

    return await new Promise<string | null>((resolve) => {
        const stdin = process.stdin;
        const stdout = process.stdout;
        const previousRawMode = stdin.isRaw;
        let query = '';
        let cursor = 0;
        let cursorVisible = true;
        let renderedLines = 0;
        let settled = false;
        let blinkTimer: NodeJS.Timeout | undefined;
        let activeIndex = 0;
        let initialPositionSeeded = false;

        const renderInlineValue = () => {
            const before = query.slice(0, cursor);
            const currentChar = query[cursor];
            const after = query.slice(cursor + 1);
            if (!cursorVisible) return query || ' ';
            if (cursor >= query.length) return `${before}${INPUT_CURSOR}`;
            return `${before}${chalk.hex(C.cyan).underline(currentChar)}${after}`;
        };

        const getFiltered = () => filterOptions(options, query);

        const syncActiveIndex = () => {
            const filtered = getFiltered();
            if (filtered.length === 0) {
                activeIndex = 0;
                return filtered;
            }
            // Only auto-select current model on first render, not on every render
            if (!initialPositionSeeded && !query.trim() && current) {
                const preferred = filtered.findIndex((option) => option.value === current);
                if (preferred >= 0) activeIndex = preferred;
                initialPositionSeeded = true;
            }
            activeIndex = Math.max(0, Math.min(activeIndex, filtered.length - 1));
            return filtered;
        };

        const render = () => {
            const filtered = syncActiveIndex();
            const start = Math.min(
                Math.max(0, activeIndex - 4),
                Math.max(0, filtered.length - 10),
            );
            const visible = filtered.slice(start, start + 10);
            const activeVisibleIndex = activeIndex - start;
            const lines: string[] = [];
            lines.push(`  ${chalk.bold(message)}`);
            lines.push(`  ${chalk.hex(C.blue)('›')} ${dim('search')} ${renderInlineValue()}`);

            if (filtered.length === 0) {
                lines.push(`  ${chalk.hex(C.amber)('No matching models')}`);
            } else {
                lines.push(`  ${dim(`${filtered.length} matches`)}`);
                for (let i = 0; i < visible.length; i++) {
                    const option = visible[i]!;
                    const active = i === activeVisibleIndex;
                    const marker = active ? chalk.hex(C.green)('❯') : dim('·');
                    const label = active ? chalk.bold(option.label) : option.label;
                    const hint = option.hint ? dim(`  ${option.hint}`) : '';
                    lines.push(`  ${marker} ${label}${hint}`);
                }
                if (filtered.length > visible.length) lines.push(`  ${dim(`… ${activeIndex + 1}/${filtered.length}`)}`);
            }

            if (renderedLines > 0) {
                readline.moveCursor(stdout, 0, -(renderedLines - 1));
                readline.cursorTo(stdout, 0);
            }
            readline.clearScreenDown(stdout);
            stdout.write(lines.join('\n'));
            renderedLines = lines.length;
        };

        const cleanup = (newline = true) => {
            if (settled) return;
            settled = true;
            stdin.off('keypress', onKeypress);
            if (blinkTimer) clearInterval(blinkTimer);
            stdin.setRawMode?.(Boolean(previousRawMode));
            stdout.write('\x1b[?25h');
            if (newline) stdout.write('\n');
        };

        const onKeypress = (sequence: string, key: { name?: string; ctrl?: boolean }) => {
            if (key.ctrl && key.name === 'c') {
                cleanup();
                resolve(null);
                return;
            }
            if (key.name === 'escape') {
                cleanup();
                resolve(null);
                return;
            }
            if (key.ctrl && key.name === 'a') {
                cursor = 0;
                cursorVisible = true;
                render();
                return;
            }
            if (key.ctrl && key.name === 'e') {
                cursor = query.length;
                cursorVisible = true;
                render();
                return;
            }
            if (key.name === 'left') {
                cursor = Math.max(0, cursor - 1);
                cursorVisible = true;
                render();
                return;
            }
            if (key.name === 'right') {
                cursor = Math.min(query.length, cursor + 1);
                cursorVisible = true;
                render();
                return;
            }
            if (key.name === 'home') {
                cursor = 0;
                cursorVisible = true;
                render();
                return;
            }
            if (key.name === 'end') {
                cursor = query.length;
                cursorVisible = true;
                render();
                return;
            }
            if (key.name === 'up') {
                const filtered = getFiltered();
                if (filtered.length > 0) activeIndex = Math.max(0, activeIndex - 1);
                cursorVisible = true;
                render();
                return;
            }
            if (key.name === 'down') {
                const filtered = getFiltered();
                if (filtered.length > 0) activeIndex = Math.min(filtered.length - 1, activeIndex + 1);
                cursorVisible = true;
                render();
                return;
            }
            if (key.name === 'backspace') {
                if (cursor > 0) {
                    query = query.slice(0, cursor - 1) + query.slice(cursor);
                    cursor -= 1;
                    activeIndex = 0;
                }
                cursorVisible = true;
                render();
                return;
            }
            if (key.name === 'delete') {
                if (cursor < query.length) {
                    query = query.slice(0, cursor) + query.slice(cursor + 1);
                    activeIndex = 0;
                }
                cursorVisible = true;
                render();
                return;
            }
            if (key.name === 'return' || key.name === 'enter') {
                const filtered = getFiltered();
                const picked = filtered[Math.min(activeIndex, Math.max(filtered.length - 1, 0))];
                cleanup();
                resolve(picked?.value ?? null);
                return;
            }
            if (!sequence || sequence.startsWith('\u001b')) return;

            query = query.slice(0, cursor) + sequence + query.slice(cursor);
            cursor += sequence.length;
            activeIndex = 0;
            cursorVisible = true;
            render();
        };

        readline.emitKeypressEvents(stdin);
        stdin.setRawMode?.(true);
        stdin.resume();
        stdout.write('\x1b[?25l');
        stdin.on('keypress', onKeypress);
        // Static cursor — see promptInput for rationale.
        render();
    });
}

export async function confirmCommand(cmd: string, kind: 'mutating' | 'dangerous'): Promise<boolean> {
    const warn = kind === 'dangerous'
        ? chalk.hex(C.red)('⚠ potentially destructive command')
        : chalk.hex(C.amber)('run this command?');
    const result = await confirm({
        message: `${warn}\n    ${chalk.dim('$')} ${chalk.bold(cmd)}`,
        initialValue: kind !== 'dangerous',
    });
    if (isCancel(result)) return false;
    return result as boolean;
}

export async function pickModel(current: string): Promise<string | null> {
    const cfg = getConfig({ quiet: true });
    if (!cfg) return null;
    const s = spinner();
    s.start('Fetching models');
    let models: { id: string; display_name?: string; displayName?: string; provider?: string }[] = [];
    try {
        models = await new KobApiClient(cfg).listModels();
        s.stop(`Found ${models.length} models`);
    } catch {
        s.stop('Could not fetch models');
    }

    if (!models.length) {
        const manual = await text({ message: 'Enter model id (provider/model)', initialValue: current });
        if (isCancel(manual) || !manual) return null;
        return formatModel(sanitizeInput(manual as string));
    }

    const options = models.map(m => ({
        value: m.id,
        label: (m.display_name || m.displayName || m.id),
        hint: m.provider,
    }));
    const result = options.length > 12
        ? await pickSearchableOption('Select AI model', options, current)
        : await select({ message: 'Select AI model', options, initialValue: current, maxItems: 12 });
    if (isCancel(result)) return null;
    return formatModel(result as string);
}

export async function pickProject(projects: { name: string; path: string }[]): Promise<string | null> {
    if (projects.length === 0) return null;
    const options = projects.map(p => ({
        value: p.path,
        label: p.name,
        hint: p.path,
    }));
    const result = options.length > 12
        ? await pickSearchableOption('Select project', options)
        : await select({ message: 'Select project', options, maxItems: 12 });
    if (isCancel(result)) return null;
    return result as string;
}

export async function promptProjectCreate(): Promise<{ name: string; path: string } | null> {
    const nameResult = await text({ message: 'Project name', placeholder: 'my-awesome-project' });
    if (isCancel(nameResult) || !nameResult) return null;
    const name = sanitizeInput(nameResult as string).trim();

    const pathResult = await text({ message: 'Project absolute path', placeholder: process.cwd(), initialValue: process.cwd() });
    if (isCancel(pathResult) || !pathResult) return null;
    const projectPath = sanitizeInput(pathResult as string).trim();

    return { name, path: projectPath };
}

export async function pickProjectToDelete(projects: { name: string; path: string }[]): Promise<string | null> {
    if (projects.length === 0) return null;
    const options = projects.map(p => ({
        value: p.name,
        label: p.name,
        hint: p.path,
    }));
    const result = options.length > 12
        ? await pickSearchableOption('Select project to delete', options)
        : await select({ message: 'Select project to delete', options, maxItems: 12 });
    if (isCancel(result)) return null;
    return result as string;
}
export async function editConfig(): Promise<boolean> {
    const env = readEnvFile();
    console.log('  ' + chalk.dim('editing ' + describeEnvPath()));

    const key = await password({ message: 'API key (kob_xxx:token) — leave blank to keep current' });
    if (isCancel(key)) return false;

    const model = await text({
        message: 'Default model id',
        placeholder: env.KOB_MODEL_ID || 'deepseek/deepseek-v4-flash',
        initialValue: env.KOB_MODEL_ID || '',
    });
    if (isCancel(model)) return false;

    const url = await text({
        message: 'API base URL',
        placeholder: 'https://www.kob-ai.dev',
        initialValue: env.KOB_API_BASE_URL || 'https://www.kob-ai.dev',
    });
    if (isCancel(url)) return false;

    const updates: Record<string, string> = {};
    if (key) { updates.KOB_API_KEY = key as string; process.env.KOB_API_KEY = key as string; }
    if (model) { updates.KOB_MODEL_ID = sanitizeInput(model as string); process.env.KOB_MODEL_ID = updates.KOB_MODEL_ID; }
    if (url) { updates.KOB_API_BASE_URL = sanitizeInput(url as string); process.env.KOB_API_BASE_URL = updates.KOB_API_BASE_URL; }

    if (Object.keys(updates).length > 0) writeEnvFile(updates);
    return true;
}
