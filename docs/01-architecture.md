---
title: "01 — Architecture"
type: architecture
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - kob-cli
  - architecture
  - runtime
---

# 01 — Architecture

## Runtime stack

| Layer | Tool | Why |
|------|------|-----|
| Package manager + runtime | **Bun ≥ 1.3** | Fast TS execution, native binary compile, `bun build --compile` |
| Language | **TypeScript** (strict, ESM, `type: "module"`) | Type safety + Node ecosystem |
| TUI framework | **Ink 7.0.5** + **React 19** | React-style components for the terminal |
| CLI parser | **commander 15** | Standard subcommand registration |
| Streams | Native Web Streams (`ReadableStream`) | Used by `KobApiClient.chatStream` |
| Styling | **chalk** + `[[colors]]` token map | Color tokens shared across TUI files |
| Loading spinners | **ora 9** | (Currently unused in TUI mode; we use custom Ink animation) |

## Top-level data flow

```
                     ┌──────────────────────────────┐
   user input        │  bin/cli.cjs                 │
 ──────────────────► │  └─► bun src/index.ts        │
                     └─────────────┬────────────────┘
                                   │
                                   ▼
                     ┌──────────────────────────────┐
                     │  src/index.ts (Commander)    │
                     │  • reads pkg.version         │
                     │  • registers subcommands     │
                     │  • no subcommand → runCodeTui│
                     └─────────────┬────────────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            ▼                      ▼                      ▼
  src/commands/*.ts      src/ui/code-tui.tsx     src/scripts/release.ts
  (one-shot CLI)         (default TUI mode)      (npm publish helper)
            │                      │
            ▼                      ▼
   src/utils/api.ts        src/utils/api.ts
   (KobApiClient)          (KobApiClient.chatStream)
            │                      │
            └──────────┬───────────┘
                       ▼
              KOB AI API (HTTPS)
        https://www.kob-ai.dev/api/v2/chat/completions
        https://www.kob-ai.dev/api/v2/models
```

## Module responsibilities

### Entry: `bin/cli.cjs` + `src/index.ts`

- `bin/cli.cjs` is a CommonJS shim that `spawn`s `bun src/index.ts` and prints a friendly error if Bun is missing.
- `src/index.ts`:
  - reads its own `package.json` via `readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'))` to get the dynamic `version`.
  - registers every subcommand (`auth:verify`, `chat`, `stream`, `models`, etc.).
  - if no subcommand → `await runCodeTui()` (the TUI in `src/ui/code-tui.tsx`).

### `src/commands/*.ts` (one-shot CLI mode)

- Each file exports a `Command` instance from `commander`.
- They share utilities from `src/utils/` (api, config, format, errors).

### `src/ui/code-tui.tsx` (default TUI mode)

The single biggest file. Contains:

- `MODES` — `Ask | Plan | Code` config table.
- `SLASH_COMMANDS` — list rendered in the `/` autocomplete popup.
- Helper functions: `formatNum`, `formatDuration`, `formatV2Model`, `modelSupportsVision`, `isImagePath`, `kobImagesDir`, `attachImagePath`, `pasteImageFromClipboard`, `parseFileChanges`, `parseShellCommands`, `runShellCommand`, `readVersion`, etc.
- Components: `BrandHeader`, `WelcomeHero`, `ConversationView`, `ConversationPanel`, `ResponseBox`, `CommandResultBox`, `InputBox`, `GeneratingPanel`, `BottomBar`.
- Top-level: `CodeEngine` (state + handlers) and `runCodeTui` (mounts the Ink tree).
- See [[02-source-map]] and [[04-tui-layout]] for the full breakdown.

### `src/utils/`

| File | Purpose |
|------|---------|
| `api.ts` | `KobApiClient` — `get`, `post`, `chatStream` (async generator of `ChatCompletionChunk`) |
| `config.ts` | `getConfig()` — reads `.env.local` / `.env` via `process.env` (Bun auto-loads), returns `CliConfig` |
| `env-file.ts` | `readEnvFile()`, `writeEnvFile(updates, comments?)` — preserves comments, key order, creates from `.env.example` if missing |
| `format.ts` | `formatDate`, `formatProjects`, `formatRules`, `formatCreditHistory`, `formatUsage` |
| `errors.ts` | `ApiError` class, `handleApiError`, `validateRequired` |

### `src/types/index.ts`

Single barrel of every TypeScript interface (`CliConfig`, `ModelsResponse`, `ProviderModels`, `AIModel`, `ChatResponse`, `Project`, `Rule`, `CreditHistory`, …).

### `src/scripts/release.ts`

Stand-alone script invoked by `npm run publish`:
1. reads `package.json`
2. bumps `version` (patch)
3. writes it back
4. runs `bun run build`
5. runs `npm publish --ignore-scripts`

## State in TUI mode

There is no global state library. Everything lives in `CodeEngine` (a single React component using `useState` + `useRef`):

| State | Type | Purpose |
|-------|------|---------|
| `exchanges` | `Exchange[]` | history of rounds (input, output, files, commands, model, tokens) |
| `phase` | `'input' \| 'generating'` | drives GeneratingPanel vs InputBox |
| `startMs` / `now` | `number` | tick the elapsed time in the header |
| `mode` | `'ask' \| 'plan' \| 'code'` | drives system prompt + Tab cycle |
| `model` | `string` | current `provider/modelId` |
| `scrollOffset` | `number` | line offset for conversation scroll |
| `palette` | `null \| 'models'` | shows `ModelPicker` |
| `configOpen` | `boolean` | shows `ConfigForm` |
| `banner` | `string \| null` | ephemeral notification under the header |
| `messagesRef` | `useRef<Message[]>` | full conversation history (multi-turn) |
| `exchangesLenRef` | `useRef<number>` | detects new rounds → auto-scroll to bottom |
| `configRef` | `useRef<CliConfig>` | mutable snapshot the streaming handler reads |

## Extending the system

- **Add a new slash command** → edit `SLASH_COMMANDS` + `handleSlashCommand` in `[[code-tui]]`. See [[07-slash-system]].
- **Add a new mode** → extend the `Mode` type, the `MODES` array, and `MODES.systemPrompt`/placeholder.
- **Add a new overlay** (like `ModelPicker` / `ConfigForm`) → create `src/ui/<name>.tsx`, add a boolean state in `CodeEngine`, mount it conditionally below the conversation, and gate `InputBox`'s `isActive` so its keystrokes don't leak.
- **Add a new env key** → extend `CliConfig` in `[[types]]`, surface it in `getConfig()` and `[[ConfigForm]]`.
