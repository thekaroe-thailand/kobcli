---
title: KOB CLI Documentation
type: moc
status: active
audience: ai-assistants
created: 2026-06-05
updated: 2026-06-07
tags:
  - kob-cli
  - documentation
  - moc
---

# KOB CLI - Documentation Hub

> Current documentation for the modern KOB CLI v2 runtime. This folder documents the code that actually ships today: a Commander-based CLI plus a project-scoped interactive REPL backed by the KOB AI API.

## Read this first

Start here if you need accurate project context before making code changes:

1. [[00-overview]] - product purpose, capabilities, and operating model
2. [[01-architecture]] - runtime architecture and data flow
3. [[02-source-map]] - file-by-file map of the repository
4. [[03-cli-commands]] - public command surface exposed by `src/index.ts`
5. [[13-repl-runtime]] - how the interactive loop works
6. [[14-engine-and-tool-execution]] - agent turn execution, tool parsing, approvals, and persistence
7. [[15-tools-layer]] - file, shell, parser, clipboard, and git helpers
8. [[16-history-and-sessions]] - session persistence and reset semantics
9. [[17-legacy-and-migration-notes]] - what is legacy, historical, or partially superseded

## What this project is now

`kob-cli` is a terminal-native AI coding assistant written in TypeScript and intended to run under Bun in development and as a compiled binary in distribution.

The current product surface is intentionally compact:

- `kob` or `kob chat` starts the interactive REPL
- `kob ask <prompt...>` sends a one-off prompt
- `kob models` lists available models from the API
- `kob config` edits `.env.local`
- the REPL itself supports mode switching, slash commands, direct shell execution, search/replace helpers, undo, diff, and session resume

This is not the same architecture described by some older docs in this folder that refer to an Ink full-screen TUI. The shipped runtime is centered on `src/repl.ts` and `src/core/engine.ts`.

## Documentation map

### Core product docs
- [[00-overview]] - high-level product story and feature set
- [[01-architecture]] - module boundaries, runtime flow, and control paths
- [[02-source-map]] - practical source navigation map
- [[03-cli-commands]] - exact commands and flags exposed by the entry point

### Runtime internals
- [[13-repl-runtime]] - interactive loop, slash command handling, and turn orchestration
- [[14-engine-and-tool-execution]] - model interaction and tool execution lifecycle
- [[15-tools-layer]] - safety model and helper modules
- [[16-history-and-sessions]] - persistence model and limits

### Supporting and historical docs
- [[08-config-and-env]] - environment file editing concepts
- [[10-build-and-release]] - build and release notes
- [[11-conventions]] - coding conventions
- [[12-known-limitations]] - current limitations and trade-offs
- [[17-legacy-and-migration-notes]] - how to interpret older documents in this folder

## Recommended reading by task

**Need to change the command surface?**
Read [[03-cli-commands]] and [[02-source-map]], then edit `src/index.ts`.

**Need to change how the interactive assistant behaves?**
Read [[13-repl-runtime]] and [[14-engine-and-tool-execution]], then inspect `src/repl.ts`, `src/core/engine.ts`, and `src/core/modes.ts`.

**Need to modify file writes or shell execution?**
Read [[15-tools-layer]], then inspect `src/tools/files.ts`, `src/tools/parser.ts`, and `src/tools/shell.ts`.

**Need to understand why a previous conversation was resumed?**
Read [[16-history-and-sessions]] and inspect `src/core/history.ts`.

## Project identity

- Name: KOB CLI
- Version line: v2.x
- Runtime goal: beautiful, agentic, terminal-first coding assistant
- API host default: `https://www.kob-ai.dev`
- Origin: built in Thailand

## Notes on accuracy

- Pages `00-03` and `13-17` are aligned to the current codebase as of 2026-06-07.
- Several older pages in `docs/` were written for an earlier UI architecture. Treat them as useful historical context unless they explicitly match the current files under `src/`.
