// ════════════════════════════════════════════════════════════
//  SHELL — run commands with read-only auto-approve + classifier
// ════════════════════════════════════════════════════════════

import { spawnSync } from 'node:child_process';
import type { CommandResult } from '../core/types.js';

const READONLY_PREFIXES = [
    'ls', 'dir', 'pwd', 'cat', 'type', 'head', 'tail', 'echo', 'find', 'grep', 'rg',
    'git status', 'git log', 'git diff', 'git branch', 'git show', 'git remote',
    'node -v', 'node --version', 'npm -v', 'npm --version', 'bun -v', 'python --version',
    'which', 'where', 'wc', 'tree', 'stat', 'file', 'du', 'df', 'whoami', 'date', 'env',
];

const DANGEROUS = [
    /\brm\s+-rf?\b/, /\brmdir\b/, /\bdel\s+\/[sf]/i, /\bformat\b/i, /\bmkfs/,
    />\s*\/dev\/sd/, /:\(\)\s*\{/, /\bdd\s+if=/, /\bshutdown\b/, /\breboot\b/,
    /\bgit\s+push\s+.*--force/, /\bgit\s+reset\s+--hard/, /\bcurl\b.*\|\s*(sh|bash)/, /\bwget\b.*\|\s*(sh|bash)/,
];

export function isReadonly(cmd: string): boolean {
    const c = cmd.trim().toLowerCase();
    return READONLY_PREFIXES.some(p => c === p || c.startsWith(p + ' '));
}

export function isDangerous(cmd: string): boolean {
    return DANGEROUS.some(re => re.test(cmd));
}

export function runShellCommand(cmd: string, cwd: string): CommandResult {
    const t0 = Date.now();
    const MAX_OUT = 100_000;
    try {
        const r = spawnSync(cmd, [], { cwd, shell: true, encoding: 'utf-8', maxBuffer: MAX_OUT, timeout: 120_000 });
        return {
            cmd,
            ok: r.status === 0,
            stdout: (r.stdout || '').slice(0, MAX_OUT),
            stderr: (r.stderr || '').slice(0, MAX_OUT),
            durationMs: Date.now() - t0,
            exitCode: r.status ?? -1,
        };
    } catch (e) {
        return { cmd, ok: false, stdout: '', stderr: (e as Error).message, durationMs: Date.now() - t0, exitCode: -1 };
    }
}

export function skippedResult(cmd: string): CommandResult {
    return { cmd, ok: false, stdout: '', stderr: 'skipped by user', durationMs: 0, exitCode: -1, skipped: true };
}
