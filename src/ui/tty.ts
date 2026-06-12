import { disableMouse } from './theme.js';

export interface StdinSnapshot {
    rawMode: boolean;
    paused: boolean;
}

export function snapshotStdin(stdin: NodeJS.ReadStream = process.stdin): StdinSnapshot {
    return {
        rawMode: Boolean(stdin.isRaw),
        paused: typeof stdin.isPaused === 'function' ? stdin.isPaused() : false,
    };
}

export function ensureInteractiveStdin(stdin: NodeJS.ReadStream = process.stdin): void {
    if (!stdin.isTTY) return;
    try { stdin.setRawMode?.(true); } catch { /* keep going */ }
    if (typeof stdin.isPaused === 'function' && stdin.isPaused()) stdin.resume();
    disableMouse();
}

export function restoreStdin(stdin: NodeJS.ReadStream, snapshot: StdinSnapshot): void {
    if (!stdin.isTTY) return;
    try { stdin.setRawMode?.(snapshot.rawMode); } catch { /* */ }
    if (snapshot.paused) stdin.pause();
    else stdin.resume();
}
