// ════════════════════════════════════════════════════════════
//  FILES — safe file operations scoped to the project root
// ════════════════════════════════════════════════════════════

import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname, join, basename, extname } from 'node:path';
import type { FileChange, StrReplaceResult } from '../core/types.js';

function isInsideRoot(abs: string, root: string): boolean {
    const a = abs.replace(/\\/g, '/').toLowerCase();
    const r = root.replace(/\\/g, '/').toLowerCase();
    return a === r || a.startsWith(r + '/');
}

function sanitizeRelative(name: string): string {
    return name.replace(/^[/\\]+/, '').replace(/\.\.[/\\]/g, '').replace(/\\/g, '/');
}

export function safeReadFile(filePath: string, cwd: string): string {
    const root = resolve(cwd);
    const abs = resolve(cwd, sanitizeRelative(filePath));
    if (!isInsideRoot(abs, root)) return `[ERROR: path traversal rejected for "${filePath}"]`;
    if (!existsSync(abs)) return `[ERROR: file not found: "${filePath}"]`;
    try { return readFileSync(abs, 'utf-8'); }
    catch (e) { return `[ERROR reading "${filePath}": ${(e as Error).message}]`; }
}

/** Create / overwrite a file. Returns the change record (with previous content). */
export function writeFile(filename: string, content: string, cwd: string): FileChange {
    const root = resolve(cwd);
    const safe = sanitizeRelative(filename);
    const abs = resolve(cwd, safe);
    if (!isInsideRoot(abs, root)) {
        throw new Error(`Security: refusing to write outside project: ${filename}`);
    }
    const existed = existsSync(abs);
    const previous = existed ? readFileSync(abs, 'utf-8') : undefined;
    const dir = dirname(abs);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(abs, content, 'utf-8');

    const newLines = content.split('\n').length;
    const oldLines = previous ? previous.split('\n').length : 0;
    return {
        filename: safe,
        content,
        addLines: existed ? Math.max(0, newLines - oldLines) : newLines,
        delLines: existed ? Math.max(0, oldLines - newLines) : 0,
        previous,
        existed,
    };
}

export function applyStrReplace(filePath: string, oldStr: string, newStr: string, cwd: string): StrReplaceResult {
    const root = resolve(cwd);
    const safe = sanitizeRelative(filePath);
    const abs = resolve(cwd, safe);
    if (!isInsideRoot(abs, root)) return { path: filePath, ok: false, addLines: 0, delLines: 0, error: 'path traversal rejected' };
    if (!existsSync(abs)) return { path: filePath, ok: false, addLines: 0, delLines: 0, error: 'file not found' };
    try {
        const content = readFileSync(abs, 'utf-8');
        const idx = content.indexOf(oldStr);
        if (idx === -1) return { path: filePath, ok: false, addLines: 0, delLines: 0, error: 'old_str not found' };
        if (content.indexOf(oldStr, idx + 1) !== -1) {
            return { path: filePath, ok: false, addLines: 0, delLines: 0, error: 'old_str is not unique' };
        }
        const next = content.slice(0, idx) + newStr + content.slice(idx + oldStr.length);
        writeFileSync(abs, next, 'utf-8');
        return {
            path: safe,
            ok: true,
            addLines: newStr.split('\n').length,
            delLines: oldStr.split('\n').length,
            previous: content,
            next,
        };
    } catch (e) {
        return { path: filePath, ok: false, addLines: 0, delLines: 0, error: (e as Error).message };
    }
}

/** Restore a file to a previous state (used by /undo). null = delete/recreate empty. */
export function restoreFile(filePath: string, previous: string | null, cwd: string): boolean {
    const root = resolve(cwd);
    const abs = resolve(cwd, sanitizeRelative(filePath));
    if (!isInsideRoot(abs, root)) return false;
    try {
        if (previous === null) {
            // file didn't exist before — remove it
            if (existsSync(abs)) unlinkSync(abs);
            return true;
        }
        writeFileSync(abs, previous, 'utf-8');
        return true;
    } catch { return false; }
}

const IGNORE = new Set(['node_modules', 'dist', 'build', '.git', '.next', '.cache', 'coverage', '.turbo', 'vendor', '__pycache__']);
const MAX_TEXT_FILE_BYTES = 1024 * 1024;
const SEARCH_IGNORE_DIRS = new Set(['docs']);
const SEARCH_SKIP_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.log', '.rst', '.adoc']);
const SEARCH_SKIP_BASENAMES = new Set([
    'agents.md',
    'readme',
    'readme.md',
    'license',
    'license.md',
    'license.txt',
    'install.md',
    'manual.md',
    'quickstart.md',
    'project.md',
    'spects.md',
    'changelog',
    'changelog.md',
]);

export interface TextSearchHit {
    line: number;
    column: number;
    preview: string;
}

export interface TextSearchFileResult {
    path: string;
    totalMatches: number;
    hits: TextSearchHit[];
}

export interface TextSearchResult {
    query: string;
    files: TextSearchFileResult[];
    totalFiles: number;
    totalMatches: number;
    scannedFiles: number;
}

export interface BulkReplaceFileResult extends StrReplaceResult {
    replacements: number;
}

function shouldIgnoreEntry(name: string): boolean {
    return name.startsWith('.') || IGNORE.has(name);
}

function shouldIncludeSearchFile(abs: string, cwd: string): boolean {
    const rel = abs.slice(resolve(cwd).length + 1).replace(/\\/g, '/').toLowerCase();
    const base = basename(abs).toLowerCase();
    const ext = extname(base).toLowerCase();
    if (rel.startsWith('docs/')) return false;
    if (SEARCH_SKIP_BASENAMES.has(base)) return false;
    if (SEARCH_SKIP_EXTENSIONS.has(ext)) return false;
    return true;
}

export function listProjectFiles(cwd: string, options?: { searchOnly?: boolean }): string[] {
    const files: string[] = [];
    const searchOnly = options?.searchOnly === true;

    function walk(dir: string): void {
        let entries: string[];
        try { entries = readdirSync(dir); } catch { return; }

        for (const entry of entries.sort()) {
            if (shouldIgnoreEntry(entry)) continue;
            if (searchOnly && SEARCH_IGNORE_DIRS.has(entry)) continue;
            const full = join(dir, entry);
            try {
                const st = statSync(full);
                if (st.isDirectory()) walk(full);
                else if (!searchOnly || shouldIncludeSearchFile(full, cwd)) files.push(full);
            } catch { /* skip unreadable entries */ }
        }
    }

    walk(cwd);
    return files;
}

function readTextFile(abs: string): string | null {
    try {
        const st = statSync(abs);
        if (!st.isFile() || st.size > MAX_TEXT_FILE_BYTES) return null;
        const buf = readFileSync(abs);
        if (buf.includes(0)) return null;
        return buf.toString('utf-8');
    } catch {
        return null;
    }
}

function previewLine(line: string, max = 180): string {
    const normalized = line.replace(/\t/g, '    ').trim();
    return normalized.length > max ? normalized.slice(0, max - 1) + '…' : normalized;
}

function countOccurrences(haystack: string, needle: string): number {
    if (!needle) return 0;
    let count = 0;
    let from = 0;
    while (true) {
        const idx = haystack.indexOf(needle, from);
        if (idx === -1) return count;
        count++;
        from = idx + needle.length;
    }
}

export function searchTextInFiles(query: string, cwd: string, maxHitsPerFile = 3): TextSearchResult {
    const needle = query;
    const files: TextSearchFileResult[] = [];
    let scannedFiles = 0;
    let totalMatches = 0;

    for (const abs of listProjectFiles(cwd, { searchOnly: true })) {
        const text = readTextFile(abs);
        if (text === null) continue;
        scannedFiles++;

        const lines = text.split('\n');
        const hits: TextSearchHit[] = [];
        let fileMatches = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!;
            let from = 0;
            while (true) {
                const idx = line.indexOf(needle, from);
                if (idx === -1) break;
                fileMatches++;
                if (hits.length < maxHitsPerFile) {
                    hits.push({
                        line: i + 1,
                        column: idx + 1,
                        preview: previewLine(line),
                    });
                }
                from = idx + needle.length;
            }
        }

        if (fileMatches > 0) {
            totalMatches += fileMatches;
            files.push({
                path: abs.slice(resolve(cwd).length + 1).replace(/\\/g, '/'),
                totalMatches: fileMatches,
                hits,
            });
        }
    }

    return {
        query,
        files,
        totalFiles: files.length,
        totalMatches,
        scannedFiles,
    };
}

export function replaceTextInFiles(oldText: string, newText: string, cwd: string, paths?: string[]): BulkReplaceFileResult[] {
    if (!oldText) return [];
    const root = resolve(cwd);
    const scope = paths && paths.length > 0
        ? paths.map((path) => resolve(cwd, sanitizeRelative(path)))
        : listProjectFiles(cwd, { searchOnly: true });
    const results: BulkReplaceFileResult[] = [];

    for (const abs of scope) {
        if (!isInsideRoot(abs, root)) continue;
        const text = readTextFile(abs);
        if (text === null) continue;

        const replacements = countOccurrences(text, oldText);
        if (replacements === 0) continue;

        const next = text.split(oldText).join(newText);
        writeFileSync(abs, next, 'utf-8');
        results.push({
            path: abs.slice(root.length + 1).replace(/\\/g, '/'),
            ok: true,
            addLines: Math.max(0, newText.split('\n').length - oldText.split('\n').length),
            delLines: Math.max(0, oldText.split('\n').length - newText.split('\n').length),
            previous: text,
            next,
            replacements,
        });
    }

    return results;
}

export function generateFileTree(cwd: string, maxDepth = 5, maxPerDir = 120): string {
    function walk(dir: string, depth: number, prefix: string): string {
        if (depth > maxDepth) return '';
        let entries: string[];
        try { entries = readdirSync(dir); } catch { return ''; }
        entries = entries.filter(e => !shouldIgnoreEntry(e)).sort();
        if (entries.length > maxPerDir) entries = entries.slice(0, maxPerDir);
        let result = '';
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i]!;
            const isLast = i === entries.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const full = join(dir, entry);
            try {
                const st = statSync(full);
                if (st.isDirectory()) {
                    result += `${prefix}${connector}${entry}/\n`;
                    result += walk(full, depth + 1, prefix + (isLast ? '    ' : '│   '));
                } else {
                    result += `${prefix}${connector}${entry}\n`;
                }
            } catch {
                result += `${prefix}${connector}${entry}\n`;
            }
        }
        return result;
    }
    return walk(cwd, 0, '').replace(/\\/g, '/').trimEnd();
}

export function normalizeRelPath(p: string): string {
    return p.replace(/^[/\\]+/, '').replace(/\\/g, '/');
}
