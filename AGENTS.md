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
               │ Commander.js
               ▼
┌─────────────────────────────────────────────┐
│            Command Layer                     │
│  (src/commands/*.ts)                         │
│  - auth.ts, chat.ts, stream.ts              │
│  - models.ts, projects.ts, rules.ts         │
│  - credits.ts                                │
└──────────────┬──────────────────────────────┘
               │
               │ Business Logic
               ▼
┌─────────────────────────────────────────────┐
│            Utility Layer                     │
│  (src/utils/*.ts)                            │
│  - api.ts (HTTP Client)                      │
│  - config.ts (Configuration)                 │
│  - format.ts (Output Formatting)             │
│  - errors.ts (Error Handling)                │
└──────────────┬──────────────────────────────┘
               │
               │ Fetch API
               ▼
┌─────────────────────────────────────────────┐
│          KOB AI API Server                   │
│  https://kob-ai.com/api/*                    │
└─────────────────────────────────────────────┘
```

### Module Responsibilities

#### 1. Entry Point (`src/index.ts`)
- Initialize Commander.js program
- Register all commands
- Display help text
- Parse command-line arguments

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

**projects.ts**
- `projects:list` - List all projects
- `projects:create` - Create new project
- `projects:update` - Update existing project
- `projects:delete` - Delete project

**rules.ts**
- `rules:list` - List project rules
- `rules:create` - Create new rule
- `rules:update` - Update existing rule
- `rules:delete` - Delete rule

**credits.ts**
- `credits:history` - View credit top-up history

#### 3. Utility Layer (`src/utils/`)

**api.ts**
- `KobApiClient` class
- HTTP methods: GET, POST, PATCH, DELETE
- Streaming support with async generators
- Automatic authentication injection
- Error handling

**config.ts**
- `getConfig()` - Load environment variables
- `validateConfig()` - Validate configuration
- Fallback to default values

**format.ts**
- `formatDate()` - Format timestamps
- `formatProjects()` - Format project list
- `formatRules()` - Format rules list
- `formatCreditHistory()` - Format credit history
- `formatUsage()` - Format usage statistics

**errors.ts**
- `ApiError` class - Custom error type
- `handleApiError()` - User-friendly error messages
- `validateRequired()` - Input validation

#### 4. Type Definitions (`src/types/index.ts`)
- All TypeScript interfaces
- API response types
- Request/Response schemas

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

// GET request
const data = await client.get<ResponseType>('/api/endpoint', {
  param: 'value'
});

// Streaming
for await (const event of client.stream('/api/stream', body)) {
  if (event.type === 'chunk') {
    // Handle chunk
  }
}
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

2. **Chat**
   - [ ] `chat` with different providers
   - [ ] `chat:interactive` mode
   - [ ] Chat with project rules

3. **Streaming**
   - [ ] `stream` with different models
   - [ ] Stream error handling

4. **Models**
   - [ ] `models` list all
   - [ ] `models --provider` filter
   - [ ] `models --format json`

5. **Projects**
   - [ ] Create, list, update, delete

6. **Rules**
   - [ ] Create, list, update, delete
   - [ ] Different rule types

7. **Credits**
   - [ ] `credits:history` with pagination

### Common Test Scenarios

```bash
# Test authentication
bun dev auth:verify

# Test chat
bun dev chat "Hello" --provider DeepSeek --model deepseek-chat

# Test streaming
bun dev stream "Tell me a story" --model deepseek-chat

# Test projects
bun dev projects:create "Test Project"
bun dev projects:list
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
export KOB_API_TOKEN=xxx
```

## Future Enhancements

### Potential Features

1. **Conversation Export**
   - Export chat history to file
   - Multiple formats (JSON, Markdown, TXT)

2. **Batch Operations**
   - Process multiple messages from file
   - Bulk project/rule management

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
