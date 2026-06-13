// ════════════════════════════════════════════════════════════
//  HISTORY — persist a session per project (cwd-scoped)
// ════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import type { Exchange, ChatMessage } from './types.js';

function sessionsDir(): string {
    const dir = join(homedir(), '.kob-cli', 'sessions');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
}

function sessionFile(): string {
    // Normalize path to lowercase to handle Windows case-insensitivity
    // (e.g. C:\Project vs C:\project should share the same session)
    const cwd = process.cwd().toLowerCase();
    const hash = createHash('sha1').update(cwd).digest('hex').slice(0, 16);
    return join(sessionsDir(), `${hash}.json`);
}

export interface SessionData {
    exchanges: Exchange[];
    messages: ChatMessage[];
    model?: string;
}

export function loadHistory(): SessionData {
    try {
        const p = sessionFile();
        if (!existsSync(p)) return { exchanges: [], messages: [] };
        const data = JSON.parse(readFileSync(p, 'utf-8'));
        return {
            exchanges: Array.isArray(data.exchanges) ? data.exchanges : [],
            messages: Array.isArray(data.messages) ? data.messages : [],
            model: typeof data.model === 'string' ? data.model : undefined,
        };
    } catch {
        return { exchanges: [], messages: [] };
    }
}

export function saveHistory(exchanges: Exchange[], messages: ChatMessage[], model?: string): void {
    try {
        // keep the transcript from ballooning: cap stored context
        const trimmedMessages = messages.slice(-60);
        writeFileSync(sessionFile(), JSON.stringify({ exchanges: exchanges.slice(-40), messages: trimmedMessages, model }, null, 0));
    } catch { /* non-fatal */ }
}

export function clearHistory(): void {
    try {
        const p = sessionFile();
        if (existsSync(p)) writeFileSync(p, JSON.stringify({ exchanges: [], messages: [] }));
    } catch { /* non-fatal */ }
}
