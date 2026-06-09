// User & Authentication Types
export interface UserToken {
    success: boolean;
    message: string;
    user_email: string;
    user_name: string;
    key_name: string;
    credit_balance: number;
    package_name: string;
    package_started_at: string;
    package_expires_at: string;
    ip: string;
    timestamp: string;
}

// AI Model Types
export interface AIModel {
    modelId: string;
    displayName: string;
    inputPricePer1M: number;
    outputPricePer1M: number;
}

export interface ProviderModels {
    provider: string;
    models: AIModel[];
}

export interface ModelsResponse {
    success: boolean;
    message: string;
    provider_count: number;
    model_count: number;
    providers: ProviderModels[];
}

// Chat Types
export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
    role: MessageRole;
    content: string;
}

export interface ChatUsage {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: number;
    credits_used: number;
    model: string;
    input_price_per_1m: number;
    output_price_per_1m: number;
}

export interface ChatResponse {
    success: boolean;
    message: string;
    content: string;
    usage: ChatUsage;
    credit_balance: number;
    timestamp: string;
}

// Stream Types
export type StreamEventType = 'chunk' | 'done' | 'error';

export interface StreamEvent {
    type: StreamEventType;
    content?: string;
    message?: string;
    credits_charged?: number;
    credits_remaining?: number;
    usage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
        cost_usd: number;
        credits_used: number;
        charged_input_tokens: number;
        charged_output_tokens: number;
        charged_cost_usd: number;
        charged_credits: number;
        charge_rate: number;
    };
}

// CLI Configuration Types
export interface CliConfig {
    baseUrl: string;
    apiKey: string;
    apiToken?: string;
    bearerToken?: string;
    modelId?: string;
}
