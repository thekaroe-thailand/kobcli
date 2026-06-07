---
title: "01 - Architecture"
type: architecture
status: active
created: 2026-06-05
updated: 2026-06-07
tags:
  - kob-cli
  - architecture
  - runtime
---

# 01 - Architecture

## Runtime stack

| Layer | Technology | Purpose |
|------|------------|---------|
| Runtime | Bun for development, Node-compatible APIs, compiled Bun binary for release | executes the CLI and build pipeline |
| Language | TypeScript + ESM | strongly typed implementation |
| Command parser | commander | public CLI surface |
| Terminal rendering | chalk + custom console rendering helpers | banners, status, diffs, markdown, prompts |
| Backend client | `KobApiClient` | model catalog and streaming responses |
| Local persistence | JSON files in `~/.kob-cli/sessions` | cwd-scoped transcript resume |

## High-level architecture

The current codebase is organized around a small number of runtime layers:

```text
User
  |
  v
src/index.ts
  |-- kob models
  |-- kob ask <prompt...>
  |-- kob config
  `-- kob chat / default
           |
           v
       src/repl.ts
           |
           v
   src/core/engine.ts
      |        |        |
      |        |        +-- src/tools/shell.ts
      |        +----------- src/tools/files.ts
      +-------------------- src/tools/parser.ts
           |
           v
     src/core/api.ts
           |
           v
     KOB AI HTTP API
```

## Entry flow

`src/index.ts` is the only authoritative entry point.

Responsibilities:

- reads version from `package.json`
- registers the four public commands
- loads configuration when required
- delegates interactive usage to `runRepl()`
- handles top-level fatal exceptions and promise rejections

The root-level `index.ts` file is not the shipping entry point.

## Interactive runtime flow

When the user launches `kob` or `kob chat`, control passes into `runRepl(version)` in `src/repl.ts`.

That loop performs the following steps:

1. load env values into `process.env`
2. ensure configuration exists, optionally opening the config editor
3. create initial engine state from config and persisted history
4. show banner and optionally replay recent exchanges
5. repeatedly:
   - gather git status for the header
   - prompt for input
   - route shell input, slash commands, or a normal agent turn
   - update local undo and search state
   - persist engine state through the core layer

## Core engine responsibilities

`src/core/engine.ts` is the heart of the agentic behavior.

It is responsible for:

- constructing the message list sent to the model
- selecting mode-specific system prompts
- injecting the project file tree for grounded context
- streaming assistant output from the API
- parsing model-emitted tool calls and shell blocks
- performing file reads, file writes, string replacements, and command execution
- collecting an `Exchange` record for history and UI replay
- saving the trimmed session back to disk

The engine does not do user prompting directly. It reports progress through hooks supplied by the REPL.

## Separation of concerns

### `src/repl.ts`
Owns interactive behavior, prompt flow, slash commands, command approval UX, and presentation of progress.

### `src/core/*`
Owns configuration, mode definitions, session persistence, API access, and turn execution.

### `src/tools/*`
Owns low-level operations on files, shell commands, parsing, clipboard, and git metadata.

### `src/ui/*`
Owns user-facing rendering and prompt helpers such as banners, markdown output, spinners, confirmation prompts, and status displays.

## Mutation model

Only modes whose `ModeInfo.canMutate` is true may apply file edits or execute shell commands from model output. In practice this is the `code` mode.

Mutation sources supported by the engine:

- explicit XML-like tool tags such as `<tool:read_file>` and `<tool:str_replace>`
- fenced file blocks whose header includes a path
- fenced shell blocks or `$ ...` lines inside assistant output

The engine gathers the results of all executed actions and feeds those results back into the model as synthetic user messages when multi-round tool usage is needed.

## Safety boundaries

The runtime enforces several important boundaries:

- file paths are normalized and checked to remain inside the working directory
- string replacement requires the `old_str` match to be unique
- dangerous commands are classified separately from readonly commands
- readonly commands may be auto-approved based on configuration
- user approval can be requested for mutating or dangerous commands during a turn
- history persistence failure is treated as non-fatal

## Session model

The application persists a trimmed transcript per project directory.

Effects of this design:

- reopening the same repo resumes recent work automatically
- different repos do not share the same stored transcript
- context files remain small because the engine trims history before saving

## Legacy architecture note

Older documentation refers to an Ink full-screen TUI and `src/ui/code-tui.tsx` as the central runtime. That is no longer the primary architecture. The shipped interactive path is `src/repl.ts` plus `src/core/engine.ts`.

See [[17-legacy-and-migration-notes]] for the distinction.
