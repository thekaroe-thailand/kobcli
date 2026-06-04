import type { CliConfig, StreamEvent } from '../types/index.js';
import { ApiError } from './errors.js';

export class KobApiClient {
    private baseUrl: string;
    private apiKey: string;
    private apiToken: string;

    constructor(config: CliConfig) {
        this.baseUrl = config.baseUrl;
        this.apiKey = config.apiKey;
        this.apiToken = config.apiToken;
    }

    private getHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
        };
    }

    private getAuthBody(): Record<string, string> {
        return {
            api_key: this.apiKey,
            api_token: this.apiToken,
        };
    }

    async post<T>(endpoint: string, body: Record<string, any> = {}): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        const requestBody = {
            ...this.getAuthBody(),
            ...body,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(requestBody),
        });

        const data: any = await response.json();

        if (!response.ok) {
            throw new ApiError(data.message || 'Request failed', response.status);
        }

        if (!data.success) {
            throw new ApiError(data.message || 'Request failed', response.status);
        }

        return data as T;
    }

    async get<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
        const queryParams = new URLSearchParams({
            api_key: this.apiKey,
            api_token: this.apiToken,
            ...params,
        });

        const url = `${this.baseUrl}${endpoint}?${queryParams.toString()}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        const data: any = await response.json();

        if (!response.ok) {
            throw new ApiError(data.message || 'Request failed', response.status);
        }

        if (!data.success) {
            throw new ApiError(data.message || 'Request failed', response.status);
        }

        return data as T;
    }

    async patch<T>(endpoint: string, body: Record<string, any> = {}): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        const requestBody = {
            ...this.getAuthBody(),
            ...body,
        };

        const response = await fetch(url, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify(requestBody),
        });

        const data: any = await response.json();

        if (!response.ok) {
            throw new ApiError(data.message || 'Request failed', response.status);
        }

        if (!data.success) {
            throw new ApiError(data.message || 'Request failed', response.status);
        }

        return data as T;
    }

    async delete<T>(endpoint: string, body: Record<string, any> = {}): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        const requestBody = {
            ...this.getAuthBody(),
            ...body,
        };

        const response = await fetch(url, {
            method: 'DELETE',
            headers: this.getHeaders(),
            body: JSON.stringify(requestBody),
        });

        const data: any = await response.json();

        if (!response.ok) {
            throw new ApiError(data.message || 'Request failed', response.status);
        }

        if (!data.success) {
            throw new ApiError(data.message || 'Request failed', response.status);
        }

        return data as T;
    }

    async *stream(endpoint: string, body: Record<string, any> = {}): AsyncGenerator<StreamEvent> {
        const url = `${this.baseUrl}${endpoint}`;
        const requestBody = {
            ...this.getAuthBody(),
            ...body,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const data: any = await response.json();
            throw new ApiError(data.message || 'Stream request failed', response.status);
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

                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) {
                        continue;
                    }

                    const jsonStr = line.slice(6);
                    try {
                        const event: StreamEvent = JSON.parse(jsonStr);
                        yield event;

                        if (event.type === 'done' || event.type === 'error') {
                            return;
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }
}
