---
title: "08 — Config & env"
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

# 08 — Config & env

KOB CLI keeps all runtime configuration in a single global `env`-style file under `~/.kob-cli/config.env`. The user can edit it two ways:

1. By hand with any text editor (Bun auto-loads on next launch).
2. From inside the TUI with `/config`, which writes through `[[env-file]]`.

## Files considered

`getEnvPath()` reads from the first existing path in this order:

1. `~/.kob-cli/config.env`
2. legacy project-local `.env.local`
3. legacy project-local `.env`

Writes always go to `~/.kob-cli/config.env`. If the global file does not exist yet but a legacy local file does, the writer seeds the new global file from that local content to migrate older installs forward.

## Loading

`getConfig()` reads the KOB config file directly, then mirrors those values into `process.env` via `loadEnv()`. This keeps one shared config across projects even when Bun auto-loads a project-local `.env`.

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

`src/utils/env-file.ts` is the only file in the project that **reads from / writes to the config file directly** (not `process.env`). This is the bridge the `/config` form uses.

### `readEnvFile()`

- Returns `Record<string, string>`.
- Skips blank lines and `#` comments.
- Strips surrounding quotes from values.
- If the file doesn't exist → returns `{}`.

### `writeEnvFile(updates, comments?)`

- Preserves all existing lines, comments, and ordering.
- Replaces any line whose key is in `updates`.
- Appends any new keys at the end (with a blank line separator and an optional `# comment` line).
- If the global file doesn't exist, seeds it from a legacy local env file when present, otherwise writes a minimal header.

```ts
writeEnvFile(
    { KOB_API_KEY: 'kob_xxx:newtoken' },
    { KOB_API_KEY: 'Your API Key (format: kob_xxx:your_token or just kob_xxx)' },
);
```

### `describeEnvPath()`

Returns the global path the form will write to — used in the UI for transparency.

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
File: C:\Users\you\.kob-cli\config.env
↻ Restart KOB CLI to apply the new settings (env vars are loaded at startup).
Press any key to return to the chat…
```

`process.env` is updated from the global file so every command resolves the same shared KOB config. We still refresh `configRef.current` in `CodeEngine`, and `setModel` is called if the model id changes.

## `/reset`

A lighter alternative: re-reads the global config file and resets the model to `KOB_MODEL_ID` (or the default fallback). Does **not** touch the API key or base URL. Also clears the session.

## Adding a new env key

1. Extend `CliConfig` in `src/types/index.ts`.
2. Read it in `getConfig()` with a sensible default.
3. Add it to the `FIELDS` array in `[[config-form]]`.
4. Update this file.
