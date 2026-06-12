---
title: "02 - Source Map"
type: reference
status: active
created: 2026-06-05
updated: 2026-06-07
tags:
  - kob-cli
  - source-map
  - reference
---

# 02 - Source Map

A practical map of the repository based on the code that currently matters.

## Root files

| File | Purpose |
|------|---------|
| `package.json` | package metadata, scripts, bin mapping, version |
| `tsconfig.json` | TypeScript compilation settings |
| `README.md`, `QUICKSTART.md`, `INSTALL.md`, `MANUAL.md`, `PROJECT.md`, `SPECTS.md` | top-level product and project documents |
| `AGENTS.md` | workspace guidance for coding agents |
| `kob-cli.exe`, `kob.bat`, `bin/cli.cjs` | launch and distribution artifacts |
| `index.ts` | non-authoritative root file, not the main runtime entry |
| `docs/` | internal project documentation |

## Entry and interactive runtime

| Path | Role |
|------|------|
| `src/index.ts` | real CLI entry point and command registration |
| `src/repl.ts` | interactive REPL loop and slash command dispatcher |

## Core runtime

| Path | Role |
|------|------|
| `src/core/api.ts` | HTTP client for models and chat completions |
| `src/core/config.ts` | environment loading and config assembly |
| `src/core/engine.ts` | turn execution, tool orchestration, exchange creation |
| `src/core/env-file.ts` | shared `~/.kob-cli/config.env` read-write helpers |
| `src/core/history.ts` | cwd-scoped session persistence |
| `src/core/modes.ts` | mode definitions and system prompts |
| `src/core/types.ts` | shared runtime types |

## Tooling layer

| Path | Role |
|------|------|
| `src/tools/files.ts` | safe reads, writes, search, replace, undo restore, file tree generation |
| `src/tools/shell.ts` | command classification and synchronous shell execution |
| `src/tools/parser.ts` | parse tool tags, file blocks, shell blocks, and slash args |
| `src/tools/git.ts` | lightweight repo awareness for the status bar |
| `src/tools/clipboard.ts` | copy the last answer to the clipboard |
| `src/tools/diff.ts` | diff helpers used by rendering |

## UI and presentation

| Path | Role |
|------|------|
| `src/ui/render.ts` | most console rendering helpers and round output |
| `src/ui/prompts.ts` | interactive prompts, config editing, command approval, model picking |
| `src/ui/banner.ts` | welcome and top-level visual identity |
| `src/ui/spinner.ts` | terminal spinner during active turns |
| `src/ui/theme.ts` | color constants and terminal helpers |
| `src/ui/markdown.ts` | markdown-to-terminal rendering |
| `src/ui/model-picker.tsx` | model picking UI component |
| `src/ui/config-form.tsx` | config editing UI component |
| `src/ui/colors.ts`, `src/ui/gradient.ts`, `src/ui/renderer.ts`, `src/ui/tui.ts` | supporting presentation utilities and experiments |

## Commands and alternate surfaces

| Path | Role |
|------|------|
| `src/commands/*.ts` | older or alternate command implementations; not the current authoritative public surface |
| `src/scripts/release.ts` | release automation |

## Transitional and legacy directories

| Path | Role |
|------|------|
| `src/logic/` | parallel or transitional logic modules from a previous architecture iteration |
| `src/utils/` | older utility layer that overlaps conceptually with `src/core/` |
| `src/ui-backup/` | backup copies of the earlier UI architecture |

These directories are useful historical context but should not be assumed to define the current runtime without checking imports from `src/index.ts`.

## Where to edit for common tasks

| Task | Primary files |
|------|---------------|
| Add or change a public CLI command | `src/index.ts` |
| Change REPL behavior | `src/repl.ts` |
| Change mode behavior or system prompts | `src/core/modes.ts`, `src/core/engine.ts` |
| Change tool call execution | `src/core/engine.ts`, `src/tools/parser.ts` |
| Change file safety rules or search/replace | `src/tools/files.ts` |
| Change shell approval logic | `src/tools/shell.ts`, `src/repl.ts` |
| Change session persistence | `src/core/history.ts` |
| Change config loading | `src/core/config.ts`, `src/core/env-file.ts` |
| Change the model picker or config editor UI | `src/ui/prompts.ts`, `src/ui/model-picker.tsx`, `src/ui/config-form.tsx` |

## Important caution

If a document or file name suggests an Ink-based full-screen TUI, confirm whether it is still imported by `src/index.ts` or `src/repl.ts` before editing it. Several such files remain in the repository as history or backups.
