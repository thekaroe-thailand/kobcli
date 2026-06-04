# SPECTS.md - KOB CLI Technical Specifications

## API Integration Specifications

### Base Configuration

```
Base URL: https://www.kob-ai.dev
Authentication: API Key + API Token in request body
Content-Type: application/json
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KOB_API_BASE_URL` | No | `https://www.kob-ai.dev` | API base URL |
| `KOB_API_KEY` | Yes | - | API key (starts with `kob_`) |

## API Endpoints

### 1. Token Verification

**Endpoint:** `POST /tokens/verify`

**Request Body:**
```json
{
  "api_key": "kob_xxx"
}

**Response (200):**
```json
{
  "success": true,
  "message": "Token verified successfully",
  "user_email": "user@example.com",
  "user_name": "John Doe",
  "key_name": "My Key",
  "credit_balance": 250,
  "package_name": "Premium Monthly",
  "package_started_at": "2025-01-10T00:00:00.000Z",
  "package_expires_at": "2025-02-09T00:00:00.000Z",
  "ip": "203.0.113.42",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

**Error Responses:**
- `400` - Missing fields
- `401` - Invalid credentials
- `500` - Server error

---

### 2. AI Chat

**Endpoint:** `POST /ai/chat`

**Request Body:**
```json
{
  "api_key": "kob_xxx",
  "provider": "DeepSeek",
  "model": "deepseek-chat",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "project_id": "optional-uuid",
  "system_prompt": "optional",
  "max_tokens": 4096,
  "temperature": 0.7
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "AI response generated successfully",
  "content": "AI response text...",
  "usage": {
    "input_tokens": 85,
    "output_tokens": 120,
    "total_tokens": 205,
    "cost_usd": 0.00004245,
    "credits_used": 1,
    "model": "deepseek-chat",
    "input_price_per_1m": 0.27,
    "output_price_per_1m": 1.10
  },
  "credit_balance": 249,
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

**Error Responses:**
- `400` - Missing required fields
- `401` - Invalid credentials
- `402` - Insufficient credits
- `404` - Project not found
- `502` - AI provider error
- `500` - Server error

---

### 3. AI Stream

**Endpoint:** `POST /ai/stream`

**Request Body:** Same as `/ai/chat`

**Response:** Server-Sent Events (SSE)

**Event Types:**

**chunk:**
```json
{ "type": "chunk", "content": "text fragment" }
```

**done:**
```json
{
  "type": "done",
  "content": "full response",
  "credits_charged": 9,
  "credits_remaining": 991,
  "usage": {
    "input_tokens": 15,
    "output_tokens": 8,
    "total_tokens": 23,
    "cost_usd": 0.000023,
    "credits_used": 1,
    "charged_credits": 9,
    "charge_rate": 3.0
  }
}
```

**error:**
```json
{ "type": "error", "message": "Error description" }
```

---

### 4. Models

**Endpoint:** `POST /models`

**Request Body:**
```json
{
  "api_key": "kob_xxx"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Found 302 models across 2 providers",
  "provider_count": 2,
  "model_count": 302,
  "providers": [
    {
      "provider": "DeepSeek",
      "models": [
        {
          "modelId": "deepseek-chat",
          "displayName": "DeepSeek V3",
          "inputPricePer1M": 0.27,
          "outputPricePer1M": 1.10
        }
      ]
    }
  ]
}
```

---

### 5. Projects

#### 5.1 List Projects

**Endpoint:** `GET /projects?api_key=xxx`

**Response (200):**
```json
{
  "success": true,
  "projects": [
    {
      "id": "uuid",
      "user_email": "user@example.com",
      "project_name": "My Project",
      "description": "Description",
      "created_at": "2025-01-20T10:30:00.000Z",
      "updated_at": "2025-01-20T10:30:00.000Z"
    }
  ]
}
```

#### 5.2 Create Project

**Endpoint:** `POST /projects`

**Request Body:**
```json
{
  "api_key": "kob_xxx",
  "project_name": "My Project",
  "description": "Optional description"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Project created successfully",
  "project": {
    "id": "uuid",
    "project_name": "My Project",
    "description": "Description",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

#### 5.3 Update Project

**Endpoint:** `PATCH /projects`

**Request Body:**
```json
{
  "api_key": "kob_xxx",
  "project_id": "uuid",
  "project_name": "New Name",
  "description": "New description"
}
```

#### 5.4 Delete Project

**Endpoint:** `DELETE /projects`

**Request Body:**
```json
{
  "api_key": "kob_xxx",
  "project_id": "uuid"
}
```

---

### 6. Project Rules

#### 6.1 List Rules

**Endpoint:** `GET /projects/rules?api_key=xxx&project_id=xxx`

**Response (200):**
```json
{
  "success": true,
  "rules": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "user_email": "user@example.com",
      "rule_text": "Must respond in Thai",
      "rule_type": "required",
      "is_active": true,
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

#### 6.2 Create Rule

**Endpoint:** `POST /projects/rules`

**Request Body:**
```json
{
  "api_key": "kob_xxx",
  "project_id": "uuid",
  "rule_text": "Rule text",
  "rule_type": "required"
}
```

**Rule Types:**
- `forbidden` - Things AI must not do
- `required` - Things AI must do
- `custom` - Custom rules

#### 6.3 Update Rule

**Endpoint:** `PATCH /projects/rules`

**Request Body:**
```json
{
  "api_key": "kob_xxx",
  "project_id": "uuid",
  "rule_id": "uuid",
  "rule_text": "New text",
  "rule_type": "required",
  "is_active": true
}
```

#### 6.4 Delete Rule

**Endpoint:** `DELETE /projects/rules`

**Request Body:**
```json
{
  "api_key": "kob_xxx",
  "project_id": "uuid",
  "rule_id": "uuid"
}
```

---

### 7. Credit History

**Endpoint:** `POST /credits/history`

**Request Body:**
```json
{
  "api_key": "kob_xxx",
  "limit": 20,
  "offset": 0
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Credit history retrieved successfully",
  "data": {
    "total_items": 25,
    "total_credits_added": 1500,
    "limit": 20,
    "offset": 0,
    "items": [
      {
        "id": 101,
        "amount": 500,
        "payment_method": "promptpay",
        "payment_channel": "QR PromptPay",
        "status": "completed",
        "note": "Top up 500 credits",
        "created_at": "2025-01-14T14:22:00.000Z"
      }
    ]
  }
}
```

**Credit Status:**
- `completed` - Successfully added
- `pending` - Awaiting confirmation
- `failed` - Failed transaction
- `refunded` - Refunded

## Error Handling Specifications

### HTTP Status Codes

| Code | Meaning | CLI Action |
|------|---------|------------|
| 200 | Success | Display data |
| 400 | Bad Request | Show validation error |
| 401 | Unauthorized | Show auth error with help |
| 402 | Payment Required | Show credit top-up message |
| 404 | Not Found | Show resource not found |
| 500 | Server Error | Show server error message |
| 502 | Bad Gateway | Show provider error |

### Error Response Format

```json
{
  "success": false,
  "message": "Error description"
}
```

### CLI Error Messages

**Authentication Error:**
```
❌ API Error: Invalid API key

Authentication failed. Please check your API credentials.
Make sure KOB_API_KEY is correct.
```

**Insufficient Credits:**
```
❌ API Error: Insufficient credits. Please top up your account.

Insufficient credits. Please top up your account.
```

**Resource Not Found:**
```
❌ API Error: Project not found

Resource not found.
```

## Data Type Specifications

### Provider Names

Valid provider names (case-sensitive):
- `DeepSeek`
- `OpenRouter` (or `OpenRouter (Kob AI Pro)`)
- `DeepInfra` (or `DeepInfra (Kob AI)`)

### Model IDs

Common model IDs:

**DeepSeek:**
- `deepseek-chat`
- `deepseek-reasoner`
- `deepseek-v4-pro`
- `deepseek-v4-flash`

**OpenRouter:**
- `openai/gpt-4o`
- `openai/gpt-4o-mini`
- `openai/gpt-4-turbo`
- `anthropic/claude-3.5-sonnet`
- `anthropic/claude-3.5-haiku`
- `google/gemini-1.5-pro`
- `google/gemini-1.5-flash`

**DeepInfra:**
- `meta-llama/Meta-Llama-3.1-8B-Instruct`
- `meta-llama/Meta-Llama-3.1-70B-Instruct`
- `Qwen/Qwen2.5-72B-Instruct`

### Parameter Ranges

**Temperature:**
- Range: 0.0 - 2.0
- Default: 0.7
- Lower = more deterministic
- Higher = more creative

**Max Tokens:**
- Range: 1 - 8192 (varies by model)
- Default: 4096

**Pagination:**
- `limit`: 1 - 100 (default: 20)
- `offset`: 0 - n (default: 0)

## Security Specifications

### Credential Management

1. **Storage:** Environment variables only (KOB_API_KEY, supports combined format `api_key:api_token`)
2. **Transmission:** In request body (not URL)
3. **Logging:** Never log credentials
4. **Validation:** Check presence before API calls

### Input Validation

1. **Required Fields:** Validate before API call
2. **String Length:** No specific limits (API enforces)
3. **Special Characters:** Allow all UTF-8
4. **UUIDs:** Validate format for IDs

## Performance Specifications

### Timeouts

- **Regular API calls:** 30 seconds
- **Streaming:** 60 seconds
- **Interactive mode:** No timeout (user-controlled)

### Rate Limiting

- No client-side rate limiting
- Server enforces rate limits
- Display error if rate limited

### Streaming Performance

- Buffer size: Default (Node.js)
- Display latency: < 100ms per chunk
- Memory: Linear with response size

## Testing Specifications

### Unit Tests (Future)

```typescript
// API Client
- post() with valid data
- post() with invalid credentials
- get() with query params
- stream() event parsing
- Error handling

// Commands
- auth:verify output format
- chat message formatting
- models filtering
- projects CRUD operations
- rules CRUD operations
- credits pagination

// Utilities
- formatDate() accuracy
- formatProjects() layout
- formatRules() layout
- validateRequired() checks
```

### Integration Tests

1. **Full workflow test:**
   - auth:verify → models → projects:create → rules:create → chat → credits:history

2. **Error scenarios:**
   - Invalid credentials
   - Insufficient credits
   - Invalid project ID
   - Network timeout

## Compatibility

### Runtime Requirements

- **Bun:** v1.0.0 or higher
- **TypeScript:** v5.0.0 or higher
- **Node.js:** Not required (Bun only)

### Platform Support

- ✅ Windows (tested)
- ✅ macOS (compatible)
- ✅ Linux (compatible)

### Terminal Support

- ✅ Modern terminals (UTF-8, colors)
- ⚠️ Legacy terminals (may have color issues)
- ✅ CI/CD environments

## Version History

### v1.0.0 (Current)

- Initial release
- All core commands implemented
- Full API coverage
- Streaming support
- Interactive chat mode
- Comprehensive documentation
