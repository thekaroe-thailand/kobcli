// ════════════════════════════════════════════════════════════
//  CONFIG — load + validate runtime configuration
// ════════════════════════════════════════════════════════════

import type { CliConfig } from './types.js';
import { readEnvFile } from './env-file.js';

/**
 * Load .env.local / .env into process.env (Bun does this automatically, but
 * when running under node/tsx we must do it ourselves). Existing process.env
 * values win so real shell exports are not clobbered.
 */
export function loadEnv(): void {
    const fromFile = readEnvFile();
    for (const [k, v] of Object.entries(fromFile)) {
        if (process.env[k] === undefined) process.env[k] = v;
    }
}

export function getConfig(options?: { quiet?: boolean }): CliConfig | null {
    let baseUrl = process.env.KOB_API_BASE_URL || 'https://www.kob-ai.dev';
    // strip trailing /v1, /v2 subpaths and trailing slashes — endpoints are absolute
    baseUrl = baseUrl.replace(/\/v\d+\/?$/, '').replace(/\/+$/, '');

    const rawKey = process.env.KOB_API_KEY || '';
    const modelId = process.env.KOB_MODEL_ID;
    const maxTokens = Number(process.env.KOB_MAX_TOKENS) || 16384;
    const autoApproveReadonly = (process.env.KOB_AUTO_APPROVE_READONLY ?? 'true').toLowerCase() !== 'false';

    if (!rawKey) {
        if (!options?.quiet) {
            console.error('\n  ✗ KOB_API_KEY is not set.');
            console.error('    Add it to .env.local or run:  kob config\n');
        }
        return null;
    }

    const colonIndex = rawKey.indexOf(':');
    const apiKey = colonIndex !== -1 ? rawKey.substring(0, colonIndex) : rawKey;
    const apiToken = colonIndex !== -1 ? rawKey.substring(colonIndex + 1) : undefined;

    return {
        baseUrl,
        apiKey,
        apiToken,
        bearerToken: rawKey,
        modelId: modelId || undefined,
        maxTokens,
        autoApproveReadonly,
    };
}

/** Get config or exit the process with a friendly message. */
export function requireConfig(): CliConfig {
    const cfg = getConfig();
    if (!cfg) process.exit(1);
    return cfg;
}
