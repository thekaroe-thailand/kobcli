import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const LEGACY_ENV_CANDIDATES = ['.env.local', '.env'];

export function getKobConfigDir(): string {
    return join(homedir(), '.kob-cli');
}

export function ensureKobConfigDir(): string {
    const dir = getKobConfigDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
}

export function getGlobalEnvPath(): string {
    return join(getKobConfigDir(), 'config.env');
}

export function getLegacyProjectEnvPath(cwd = process.cwd()): string | null {
    for (const name of LEGACY_ENV_CANDIDATES) {
        const p = join(cwd, name);
        if (existsSync(p)) return p;
    }
    return null;
}

export function resolveReadEnvPath(cwd = process.cwd()): string {
    const globalPath = getGlobalEnvPath();
    if (existsSync(globalPath)) return globalPath;
    return getLegacyProjectEnvPath(cwd) || globalPath;
}
