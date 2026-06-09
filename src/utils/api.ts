import type { CliConfig } from '../types/index.js';
import { ApiError } from './errors.js';

export interface ChatCompletionChunk {
    id: string;
    object: string;
    created: number;
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

export interface ChatCompletionResult {
    content: string;
    model: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
    };
}

export class KobApiClient {
    private baseUrl: string;
    private apiKey: string;
    private apiToken?: string;
    private bearerToken?: string;

    constructor(config: CliConfig) {
        this.baseUrl = config.baseUrl;
        this.apiKey = config.apiKey;
        this.apiToken = config.apiToken;
        this.bearerToken = config.bearerToken;
    }

    private getHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
        };
    }

    private getAuthBody(): Record<string, string> {
        const auth: Record<string, string> = {
            api_key: this.apiKey,
        };
        if (this.apiToken) {
            auth.api_token = this.apiToken;
        }
        return auth;
    }

    private getBearerHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.bearerToken || this.apiKey}`,
        };
    }

    // V2 streaming chat completions (OpenAI-compatible)
    async *chatStream(model: string, messages: { role: string; content: string }[], options?: {
        temperature?: number;
        max_tokens?: number;
        system_prompt?: string;
    }): AsyncGenerator<ChatCompletionChunk> {
        const url = `${this.baseUrl}/api/v2/chat/completions`;

        const body: any = {
            model,
            messages: [...messages],
            stream: true,
        };
        if (options?.temperature !== undefined) body.temperature = options.temperature;
        if (options?.max_tokens !== undefined) body.max_tokens = options.max_tokens;
        if (options?.system_prompt) {
            body.messages.unshift({ role: 'system', content: options.system_prompt });
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: this.getBearerHeaders(),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const text = await response.text();
            let msg = 'Request failed';
            try { const d = JSON.parse(text); msg = d.error?.message || d.message || msg; } catch {}
            throw new ApiError(msg, response.status);
        }

        if (!response.body) {
            throw new ApiError('No response body', 500);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6).trim();
                    if (jsonStr === '[DONE]') return;
                    try {
                        const chunk: ChatCompletionChunk = JSON.parse(jsonStr);
                        yield chunk;
                    } catch {}
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    // V2 chat completions (accumulates stream, returns final result)
    async chatComplete(model: string, messages: { role: string; content: string }[], options?: {
        temperature?: number;
        max_tokens?: number;
        system_prompt?: string;
    }): Promise<ChatCompletionResult> {
        let content = '';
        let finalModel = model;
        let usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

        for await (const chunk of this.chatStream(model, messages, options)) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) content += delta;
            if (chunk.model) finalModel = chunk.model;
            if (chunk.usage) {
                usage = {
                    input_tokens: chunk.usage.prompt_tokens || 0,
                    output_tokens: chunk.usage.completion_tokens || 0,
                    total_tokens: chunk.usage.total_tokens || 0,
                };
            }
        }

        return { content, model: finalModel, usage };
    }

    // Old methods (for auth:verify, models, etc.)
    async post<T>(endpoint: string, body: Record<string, any> = {}): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        const requestBody = { ...this.getAuthBody(), ...body };

        const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(requestBody),
        });

        const text = await response.text();
        let data: any;
        try { data = JSON.parse(text); } catch {
            throw new ApiError(
                `Server returned non-JSON response (${response.status}). Expected API endpoint, got HTML. Check KOB_API_BASE_URL and endpoint path.`,
                response.status
            );
        }

        if (!response.ok) {
            throw new ApiError(data.message || 'Request failed', response.status);
        }
        if (!data.success) {
            throw new ApiError(data.message || 'Request failed', response.status);
        }
        return data as T;
    }

    async get<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
        // Send API key via Authorization header, NOT in URL query string.
        // Query params are logged in server access logs, proxies, and referrers.
        const queryParams = new URLSearchParams(params);
        const headers = {
            ...this.getHeaders(),
            'Authorization': `Bearer ${this.bearerToken || this.apiKey}`,
        };

        const response = await fetch(`${this.baseUrl}${endpoint}?${queryParams.toString()}`, {
            method: 'GET', headers,
        });

        const text = await response.text();
        let data: any;
        try { data = JSON.parse(text); } catch {
            throw new ApiError(
                `Server returned non-JSON response (${response.status}). Expected API endpoint, got HTML. Check KOB_API_BASE_URL and endpoint path.`,
                response.status
            );
        }

        if (!response.ok) throw new ApiError(data.message || 'Request failed', response.status);
        if (!data.success) throw new ApiError(data.message || 'Request failed', response.status);
        return data as T;
    }
}
