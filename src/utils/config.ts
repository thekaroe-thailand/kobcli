import type { CliConfig } from '../types/index.js';

export function getConfig(): CliConfig {
    const baseUrl = process.env.KOB_API_BASE_URL || 'https://kob-ai.com';
    const apiKey = process.env.KOB_API_KEY;
    const apiToken = process.env.KOB_API_TOKEN;

    if (!apiKey || !apiToken) {
        console.error('❌ Error: KOB_API_KEY and KOB_API_TOKEN environment variables are required');
        console.error('Please set them in your .env file or export them in your shell');
        console.error('Example:');
        console.error('  export KOB_API_KEY=kob_your_key');
        console.error('  export KOB_API_TOKEN=your_token');
        process.exit(1);
    }

    return {
        baseUrl,
        apiKey,
        apiToken,
    };
}

export function validateConfig(config: CliConfig): void {
    if (!config.baseUrl) {
        console.error('❌ Error: KOB_API_BASE_URL is not set');
        process.exit(1);
    }

    if (!config.apiKey) {
        console.error('❌ Error: KOB_API_KEY is not set');
        process.exit(1);
    }

    if (!config.apiToken) {
        console.error('❌ Error: KOB_API_TOKEN is not set');
        process.exit(1);
    }
}
