// ════════════════════════════════════════════════════════════
//  CONFIG — load + validate runtime configuration
// ════════════════════════════════════════════════════════════

import type { CliConfig } from './types.js';
import { describeEnvPath, readEnvFile } from './env-file.js';

/**
 * Load the KOB config file into process.env. We intentionally mirror the
 * global config here so project-local dotenv files do not shadow it.
 */
export function loadEnv(): void {
    const fromFile = readEnvFile();
    for (const [k, v] of Object.entries(fromFile)) {
        process.env[k] = v;
    }
}

export function getConfig(options?: { quiet?: boolean }): CliConfig | null {
    const fileEnv = readEnvFile();
    let baseUrl = fileEnv.KOB_API_BASE_URL || process.env.KOB_API_BASE_URL || 'https://www.kob-ai.dev';
    // strip trailing /v1, /v2 subpaths and trailing slashes — endpoints are absolute
    baseUrl = baseUrl.replace(/\/v\d+\/?$/, '').replace(/\/+$/, '');

    const rawKey = fileEnv.KOB_API_KEY || process.env.KOB_API_KEY || '';
    const modelId = fileEnv.KOB_MODEL_ID || process.env.KOB_MODEL_ID;
    const maxTokens = Number(fileEnv.KOB_MAX_TOKENS || process.env.KOB_MAX_TOKENS) || 16384;
    const autoApproveReadonly = (
        fileEnv.KOB_AUTO_APPROVE_READONLY
        || process.env.KOB_AUTO_APPROVE_READONLY
        || 'true'
    ).toLowerCase() !== 'false';

    const autoApproveMutating = (
        fileEnv.KOB_AUTO_APPROVE_MUTATING
        || process.env.KOB_AUTO_APPROVE_MUTATING
        || 'true'
    ).toLowerCase() !== 'false';

    const autoApproveDangerous = (
        fileEnv.KOB_AUTO_APPROVE_DANGEROUS
        || process.env.KOB_AUTO_APPROVE_DANGEROUS
        || 'true'
    ).toLowerCase() !== 'false';

    const enableThinking = (
        fileEnv.KOB_ENABLE_THINKING
        || process.env.KOB_ENABLE_THINKING
        || 'auto'
    ).toLowerCase() !== 'false';

    if (!rawKey) {
        if (!options?.quiet) {
            console.error('\n  ✗ KOB_API_KEY is not set.');
            console.error(`    Configure ${describeEnvPath()} or run:  kob config\n`);
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
        autoApproveMutating,
        autoApproveDangerous,
        enableThinking,
    };
}

/** Get config or exit the process with a friendly message. */
export function requireConfig(): CliConfig {
    const cfg = getConfig();
    if (!cfg) process.exit(1);
    return cfg;
}
