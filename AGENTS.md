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
               │ Commander.js / no-args → REPL
               ▼
┌──────────────────────┬──────────────────────┐
│   Command Layer      │    REPL Layer         │
│  (src/index.ts)      │  (src/repl.ts)        │
│ - ask                │  - slash commands     │
│ - config             │  - runTurn            │
│ - models             │  - retry key (R)      │
│ - chat               │                       │
└──────────┬───────────┴──────────┬────────────┘
           │                      │
           ▼                      ▼
┌─────────────────────────────────────────────┐
│            Core Layer                        │
│  (src/core/*.ts)                            │
│  - api.ts (HTTP streaming + retry)          │
│  - engine.ts (multi-round agent loop)       │
│  - modes.ts (Ask/Plan/Code prompts)         │
│  - config.ts (env loading)                  │
│  - env-file.ts (.env read/write)            │
│  - history.ts (per-project sessions)        │
│  - types.ts (shared interfaces)             │
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
- Register subcommands (`ask`, `config`, `models`, `chat`)
- Parse CLI arguments
- If no subcommand given → call `runRepl()` from `./repl.js`

#### 2. REPL Layer (`src/repl.ts`)
- The interactive loop users spend 99% of their time in
- `runRepl(state, cfg, …)` — main loop, reads input, dispatches to `runTurn`
- `runTurn(state, input, cfg, …)` — single agentic turn, returns `{ state, connectionError }`
- Handles slash commands (`/models`, `/config`, `/git`, `/diff`, `/undo`, `/project:list`, `/clear`, …)
- `TurnIO` class — manages spinner + Esc abort signal + `approveCommand` confirmation
- `waitForRetryKey()` — listens for a single keypress (`R` = retry) after a connection failure

#### 3. Core Layer (`src/core/`)

**api.ts** — `KobApiClient`
- `chatStream()` — async generator for SSE streaming, **5 retries with exponential backoff + jitter** on transient network errors (DNS, TCP, TLS, fetch abort), **no retry on HTTP 4xx/5xx**, **no retry on user Esc abort**
- `chatComplete()` — accumulate stream to a single string
- `post()` / `get()` — JSON HTTP helpers
- Automatic Bearer token injection
- Throws `ApiError` with stable `statusCode` (503 for "Connection failed", HTTP status for upstream errors)

**engine.ts** — `handleSubmit(state, input, callbacks)` — multi-round agentic loop
- Reads the conversation history from `state.exchanges`
- Builds the system prompt for the current mode
- Calls `chatStream`, parses tool calls from the streamed delta
- Routes parsed tool calls to `files.ts` / `shell.ts` / `git.ts`
- Pushes undo entries to the `setUndo` callback for `/undo`
- Returns `{ state, undo, error? }` — `error` is the user-facing message

**modes.ts** — system prompts + mode-specific nudge text for `Ask`, `Plan`, `Code`
**projects.ts** — global list of project directories in `~/.kob-cli/projects.json`
**config.ts** — `getConfig()` reads `process.env` (Bun auto-loads `.env` / `.env.local`)
**env-file.ts** — `readEnvFile()` / `writeEnvFile()` for the `kob config` form, comment-preserving
**history.ts** — per-`cwd` session persistence to `~/.kob-cli/sessions/<hash>.jsonl`
**types.ts** — all shared TypeScript interfaces

#### 4. Tools Layer (`src/tools/`)

**parser.ts** — extract fenced code blocks and `<tool:…>…</tool:…>` tags from streamed deltas
**files.ts** — sandboxed `read_file` / `write_file` / `str_replace`; path must be inside `cwd`
**shell.ts** — `runShellCommand()`, classifies as `readonly` / `mutating` / `dangerous`
**git.ts** — `gitStatus()`, `gitDiff()`, branch + ahead/behind
**diff.ts** — LCS line diff + compact unified-diff renderer
**clipboard.ts** — cross-platform `copyToClipboard()`

#### 5. UI Layer (`src/ui/`)

**banner.ts** — ASCII KOB header + gradient brand colour
**gradient.ts** — `gradient(colors)(text)` for dependency-free truecolour gradient text
**markdown.ts** — `tintCode(lang, code)` and `renderMarkdown(text)` to ANSI
**prompts.ts** — `promptInput()` (history-walking, multi-line safe), `editConfig()`, `confirmCommand()`, `pickSearchableOption()`
**render.ts** — `errorBox()`, `banner()`, `showResponse()`, `showExchange()`, progress reporters
**spinner.ts** — single-line spinner that does not collide with the prompt
**theme.ts** — palette tokens (`C.cyan`, `C.pink`, …) and `visibleLength` / `termWidth` / `wrapVisible` helpers

## Development Guidelines

### Adding a new feature

1. **Find the right layer.**
   - Pure logic? → `src/core/`
   - Sandbox + filesystem? → `src/tools/`
   - Interactive prompt? → `src/ui/prompts.ts`
   - Output formatting? → `src/ui/render.ts`

2. **Use the engine callbacks**, not your own loop. The engine already handles streaming, abort, tool routing, undo, and the spinner.

3. **Stay sandboxed.** All file paths must be inside `cwd`. All shell commands must classify as `readonly` or pass through `confirmCommand`.

4. **Never hardcode credentials.** Use `getConfig().apiKey` and let `kob config` populate it.

### API Client Usage

```typescript
import { KobApiClient, getConfig } from './core/index.js';

const cfg = getConfig();
const client = new KobApiClient(cfg);

// JSON POST
const data = await client.post<ResponseType>('/api/endpoint', body);

// Streaming
for await (const chunk of client.chatStream(model, messages, options)) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) process.stdout.write(delta);
}

// Accumulated
const { content, model, usage } = await client.chatComplete(model, messages, options);
```

### Error Handling Pattern

```typescript
import { ApiError, handleApiError } from './core/api.js';

try {
    const spinner = ora('Loading…').start();
    const data = await client.post<MyResponse>('/api/endpoint', body);
    spinner.succeed('Done');
    console.log(data);
} catch (err) {
    spinner.fail('Failed');
    handleApiError(err);
}
```

For the REPL: return the error from `runTurn` and let `runRepl` print the retry hint. Don't crash the loop.

## Testing Strategy

### Manual testing checklist

```bash
# 1. typecheck — must be clean before opening a PR
bun run typecheck

# 2. non-interactive smoke
bun run src/index.ts --version     # prints e.g. 2.0.4
bun run src/index.ts ask "hello"   # should hit the API

# 3. interactive REPL
bun run dev                        # spawns the TUI
```

Inside the REPL:

1. **Auth** — `kob config`, paste a real `kob_xxx:token`, exit
2. **Modes** — `Tab` cycles Ask / Plan / Code
3. **Slash** — `/models`, `/config`, `/git`, `/diff`, `/undo`, `/clear`, `/help`, `/exit`
4. **Streaming** — type a long request, press `Esc` mid-stream (must abort cleanly)
5. **Connection retry** — temporarily point `KOB_API_BASE_URL` to an invalid host, run `ask "hi"`, press `R` after the error
6. **Undo** — ask the model to write a file, then `/undo` (file must be reverted)
7. **Dangerous command** — ask the model to run `rm -rf tmp-test/`, confirm the red banner

## Mandatory Agent Workflow

AI Agents working on this project MUST adhere to the following workflow rules:

1. **Read Before Writing**: Always read relevant documentation and codebase context before starting any task.
2. **Document Problem Solutions**: Whenever a problem or bug is solved, write down the lesson learned in the relevant documentation file.
3. **Document New Features**: Whenever a new feature is added, create or update the corresponding documentation files immediately.
4. **Update README.md**: If the change affects public-facing commands, features, or installation steps, update `README.md` to reflect those changes.
5. **Commit and Push Promptly**: Once a task is fully completed and tested, commit the changes and push them to Git immediately. Do not leave uncommitted work hanging.
6. **Build and Release**: After committing and pushing code changes, ALWAYS run `bun run build` to bump the version, compile the binary, publish to npm, and create a git tag. This is a mandatory step — never skip it. The command `bun run build` is a full release (bump + build + publish + push + tag). Use `bun run build:only` only for local binary compilation without version bump.
7. **Push to Master & Return to Dev**: After a successful build and release, ALWAYS push the changes to the `master` branch to make them the stable release. Then immediately switch back to the `kob-dev` branch to continue development work. The workflow is: `git checkout master` → `git merge kob-dev` (or push changes) → `git checkout kob-dev`. All active development happens on `kob-dev`; `master` is for stable releases only.

## Best Practices

### Code Style

1. **async/await** — no `.then` chains
2. **Type everything** — no `any` unless wrapping a third-party untyped API
3. **Error handling** — catch and route through `handleApiError` or return a friendly string from `runTurn`
4. **User feedback** — `Spinner` for loading, `errorBox` for errors, `banner` for soft warnings
5. **Output formatting** — `chalk.hex(C.…)` for colour, `theme.ts` helpers for layout

### Performance

- Lazy import inside hot paths only when there's a real cost
- One `KobApiClient` per command, reuse it
- Stream long responses; never await the full body for chat

### Security

- Env vars only — no hardcoded tokens
- Validate every user input that becomes a file path or shell command
- Error messages must not echo API keys or env contents

## Common Issues & Solutions

### Issue: `Cannot find package 'ora'` (or anything else) on a fresh clone

**Cause:** the project tree was cleaned of legacy files; only the deps in `package.json` are required.
**Solution:** `bun install` and you are done. If anything in `src/` imports a package that's not in `package.json`, that's a bug — open an issue.

### Issue: `import.meta.dir` errors from `tsc`

**Cause:** it's a Bun-specific extension.
**Solution:** keep the `// @ts-expect-error import.meta.dir is Bun-specific` comment above the line in `scripts/release.ts`.

### Issue: Type import errors

Use `import type` for types:

```typescript
import type { ChatMessage, CliConfig } from './core/types.js';
```

### Issue: Undefined content in streams

```typescript
const delta = chunk.choices?.[0]?.delta?.content;
if (delta) process.stdout.write(delta);
```

### Issue: Missing environment variables

Run `kob config` (or `/config` inside the REPL) — the form writes `.env` / `.env.local` in your project root automatically.

```bash
export KOB_API_KEY=xxx          # only if you must bypass the form
export KOB_MODEL_ID=deepseek/deepseek-v4-flash
```

## Future Enhancements

- Conversation export to Markdown / JSON
- Multi-profile `.env` switching
- Plugin hooks (pre/post tool execution)
- Built-in token cost estimator
- In-terminal Markdown preview pane

Out of scope, intentionally: editor plugin, GUI client, global cross-project memory store.

## Dependencies

### Production
- `@clack/prompts` — interactive form widgets
- `chalk` — terminal styling
- `commander` — CLI framework

### Development
- `@types/node` — Node type definitions
- `typescript` — TypeScript compiler

`bun` is the runtime and package manager (no separate npm lockfile is shipped).

## Build & Release

### Development
```bash
bun run dev                # live REPL
bun run typecheck          # tsc --noEmit
```

### Production binary
```bash
bun run build:only         # compile to ./kob-cli.exe (no version bump, no publish)
```

### Auto release (bump + build + publish + push + tag)
```bash
npm run build              # full auto release on default branch
npm run release:patch      # explicit patch bump
npm run release:minor      # explicit minor bump
npm run release:major      # explicit major bump
```

`npm run build` is intentionally a release — it bumps `package.json`, builds the binary, runs `npm publish`, and creates the `vX.Y.Z` git tag. Use `build:only` for plain binary compilation.

## Reference

- **Source map**: this file (`AGENTS.md`)
- **Detailed design log**: [`docs/00-overview.md`](docs/00-overview.md) through [`docs/17-legacy-and-migration-notes.md`](docs/17-legacy-and-migration-notes.md)
- **API client**: `src/core/api.ts`
- **Engine**: `src/core/engine.ts`
- **REPL loop**: `src/repl.ts`
