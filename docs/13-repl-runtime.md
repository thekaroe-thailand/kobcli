---
title: "13 - REPL Runtime"
type: runtime
status: active
created: 2026-06-07
updated: 2026-06-07
tags:
  - kob-cli
  - repl
  - runtime
---

# 13 - REPL Runtime

This page explains the real interactive runtime implemented in `src/repl.ts`.

## Purpose

The REPL is the main product experience. It wraps the engine with terminal UX:

- prompts and banners
- session resume behavior
- slash command routing
- command approval prompts
- progress reporting for reads, writes, replacements, and shell commands
- undo and local search state between turns

## Startup sequence

`runRepl(version)` does the following in order:

1. load environment values via `loadEnv()`
2. disable terminal mouse mode if enabled
3. try to read config via `getConfig()`
4. if config is missing, open the config editor and retry
5. create initial engine state via `createInitialState(cfg)`
6. initialize local helper state:
   - `lastUndo`
   - `lastSearch`
7. show the banner and either:
   - greet a fresh session, or
   - replay the last two exchanges from persisted history

## Main loop

Each REPL cycle:

1. reads git status via `getGitInfo(process.cwd())`
2. renders a status header
3. prompts the user with a mode-colored label
4. branches on the input type

### Input branches

**Null input**
- user cancelled or closed input; the REPL exits gracefully

**Empty input**
- ignored

**Shell input**
- if the line starts with `$ ` or `> `, it runs immediately through `runShellCommand()`

**Clipboard shortcut**
- entering `y` copies the last response to the clipboard when one exists

**Slash command**
- routed into `handleCommand()`
- unknown slash commands open the command picker

**Normal text**
- becomes an engine turn through `runTurn()`

## Known slash commands

The REPL currently recognizes:

- `chat`, `ask`, `plan`, `code`
- `clear`, `newchat`, `reset`, `exit`, `quit`
- `help`, `models`, `config`
- `git`, `diff`, `undo`, `tokens`, `init`
- `find`, `replace`

This list is defined by `KNOWN_COMMANDS`.

## `runTurn()`

`runTurn()` is the bridge between user input and the core engine.

Responsibilities:

- open a round frame in the UI
- create a `TurnIO` helper with spinner and abort controller
- enable Esc / Ctrl-C handling during the active turn
- call `handleSubmit()` with progress hooks
- temporarily stop the spinner whenever a file read, file change, replace, or command report is printed
- ask for user approval before mutating or dangerous shell commands when needed
- show the final rendered response
- warn in code mode if the model made no actual changes

## `TurnIO`

`TurnIO` manages keyboard interruption during an active generation.

Behavior:

- lone `Esc` aborts the current request
- `Ctrl-C` exits the process with code `130`
- multi-byte escape sequences such as arrows and wheel events are ignored

This avoids treating every escape sequence as a hard abort.

### Focus recovery on Windows

When the REPL is waiting for keyboard input, Windows terminals can silently drop raw mode after the user clicks away to another window and then clicks back. The prompt layer and `TurnIO` both run a lightweight stdin guard that re-applies raw mode, resumes stdin, and disables mouse reporting while they are active so typing recovers automatically after focus returns.

## Slash command handling

`handleCommand()` first gives `applySlashState()` a chance to process mode and session commands:

- `/chat`, `/ask`, `/plan`, `/code`
- `/clear`, `/newchat`
- `/reset`
- `/exit`, `/quit`

If not handled there, the REPL processes feature commands such as:

- `/models` -> opens model picker and updates `state.model`
- `/config` -> opens config form and refreshes model from env if changed
- `/git` -> prints short git status
- `/find` -> searches text through project files and records scope
- `/replace` -> performs bulk replace, optionally scoped to the last search result set
- `/diff` -> prints diffs for the most recent exchange changes
- `/undo` -> restores files from `lastUndo`
- `/tokens` -> shows context usage details
- `/init` -> generates a simple `AGENTS.md` for the current repo if missing

## Local REPL-only state

The REPL holds two important local helper states outside the engine:

### `lastUndo`
Contains the last batch of file snapshots that can be restored by `/undo`.

### `lastSearch`
Contains the last search query and matching file paths so `/replace` can operate on the search scope.

These are intentionally not persisted as part of long-term session history.

## UX design principles in the REPL

- the user always sees progress while the model works
- command execution is visible rather than hidden
- local project tools are quickly accessible without leaving the loop
- the current mode is always visible in the prompt and status header
- recent session context is resumed automatically to preserve flow

## Related docs

- [[14-engine-and-tool-execution]] for the engine beneath the REPL
- [[15-tools-layer]] for the helpers invoked by slash commands and turns
- [[16-history-and-sessions]] for persisted transcript behavior
