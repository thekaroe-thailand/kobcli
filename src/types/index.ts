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

// Project Types
export interface Project {
    id: string;
    user_email: string;
    project_name: string;
    description: string;
    created_at: string;
    updated_at: string;
}

export interface ProjectsResponse {
    success: boolean;
    message?: string;
    projects?: Project[];
    project?: Project;
}

// Project Rule Types
export type RuleType = 'forbidden' | 'required' | 'custom';

export interface ProjectRule {
    id: string;
    project_id: string;
    user_email: string;
    rule_text: string;
    rule_type: RuleType;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface RulesResponse {
    success: boolean;
    message?: string;
    rules?: ProjectRule[];
    rule?: ProjectRule;
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

// Credit History Types
export type CreditStatus = 'completed' | 'pending' | 'failed' | 'refunded';

export interface CreditHistoryItem {
    id: number;
    amount: number;
    payment_method: string;
    payment_channel: string;
    status: CreditStatus;
    note?: string;
    created_at: string;
}

export interface CreditHistoryData {
    total_items: number;
    total_credits_added: number;
    limit: number;
    offset: number;
    items: CreditHistoryItem[];
}

export interface CreditHistoryResponse {
    success: boolean;
    message: string;
    data: CreditHistoryData;
}

// API Response Types
export interface ApiError {
    success: false;
    message: string;
    credit_balance?: number;
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

// CLI Configuration Types
export interface CliConfig {
    baseUrl: string;
    apiKey: string;
    apiToken: string;
}
