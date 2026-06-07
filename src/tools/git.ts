// ════════════════════════════════════════════════════════════
//  GIT — lightweight git awareness for the status bar
// ════════════════════════════════════════════════════════════

import { spawnSync } from 'node:child_process';

function git(args: string[], cwd: string): string | null {
    try {
        const r = spawnSync('git', args, { cwd, encoding: 'utf-8', timeout: 4000 });
        if (r.status !== 0) return null;
        return (r.stdout || '').trim();
    } catch { return null; }
}

export interface GitInfo {
    isRepo: boolean;
    branch?: string;
    dirty: number;   // number of changed files
    ahead?: number;
    behind?: number;
}

export function getGitInfo(cwd: string): GitInfo {
    const inside = git(['rev-parse', '--is-inside-work-tree'], cwd);
    if (inside !== 'true') return { isRepo: false, dirty: 0 };

    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd) || undefined;
    const status = git(['status', '--porcelain'], cwd);
    const dirty = status ? status.split('\n').filter(Boolean).length : 0;

    let ahead: number | undefined;
    let behind: number | undefined;
    const counts = git(['rev-list', '--left-right', '--count', '@{upstream}...HEAD'], cwd);
    if (counts) {
        const parts = counts.split(/\s+/).map(Number);
        if (parts.length === 2) { behind = parts[0]; ahead = parts[1]; }
    }
    return { isRepo: true, branch, dirty, ahead, behind };
}
