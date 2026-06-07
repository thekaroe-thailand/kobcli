// THEME - colour palette + tiny helpers

import chalk from 'chalk';

export const C = {
    cyan: '#22d3ee',
    blue: '#38bdf8',
    violet: '#a78bfa',
    green: '#34d399',
    amber: '#fbbf24',
    pink: '#f472b6',
    red: '#ef4444',
    orange: '#fb923c',
    gray: '#9ca3af',
    slate: '#64748b',
} as const;

export const hex = (color: string) => chalk.hex(color);
export const dim = chalk.dim;
export const bold = chalk.bold;

/** Thai flag stripes (red/white/blue/white/red) as colored blocks. */
export function thaiFlag(): string {
    const r = chalk.hex('#A51931');
    const w = chalk.hex('#F4F5F8');
    const b = chalk.hex('#2D2A4A');
    return r('▀') + w('▀') + b('▀') + w('▀') + r('▀');
}

export function termWidth(): number {
    return Math.max(48, Math.min(process.stdout.columns || 80, 100));
}

/** Real terminal width (uncapped) — used for wrapping. */
export function contentWidth(): number {
    return Math.max(40, (process.stdout.columns || 80));
}

export function rule(width = termWidth(), char = '─'): string {
    return dim(char.repeat(width));
}

export function visibleLength(s: string): number {
    return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

export function padEndVisible(s: string, width: number): string {
    const len = visibleLength(s);
    return len >= width ? s : s + ' '.repeat(width - len);
}

export function truncateVisible(s: string, max: number): string {
    if (visibleLength(s) <= max) return s;
    return s.slice(0, max - 1) + '…';
}

/**
 * Word-wrap a (possibly ANSI-coloured) string to a visible width. Breaks at
 * whitespace; ANSI colour codes don't count toward the width. Returns the list
 * of wrapped lines (always at least one).
 */
export function wrapVisible(s: string, width: number): string[] {
    if (visibleLength(s) <= width) return [s];
    const tokens = s.split(/(\s+)/); // keep the separators
    const lines: string[] = [];
    let cur = '';
    let curLen = 0;
    for (const tok of tokens) {
        const tl = visibleLength(tok);
        if (curLen + tl > width && curLen > 0) {
            lines.push(cur);
            // drop leading whitespace at the start of a wrapped line
            if (/^\s+$/.test(tok)) { cur = ''; curLen = 0; }
            else { cur = tok; curLen = tl; }
        } else {
            cur += tok;
            curLen += tl;
        }
    }
    if (cur.trim() !== '' || lines.length === 0) lines.push(cur);
    return lines;
}

/**
 * Tell the terminal to STOP reporting mouse events. On Windows, enabling raw
 * mode turns on virtual-terminal input which makes the console deliver mouse
 * wheel/clicks as escape sequences into stdin — those leak into prompts as
 * junk like "65;44;42M" and steal the scroll wheel from the scrollback buffer.
 */
export function disableMouse(): void {
    if (process.stdout.isTTY) {
        process.stdout.write('\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1005l\x1b[?1006l\x1b[?1015l');
    }
}

/** Strip ANSI escape sequences and control characters from user input. */
export function sanitizeInput(s: string): string {
    return s
        .replace(/\x1b\[[0-9;<>?]*[ -/]*[@-~]/g, '')
        .replace(/<?\d{1,4};\d{1,4};\d{1,4}[mM]/g, '')
        .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
}
