// API - KOB AI client (OpenAI-compatible, streaming)

import type { CliConfig, ChatMessage } from './types.js';

export class ApiError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 500) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
    }
}

export interface ChatCompletionChunk {
    id: string;
    model: string;
    provider?: string;
    choices: {
        index: number;
        delta: { content?: string; role?: string };
        finish_reason: string | null;
    }[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface ModelInfo {
    id: string;
    display_name?: string;
    displayName?: string;
    provider?: string;
    inputPricePer1M?: number;
    outputPricePer1M?: number;
}

export class KobApiClient {
    private baseUrl: string;
    private apiKey: string;
    private apiToken?: string;
    private bearerToken: string;

    constructor(config: CliConfig) {
        this.baseUrl = config.baseUrl;
        this.apiKey = config.apiKey;
        this.apiToken = config.apiToken;
        this.bearerToken = config.bearerToken;
    }

    private bearerHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.bearerToken || this.apiKey}`,
        };
    }

    private resolveChatPath(): string {
        if (process.env.KOB_API_CHAT_PATH) return process.env.KOB_API_CHAT_PATH;
        // If the base URL already ends with the full endpoint, use it as-is
        if (this.baseUrl.endsWith('/chat/completions')) return '';
        // If base URL ends with /v1 (OpenAI standard), append /chat/completions
        if (this.baseUrl.endsWith('/v1')) return '/chat/completions';
        // KOB AI API uses /api/v2 prefix
        if (this.baseUrl.includes('kob-ai.dev')) return '/api/v2/chat/completions';
        // Default: OpenAI-compatible /v1/chat/completions
        return '/v1/chat/completions';
    }

    private resolveModelsEndpoints(): { method: 'POST' | 'GET'; path: string }[] {
        if (process.env.KOB_API_MODELS_PATH) return [{ method: 'POST', path: process.env.KOB_API_MODELS_PATH }];
        // Try OpenAI-compatible first, then KOB-specific
        return [
            { method: 'GET', path: '/v1/models' },
            { method: 'POST', path: '/api/models' },
            { method: 'GET', path: '/api/v2/models' },
        ];
    }

    /** Streaming chat completions. Yields chunks as they arrive. */
    async *chatStream(
        model: string,
        messages: ChatMessage[],
        options?: { temperature?: number; max_tokens?: number; system_prompt?: string; signal?: AbortSignal; reasoning?: boolean },
    ): AsyncGenerator<ChatCompletionChunk> {
        const chatPath = this.resolveChatPath();
        const maxRetries = 5;
        let attempt = 0;

        // Network errors that are worth retrying (DNS, TCP, TLS, sudden
        // socket close, fetch abort). HTTP 4xx/5xx are NOT — those go
        // straight to the caller with the server's message.
        const isTransient = (err: unknown): boolean => {
            if (!(err instanceof Error)) return false;
            if (err.name === 'AbortError') return false; // user pressed Esc
            return err.name === 'TypeError'
                || /fetch failed/i.test(err.message)
                || /socket|ECONN|ETIMEDOUT|ENOTFOUND|ENETUNREACH|EAI_AGAIN/i.test(err.message);
        };

        while (attempt < maxRetries) {
            try {
                const url = `${this.baseUrl}${chatPath}`;
                const body: Record<string, unknown> = {
                    model,
                    messages: [...messages],
                    stream: true,
                };
                if (options?.temperature !== undefined) body.temperature = options.temperature;
                if (options?.max_tokens !== undefined) body.max_tokens = options.max_tokens;
                if (options?.system_prompt) {
                    (body.messages as ChatMessage[]).unshift({ role: 'system', content: options.system_prompt });
                }
                // Auto-enable deep thinking for models that support it.
                // deepseek-v4-flash with reasoning rivals deepseek-v4-pro quality.
                if (options?.reasoning !== false && /deepseek.?v4|deepseek.?v4.?flash/i.test(model)) {
                    body.enable_thinking = true;
                }

                const response = await fetch(url, {
                    method: 'POST',
                    headers: this.bearerHeaders(),
                    body: JSON.stringify(body),
                    signal: options?.signal,
                });

                if (!response.ok) {
                    const text = await response.text();
                    let msg = `${url}: HTTP ${response.status}`;
                    try { const d = JSON.parse(text); msg = d.error?.message || d.message || msg; } catch { /* keep */ }
                    throw new ApiError(msg, response.status);
                }
                if (!response.body) throw new ApiError('No response body', 500);

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (value) buffer += decoder.decode(value, { stream: !done });

                        const lines = buffer.split('\n');
                        buffer = done ? '' : (lines.pop() ?? '');

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed.startsWith('data:')) continue;
                            const jsonStr = trimmed.slice(5).trim();
                            if (jsonStr === '[DONE]') return;
                            try { yield JSON.parse(jsonStr) as ChatCompletionChunk; } catch { /* skip */ }
                        }

                        if (done) break;
                    }
                    return; // Success - exit loop
                } finally {
                    reader.releaseLock();
                }
            } catch (err: unknown) {
                attempt++;
                // Bail out immediately on user abort — no point retrying.
                if (err instanceof Error && err.name === 'AbortError') throw err;
                if (!isTransient(err) || attempt >= maxRetries) {
                    if (isTransient(err)) {
                        throw new ApiError('Connection failed. Please check your network and try again.', 503);
                    }
                    throw err;
                }
                // Exponential backoff with jitter: 0.5s, 1s, 2s, 4s (capped).
                const base = 500 * Math.pow(2, attempt - 1);
                const jitter = Math.floor(Math.random() * 250);
                await new Promise((resolve) => setTimeout(resolve, Math.min(base + jitter, 5000)));
            }
        }
    }

    /** Fetch the list of available models. Tries a couple of known shapes. */
    async listModels(): Promise<ModelInfo[]> {
        const tryEndpoints = this.resolveModelsEndpoints();
        let lastErr: unknown;
        for (const ep of tryEndpoints) {
            try {
                const res = await fetch(`${this.baseUrl}${ep.path}`, {
                    method: ep.method,
                    headers: this.bearerHeaders(),
                    body: ep.method === 'POST'
                        ? JSON.stringify({ api_key: this.apiKey, ...(this.apiToken ? { api_token: this.apiToken } : {}) })
                        : undefined,
                });
                const text = await res.text();
                if (!res.ok) { lastErr = new ApiError(text.slice(0, 200), res.status); continue; }
                const data = JSON.parse(text);
                const models = normalizeModels(data);
                if (models.length) return models;
            } catch (e) { lastErr = e; }
        }
        if (lastErr instanceof Error) throw lastErr;
        return [];
    }
}

function normalizeModels(data: unknown): ModelInfo[] {
    const out: ModelInfo[] = [];
    const d = data as Record<string, unknown>;
    if (Array.isArray(d?.models)) {
        for (const m of d.models as ModelInfo[]) out.push(m);
    }
    if (Array.isArray(d?.providers)) {
        for (const p of d.providers as any[]) {
            for (const m of p.models || []) {
                out.push({
                    id: m.modelId || m.id,
                    display_name: m.displayName || m.display_name,
                    provider: p.provider,
                    inputPricePer1M: m.inputPricePer1M,
                    outputPricePer1M: m.outputPricePer1M,
                });
            }
        }
    }
    return out.filter(m => m.id);
}
