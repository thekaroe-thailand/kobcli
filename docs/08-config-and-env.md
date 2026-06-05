---
title: "08 — Config & .env"
type: reference
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - kob-cli
  - config
  - env
  - dotenv
---

# 08 — Config & .env

KOB CLI keeps all runtime configuration in a single `.env`-style file. The user can edit it two ways:

1. By hand with any text editor (Bun auto-loads on next launch).
2. From inside the TUI with `/config`, which writes through `[[env-file]]`.

## Files considered

`getEnvPath()` returns the first existing one in this order:

1. `.env.local` (preferred — this is what Bun and most Node tools treat as "local secrets")
2. `.env`
3. `.env.local` (created on first write if neither exists; the value here is what *will* be returned next time)

## Loading

`getConfig()` in `src/utils/config.ts` reads from `process.env`. **Bun auto-loads `.env.local` and `.env`** at process start, so as long as the user is running via `bun` (which the TUI does), the values are available without any explicit dotenv library.

`CliConfig` shape:

```ts
interface CliConfig {
    baseUrl: string;       // KOB_API_BASE_URL
    apiKey: string;        // KOB_API_KEY  (may be "kob_xxx:token" or just "kob_xxx")
    apiToken?: string;     // parsed from apiKey if present
    bearerToken?: string;  // parsed from apiKey if present
    modelId: string;       // KOB_MODEL_ID (optional, falls back to a default)
}
```

Defaults:
- `baseUrl` → `https://www.kob-ai.dev`
- `modelId` → first model in the catalog (a graceful fallback if the env value is missing)

## `[[env-file]]` (the in-process writer)

`src/utils/env-file.ts` is the only file in the project that **reads from / writes to the .env file directly** (not `process.env`). This is the bridge the `/config` form uses.

### `readEnvFile()`

- Returns `Record<string, string>`.
- Skips blank lines and `#` comments.
- Strips surrounding quotes from values.
- If the file doesn't exist → returns `{}`.

### `writeEnvFile(updates, comments?)`

- Preserves all existing lines, comments, and ordering.
- Replaces any line whose key is in `updates`.
- Appends any new keys at the end (with a blank line separator and an optional `# comment` line).
- If the file doesn't exist, seeds it from `.env.example` when present, otherwise writes a minimal header.

```ts
writeEnvFile(
    { KOB_API_KEY: 'kob_xxx:newtoken' },
    { KOB_API_KEY: 'Your API Key (format: kob_xxx:your_token or just kob_xxx)' },
);
```

### `describeEnvPath()`

Returns the path the form will write to — used in the UI for transparency.

## `/config` form (`[[config-form]]`)

A step-by-step wizard, one field at a time:

| Field | Default | Notes |
|-------|---------|-------|
| `Base URL` | `https://www.kob-ai.dev` | trailing `/v1`, `/v2` will be auto-stripped by the API client |
| `API Key` | (current) | rendered as `•••` while editing (secret: true) |
| `Default Model` | (current) | optional — leave empty to keep the auto-default |

### Keys
- `Enter` — commit the current field and advance; on the last field, save and exit.
- `Esc` — cancel without saving.
- `Backspace` — delete the previous character.
- `Tab` — jump to the next field without committing (useful for skipping optional ones).

### What gets written

Only changed fields. The form compares the live value to the initial value and only includes fields that differ in the `writeEnvFile` call. This means an `Esc` after no edits is a no-op.

### After saving

The form shows a green confirmation panel:

```
✓ Configuration saved
File: C:\…\.env.local
↻ Restart KOB CLI to apply the new settings (env vars are loaded at startup).
Press any key to return to the chat…
```

`process.env` is **not** mutated — Bun reads the file once at startup. We do update `configRef.current` in `CodeEngine` so the in-memory snapshot reflects the new defaults, and `setModel` is called if the model id changed, but the running chat session is reset (`setExchanges([])`) and the user is told to restart for the API client to pick up a new `baseUrl` / `apiKey`.

## `/reset`

A lighter alternative: re-reads `.env.local` and resets the model to `KOB_MODEL_ID` (or the default fallback). Does **not** touch the API key or base URL. Also clears the session.

## Adding a new env key

1. Extend `CliConfig` in `src/types/index.ts`.
2. Read it in `getConfig()` with a sensible default.
3. Add it to the `FIELDS` array in `[[config-form]]`.
4. Update this file.
