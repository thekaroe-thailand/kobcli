# AGENTS.md - KOB CLI Agent Specification

## Overview

This document provides comprehensive specifications for AI agents working on the KOB CLI project. It covers architecture, development guidelines, and best practices.

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────┐
│              CLI Entry Point                 │
│            (src/index.ts)                    │
└──────────────┬──────────────────────────────┘
               │
               │ Commander.js / no-args → TUI
               ▼
┌──────────────────────┬──────────────────────┐
│   Command Layer      │    TUI Layer          │
│ (src/commands/*.ts)  │  (src/ui/*.tsx)       │
│ - auth.ts            │  - code-tui.tsx       │
│ - chat.ts            │  - model-picker.tsx   │
│ - stream.ts          │  - config-form.tsx    │
│ - models.ts          │  - colors.ts          │
│ - ask.ts             │                       │
│ - code.ts            │                       │
│ - skills.ts          │                       │
└──────────┬───────────┴──────────┬────────────┘
           │                      │
           ▼                      ▼
┌─────────────────────────────────────────────┐
│            Utility Layer                     │
│  (src/utils/*.ts)                            │
│  - api.ts (HTTP Client)                      │
│  - config.ts (Configuration)                 │
│  - env-file.ts (.env read/write)             │
│  - format.ts (Output Formatting)             │
│  - errors.ts (Error Handling)                │
└──────────────┬──────────────────────────────┘
               │
               │ HTTPS
               ▼
┌─────────────────────────────────────────────┐
│          KOB AI API Server                   │
│  https://www.kob-ai.dev/api/*                │
└─────────────────────────────────────────────┘
```

### Module Responsibilities

#### 1. Entry Point (`src/index.ts`)
- Initialize Commander.js program
- Register all commands
- Parse command-line arguments
- If no subcommand given → call `runCodeTui()` (TUI mode)

#### 2. Command Layer (`src/commands/`)

**auth.ts**
- `auth:verify` - Verify API credentials
- `balance` - Check credit balance

**chat.ts**
- `chat` - Single message to AI
- `chat:interactive` - REPL mode for conversation

**stream.ts**
- `stream` - Real-time streaming AI responses

**models.ts**
- `models` - List available AI models

**ask.ts**
- `ask` - One-shot question answering (streaming)

**code.ts**
- `code` - AI code generation; launches TUI if no prompt given

**skills.ts**
- `skills` - List all available CLI skills

#### 3. TUI Layer (`src/ui/`)

**code-tui.tsx**
- `runCodeTui()` - Launch the full-screen Ink/React TUI
- `CodeEngine` - Main React component managing all TUI state
- Handles 3 modes: Ask, Plan, Code
- Auto-executes shell commands and writes files in Code mode

**model-picker.tsx** - Overlay for selecting AI model from API
**config-form.tsx** - Overlay for editing .env credentials
**colors.ts** - Shared color token object (`c.*`)

#### 4. Utility Layer (`src/utils/`)

**api.ts**
- `KobApiClient` class
- `chatStream()` - Async generator for SSE streaming
- `chatComplete()` - Accumulate stream to string
- Automatic Bearer token injection

**config.ts**
- `getConfig()` - Read from `process.env` (Bun auto-loads .env)
- Supports `kob_xxx:token` combined key format

**env-file.ts**
- `readEnvFile()` / `writeEnvFile()` - Read/write .env files directly
- Preserves comments and key ordering

**format.ts**
- `formatDate()` - Format timestamps
- `formatUsage()` - Format usage statistics

**errors.ts**
- `ApiError` class - Custom error type
- `handleApiError()` - User-friendly error messages
- `validateRequired()` - Input validation

#### 5. Type Definitions (`src/types/index.ts`)
- All TypeScript interfaces
- API response types (`ModelsResponse`, `ChatResponse`, `StreamEvent`, `UserToken`, etc.)

## Development Guidelines

### Adding New Commands

1. **Create Command File**
```typescript
// src/commands/mycommand.ts
import { Command } from 'commander';
import { KobApiClient } from '../utils/api.js';
import { getConfig } from '../utils/config.js';

export const myCommand = new Command('mycommand')
  .description('My new command')
  .action(async () => {
    // Implementation
  });
```

2. **Register in Entry Point**
```typescript
// src/index.ts
import { myCommand } from './commands/mycommand.js';
program.addCommand(myCommand);
```

### API Client Usage

```typescript
const config = getConfig();
const client = new KobApiClient(config);

// POST request
const data = await client.post<ResponseType>('/api/endpoint', {
  key: 'value'
});

// Streaming (async generator — yields OpenAI-compatible SSE chunks)
for await (const chunk of client.chatStream(model, messages, options)) {
  const delta = chunk.choices?.[0]?.delta?.content;
  if (delta) process.stdout.write(delta);
}

// Accumulate full response
const result = await client.chatComplete(model, messages, options);
// result = { content, model, usage }
```

### Error Handling Pattern

```typescript
try {
  const spinner = ora('Loading...').start();
  
  // API call
  const data = await client.post('/api/endpoint', body);
  
  spinner.succeed('Success!');
  console.log(data);
} catch (error) {
  spinner.fail('Failed');
  handleApiError(error);
}
```

### Type Safety

Always use TypeScript types:
```typescript
import type { ChatResponse } from '../types/index.js';

const data = await client.post<ChatResponse>('/api/ai/chat', body);
// data is properly typed
```

## Testing Strategy

### Manual Testing Checklist

1. **Authentication**
   - [ ] `auth:verify` with valid credentials
   - [ ] `auth:verify` with invalid credentials
   - [ ] `balance` command

2. **Ask**
   - [ ] `ask` with different providers and models

3. **Chat**
   - [ ] `chat` with different providers
   - [ ] `chat:interactive` mode

4. **Code**
   - [ ] `code "..."` generates and writes files
   - [ ] `code` (no args) launches TUI

5. **Streaming**
   - [ ] `stream` with different models
   - [ ] Stream error handling

6. **Models**
   - [ ] `models` list all
   - [ ] `models --provider` filter
   - [ ] `models --format json`

7. **TUI**
   - [ ] Launch with `kob` (no args)
   - [ ] Switch modes (Ask / Plan / Code)
   - [ ] `/models` overlay
   - [ ] `/config` overlay
   - [ ] `/clear` resets history

### Common Test Scenarios

```bash
# Test authentication
bun dev auth:verify

# Test ask
bun dev ask "What is TypeScript?"

# Test chat
bun dev chat "Hello" --provider DeepSeek --model deepseek-chat

# Test streaming
bun dev stream "Tell me a story" --model deepseek-chat

# Test code generation
bun dev code "Write a hello world in Go" --lang go

# Launch TUI
kob
```

## Best Practices

### Code Style

1. **Use async/await** - Not promises or callbacks
2. **Type everything** - No `any` types unless necessary
3. **Error handling** - Always use try/catch with handleApiError
4. **User feedback** - Use ora spinners for loading states
5. **Output formatting** - Use chalk for colors, format functions for consistency

### Performance

1. **Lazy loading** - Import only what's needed
2. **Connection reuse** - Single API client instance per command
3. **Streaming** - Use for long responses to improve UX

### Security

1. **Environment variables** - Never hardcode credentials
2. **Validation** - Validate all user inputs
3. **Error messages** - Don't expose sensitive info in errors

## Common Issues & Solutions

### Issue: Type import errors
**Solution:** Use `import type` for types
```typescript
import type { ChatResponse } from '../types/index.js';
```

### Issue: Undefined content in streams
**Solution:** Check for undefined before using
```typescript
if (event.content) {
  process.stdout.write(event.content);
}
```

### Issue: Missing environment variables
**Solution:** Check .env file or export variables
```bash
export KOB_API_KEY=xxx
export KOB_API_KEY=xxx
```

## Future Enhancements

### Potential Features

1. **Conversation Export**
   - Export chat history to file
   - Multiple formats (JSON, Markdown, TXT)

2. **Batch Operations**
   - Process multiple messages from file

3. **Configuration File**
   - Save default provider/model preferences
   - Multiple profile support

4. **Plugin System**
   - Custom command plugins
   - Third-party integrations

5. **Advanced Formatting**
   - Markdown rendering in terminal
   - Syntax highlighting for code

6. **Caching**
   - Cache model list
   - Cache frequently accessed data

## Dependencies

### Production
- `commander` - CLI framework
- `chalk` - Terminal styling
- `ora` - Loading spinners

### Development
- `@types/bun` - Bun type definitions
- `typescript` - TypeScript compiler

## Build & Deployment

### Development
```bash
bun dev <command>
```

### Production Build
```bash
bun run build
# Creates kob-cli.exe
```

### Global Installation
```bash
bun install -g .
# or
bun link
```

## Reference

- **API Documentation**: See `/my-app/docs/` directory
- **Type Definitions**: `src/types/index.ts`
- **API Client**: `src/utils/api.ts`
- **Commands**: `src/commands/*.ts`
