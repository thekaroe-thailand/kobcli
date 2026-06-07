---
title: "15 - Tools Layer"
type: reference
status: active
created: 2026-06-07
updated: 2026-06-07
tags:
  - kob-cli
  - tools
  - reference
---

# 15 - Tools Layer

The `src/tools/` directory contains the local capability layer that the engine and REPL rely on.

## Philosophy

These modules are intentionally small and mostly synchronous. They optimize for predictability and terminal UX rather than maximum abstraction.

## `files.ts`

This is the most important tool module.

### Main responsibilities
- safe project-scoped file reads
- safe writes with previous-content capture
- string replacement with uniqueness checks
- restore support for `/undo`
- recursive text search across project files
- bulk replace across search scope or the whole project
- generated file tree output for prompts and `AGENTS.md`

### Safety rules
- all paths are normalized to relative project paths
- writes and reads are rejected if they would escape the project root
- hidden and ignored directories are skipped during search/tree generation
- very large or binary-like files are skipped for text search

### Search helpers
`searchTextInFiles()` returns:
- matching files
- hit previews with line and column
- total matches and scanned file counts

`replaceTextInFiles()` performs a bulk literal replace and returns per-file before/after metadata.

## `shell.ts`

This module classifies and runs shell commands.

### Features
- readonly command prefix detection
- dangerous command regex detection
- synchronous execution through `spawnSync(..., { shell: true })`
- capped buffer size and timeout
- helper for skipped command results

### Command classes
- `readonly` - safe inspection commands such as `rg`, `git status`, `pwd`
- `mutating` - commands that may change the repo or filesystem
- `dangerous` - explicitly risky commands such as force resets or destructive deletes

The classification affects whether the REPL auto-approves, prompts, or strongly warns.

## `parser.ts`

This module turns model output into executable structure.

### Supported parsers
- `parseFileBlocks()`
- `parseToolCalls()`
- `parseShellCommands()`
- `stripToolSyntax()`
- `parseCommandArgs()`

### Why it matters
Without this module the engine would only have prose. The parser is the bridge from assistant text to local action.

## `git.ts`

A lightweight helper for repo awareness.

### Data returned
- whether the cwd is inside a git repo
- current branch
- dirty file count
- ahead / behind counts when upstream exists

This information is used for the status display and `/git` output.

## `clipboard.ts`

A small helper used by the REPL so the user can quickly copy the last assistant response by typing `y`.

## `diff.ts`

Supports human-readable diffs shown after changes and in `/diff` output.

## Why these tools are not hidden inside the engine

Keeping these capabilities in dedicated modules has clear benefits:

- easier unit testing in the future
- smaller engine logic
- reusable behavior for both normal turns and slash commands
- explicit local safety boundaries

## Extension guidelines

If you add a new local capability:

1. decide whether it belongs in the REPL, engine, or tools layer
2. keep filesystem access project-scoped by default
3. return structured result objects instead of printing directly
4. let the REPL decide how the user sees the output
5. document the new capability in [[14-engine-and-tool-execution]] if the model can invoke it
