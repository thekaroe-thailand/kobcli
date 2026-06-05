---
title: "03 — CLI Commands (Commander)"
type: reference
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - kob-cli
  - cli
  - commander
---

# 03 — CLI Commands (Commander)

The non-TUI face of `kob-cli`. Every subcommand is a one-shot Node-style command, useful for scripting, CI, and piping output to other tools.

If you run `kob` with **no** subcommand, the TUI takes over (see [[04-tui-layout]]). All subcommands live in `src/commands/` and are registered in `src/index.ts`.

## Global flags

Set automatically by `src/index.ts`:
- `program.name('kob')` → binary name in `--help`
- `program.version(VERSION)` → reads `package.json` at runtime, so `--version` always matches what was published
- `program.description(...)` → top-of-help blurb

## Subcommand reference

### `auth:verify`

- File: `src/commands/auth.ts`
- Purpose: confirm the API key is valid against the live endpoint.
- Example: `kob auth:verify`
- Output: spinner → `✓ Authenticated` or `handleApiError(...)`.

### `chat`

- File: `src/commands/chat.ts`
- Flags: `--provider`, `--model`, `--project`, `--temperature`, `--max-tokens`
- Example:
  ```bash
  kob chat "Explain Bun's bundler" --provider DeepSeek --model deepseek-v4-flash
  ```
- Output: full AI reply to stdout (no streaming).

### `stream`

- File: `src/commands/stream.ts`
- Same flags as `chat` but uses `KobApiClient.chatStream` to print tokens as they arrive.
- Example:
  ```bash
  kob stream "Tell me a story" --model deepseek-v4-flash
  ```

### `models`

- File: `src/commands/models.ts`
- Flags: `--provider <name>`, `--format <table|json>`
- Example:
  ```bash
  kob models --provider DeepSeek
  kob models --format json | jq '.[0]'
  ```
- Output: pretty table by default, machine-readable JSON with `--format json`.

### `code` / `ask`

- File: `src/commands/code.ts`, `src/commands/ask.ts`
- One-shot variants of the TUI modes — same backend, no UI.

### `skills`

- File: `src/commands/skills.ts`
- Manages prompt-skill presets (list, add, remove).

### `projects:*` and `rules:*` and `credits:*`

- Listed in `AGENTS.md` (root) as the design surface; some may be implemented later. See [[12-known-limitations]].

## Conventions for new subcommands

1. Create `src/commands/<name>.ts` exporting a `Command` from `commander`:
   ```ts
   import { Command } from 'commander';
   import { KobApiClient } from '../utils/api.js';
   import { getConfig } from '../utils/config.js';
   import { handleApiError } from '../utils/errors.js';

   export const myCommand = new Command('mycommand')
       .description('...')
       .argument('<text>', '...')
       .option('-m, --model <id>', 'Model id')
       .action(async (text, opts) => {
           const client = new KobApiClient(getConfig());
           try {
               const data = await client.post<MyResponse>('/api/...', { ... });
               console.log(data);
           } catch (e) { handleApiError(e); }
       });
   ```
2. Register it in `src/index.ts` with `program.addCommand(myCommand);`.
3. Document it here.

## Error handling pattern

```ts
try {
    const data = await client.post<MyResponse>('/api/...', body);
    console.log(data);
} catch (error) {
    handleApiError(error);
    process.exit(1);
}
```

`handleApiError` in `[[errors]]` translates HTTP statuses into actionable user messages.
