import { readFileSync, writeFileSync, existsSync, chmodSync } from 'fs';
import { ensureKobConfigDir, getGlobalEnvPath, getLegacyProjectEnvPath, resolveReadEnvPath } from '../core/config-paths.js';

/**
 * Find the config file path the CLI should read.
 * Prefers the global ~/.kob-cli/config.env file, and falls back to a legacy
 * project-local .env.local / .env only while migrating older installs.
 */
export function getEnvPath(): string {
    return resolveReadEnvPath();
}

/**
 * Parse a .env file into a key→value map. Preserves comments internally
 * (so we can keep them when rewriting), but only returns the values.
 */
export function readEnvFile(): Record<string, string> {
    const p = resolveReadEnvPath();
    if (!existsSync(p)) return {};
    const content = readFileSync(p, 'utf-8');
    return parseEnvText(content);
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
        // Strip surrounding quotes
        if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
        ) {
            val = val.substring(1, val.length - 1);
        }
        out[key] = val;
    }
    return out;
}

/**
 * Update keys in the global config file.
 * - Preserves comments, blank lines, and key ordering.
 * - If a key exists, its line is replaced in place.
 * - If a key is missing, it is appended to the end (with a blank line separator).
 * - If the global file doesn't exist yet, seeds it from a legacy local env
 *   file when present so older installs migrate forward cleanly.
 *
 * @param updates  key→value map of entries to set
 * @param comments optional key→comment map for newly-appended keys
 */
export function writeEnvFile(
    updates: Record<string, string>,
    comments?: Record<string, string>
): void {
    ensureKobConfigDir();
    const p = getGlobalEnvPath();
    const legacyPath = getLegacyProjectEnvPath();

    let content: string;
    if (existsSync(p)) {
        content = readFileSync(p, 'utf-8');
    } else if (legacyPath && existsSync(legacyPath)) {
        content = readFileSync(legacyPath, 'utf-8');
    } else {
        content = '# KOB AI Configuration\n';
    }

    const lines = content.split(/\r?\n/);
    const updatedKeys = new Set<string>();
    const out: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            out.push(line);
            continue;
        }
        const eq = trimmed.indexOf('=');
        if (eq === -1) {
            out.push(line);
            continue;
        }
        const key = trimmed.substring(0, eq).trim();
        if (key in updates) {
            out.push(`${key}=${updates[key]}`);
            updatedKeys.add(key);
        } else {
            out.push(line);
        }
    }

    // Append any keys that weren't already present
    const toAppend = Object.entries(updates).filter(([k]) => !updatedKeys.has(k));
    if (toAppend.length > 0) {
        if (out.length > 0 && out[out.length - 1] !== '') out.push('');
        for (const [key, val] of toAppend) {
            if (comments && comments[key]) {
                out.push(`# ${comments[key]}`);
            }
            out.push(`${key}=${val}`);
        }
    }

    writeFileSync(p, out.join('\n'));

    // SECURITY: Lock down the .env file so other users on the same machine
    // can't read the API key. On Windows, chmod has limited effect, but on
    // POSIX systems this changes mode from default 0644 (world-readable) to
    // 0600 (owner read/write only). Failure to chmod is non-fatal.
    try {
        chmodSync(p, 0o600);
    } catch {
        // ignore — Windows or filesystem doesn't support it
    }
}

/**
 * Get the human-readable path the CLI is reading from.
 * Useful for UI hints (e.g. "/config" form).
 */
export function describeEnvPath(): string {
    return getGlobalEnvPath();
}
