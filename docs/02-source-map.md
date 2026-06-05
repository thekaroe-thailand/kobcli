---
title: "02 — Source Map"
type: reference
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - kob-cli
  - source-map
  - reference
---

# 02 — Source Map

A file-by-file walkthrough of the project. Use this when you need to find the right place to make a change.

## Root files

| File | Purpose |
|------|---------|
| `package.json` | name `kob-cli`, scripts (`dev`, `build`, `publish`, `release:*`), `bin: kob → bin/cli.cjs`, `files` (tarball whitelist) |
| `tsconfig.json` | strict TypeScript, ESM, JSX (`react-jsx`) |
| `bin/cli.cjs` | CJS shim that `spawn`s `bun src/index.ts`; tells the user to install Bun if it's missing |
| `index.ts` | leftover Bun scaffold ("Hello via Bun!") — **not** the entry. The real entry is `src/index.ts`. Safe to delete. |
| `json` | stray file in the project root (499 bytes) — leftover from a test. Safe to delete. |
| `.env.example` | template copied to `.env.local` on first write by `[[env-file]]` |
| `LICENSE`, `AGENTS.md`, `INSTALL.md`, `MANUAL.md`, `QUICKSTART.md`, `README.md`, `SPECTS.md` | shipped with the tarball (see `files` in `package.json`) |

## `src/index.ts`

The actual entry. Reads its own `package.json` for the dynamic `version`, registers every subcommand, and falls through to `runCodeTui()` (the TUI) if no subcommand is given.

**Important paths inside this file:**
- `const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));`
- `const VERSION: string = pkg.version;` (used by `readVersion()` re-imported into `[[code-tui]]`)

## `src/commands/` (one-shot CLI mode)

| File | Subcommand | Notes |
|------|-----------|-------|
| `auth.ts` | `auth:verify` | checks API key against `/api/auth/verify` |
| `chat.ts` | `chat` | single non-streaming chat (uses `KobApiClient.post`) |
| `stream.ts` | `stream` | streaming chat (uses `KobApiClient.chatStream`) |
| `models.ts` | `models` | lists models from `/api/models` with `--provider` and `--format` flags |
| `code.ts` | (extra) | alternative code-mode CLI flow |
| `ask.ts` | (extra) | alternative ask-mode CLI flow |
| `skills.ts` | (extra) | skill/preset management |

These are useful as a fallback when the TUI is unavailable (e.g. piping into `jq`).

## `src/utils/`

| File | Public API | Notes |
|------|-----------|-------|
| `api.ts` | `KobApiClient`, `ChatCompletionChunk`, `ChatCompletionResult` | `get`, `post`, `chatStream` |
| `config.ts` | `getConfig()` | reads `process.env` (Bun auto-loads `.env.local` / `.env`) |
| `env-file.ts` | `getEnvPath()`, `readEnvFile()`, `writeEnvFile(updates, comments?)`, `describeEnvPath()` | preserves comments, key order; prefers `.env.local` then `.env`; seeds from `.env.example` |
| `format.ts` | `formatDate`, `formatProjects`, `formatRules`, `formatCreditHistory`, `formatUsage` | pretty-print helpers for the one-shot CLI |
| `errors.ts` | `ApiError`, `handleApiError`, `validateRequired` | maps HTTP errors to user-friendly messages |

## `src/types/index.ts`

Single barrel of every interface. Notable ones:
- `CliConfig` — `{ baseUrl, apiKey, apiToken?, bearerToken?, modelId }`
- `ModelsResponse`, `ProviderModels`, `AIModel` — `/api/models` payload
- `ChatResponse` — non-streaming chat reply
- `Project`, `Rule`, `CreditHistory` — admin resources
- `Exchange` lives in `[[code-tui]]` (UI-only)

## `src/ui/` (TUI mode)

| File | Exports | Notes |
|------|---------|-------|
| `code-tui.tsx` | `runCodeTui`, `CodeEngine` (+ all components + helpers) | The big one. ~1700 lines. |
| `colors.ts` | `c` | shared color tokens — import this, never hardcode hex |
| `model-picker.tsx` | `ModelPicker` | The `/models` overlay |
| `config-form.tsx` | `ConfigForm` | The `/config` overlay |

See [[04-tui-layout]] for the per-component breakdown.

## `src/scripts/release.ts`

Stand-alone release script — bumped and publishes on `npm run publish`. See [[10-build-and-release]].

## Quick lookup table

| I want to… | Open this file |
|-----------|----------------|
| Add a subcommand | `src/index.ts` + new `src/commands/<name>.ts` |
| Change the header / logo | `[[code-tui]]` → `BrandHeader` |
| Change the conversation panel | `[[code-tui]]` → `ConversationPanel`, `ConversationView`, `ResponseBox` |
| Add a slash command | `[[code-tui]]` → `SLASH_COMMANDS` + `handleSlashCommand` |
| Add a new overlay | create `src/ui/<name>.tsx`, mount in `CodeEngine` return |
| Change streaming behavior | `[[api]]` → `KobApiClient.chatStream` |
| Change `.env` parsing | `[[env-file]]` |
| Change `KOB_*` env reading | `[[config]]` |
| Change the model picker | `[[model-picker]]` |
| Change the config form | `[[config-form]]` |
| Bump version & publish | `npm run publish` (no code change) |
