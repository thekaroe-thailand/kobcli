// ════════════════════════════════════════════════════════════
//  ENV FILE — read / write global config.env (preserving comments)
// ════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { ensureKobConfigDir, getGlobalEnvPath, getLegacyProjectEnvPath, resolveReadEnvPath } from './config-paths.js';

export function getEnvPath(): string {
    return resolveReadEnvPath();
}

export function readEnvFile(): Record<string, string> {
    const p = resolveReadEnvPath();
    if (!existsSync(p)) return {};
    return parseEnvText(readFileSync(p, 'utf-8'));
}

function parseEnvText(text: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.substring(0, eq).trim();
        let val = line.substring(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
        }
        out[key] = val;
    }
    return out;
}

export function writeEnvFile(updates: Record<string, string>, comments?: Record<string, string>): void {
    ensureKobConfigDir();
    const p = getGlobalEnvPath();
    const legacyPath = getLegacyProjectEnvPath();

    let content: string;
    if (existsSync(p)) content = readFileSync(p, 'utf-8');
    else if (legacyPath && existsSync(legacyPath)) content = readFileSync(legacyPath, 'utf-8');
    else content = '# KOB CLI v2 Configuration\n';

    const lines = content.split(/\r?\n/);
    const updatedKeys = new Set<string>();
    const out: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) { out.push(line); continue; }
        const eq = trimmed.indexOf('=');
        if (eq === -1) { out.push(line); continue; }
        const key = trimmed.substring(0, eq).trim();
        if (key in updates) {
            out.push(`${key}=${updates[key]}`);
            updatedKeys.add(key);
        } else {
            out.push(line);
        }
    }

    const toAppend = Object.entries(updates).filter(([k]) => !updatedKeys.has(k));
    if (toAppend.length > 0) {
        if (out.length > 0 && out[out.length - 1] !== '') out.push('');
        for (const [key, val] of toAppend) {
            if (comments && comments[key]) out.push(`# ${comments[key]}`);
            out.push(`${key}=${val}`);
        }
    }

    writeFileSync(p, out.join('\n'));
    try { chmodSync(p, 0o600); } catch { /* windows / unsupported fs */ }
}

export function describeEnvPath(): string {
    return getGlobalEnvPath();
}
