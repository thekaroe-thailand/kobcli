// ════════════════════════════════════════════════════════════
//  DIFF — minimal line diff with grouped hunks for preview
// ════════════════════════════════════════════════════════════

export type DiffLine = { type: 'add' | 'del' | 'ctx'; text: string };

/** Myers-ish LCS line diff. Good enough for compact previews. */
export function diffLines(oldStr: string, newStr: string): DiffLine[] {
    const a = oldStr.split('\n');
    const b = newStr.split('\n');
    const n = a.length;
    const m = b.length;

    // LCS table (cap to keep memory sane on huge files)
    const CAP = 4000;
    if (n > CAP || m > CAP) {
        // fall back to whole-block replace
        return [
            ...a.map<DiffLine>(t => ({ type: 'del', text: t })),
            ...b.map<DiffLine>(t => ({ type: 'add', text: t })),
        ];
    }

    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
        }
    }

    const out: DiffLine[] = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) { out.push({ type: 'ctx', text: a[i]! }); i++; j++; }
        else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) { out.push({ type: 'del', text: a[i]! }); i++; }
        else { out.push({ type: 'add', text: b[j]! }); j++; }
    }
    while (i < n) { out.push({ type: 'del', text: a[i++]! }); }
    while (j < m) { out.push({ type: 'add', text: b[j++]! }); }
    return out;
}

/** Collapse long runs of context to keep previews short. */
export function compactHunks(lines: DiffLine[], context = 2): DiffLine[] {
    const keep = new Array(lines.length).fill(false);
    for (let i = 0; i < lines.length; i++) {
        if (lines[i]!.type !== 'ctx') {
            for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = true;
        }
    }
    const out: DiffLine[] = [];
    let gap = false;
    for (let i = 0; i < lines.length; i++) {
        if (keep[i]) { out.push(lines[i]!); gap = false; }
        else if (!gap) { out.push({ type: 'ctx', text: '⋯' }); gap = true; }
    }
    return out;
}

export function diffStats(lines: DiffLine[]): { add: number; del: number } {
    let add = 0, del = 0;
    for (const l of lines) { if (l.type === 'add') add++; else if (l.type === 'del') del++; }
    return { add, del };
}
