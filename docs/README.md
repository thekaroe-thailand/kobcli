---
title: KOB CLI Documentation
type: moc
status: active
audience: ai-assistants
created: 2026-06-05
updated: 2026-06-05
tags:
  - kob-cli
  - documentation
  - moc
---

# KOB CLI — Documentation Hub

> Complete project knowledge base. This `docs/` folder is the **single source of truth** for AI assistants working on the codebase. Read [[00-overview]] first, then follow the chain below.

## What is this project?

`kob-cli` is a terminal-native AI coding agent built with **Bun + TypeScript + Ink (React for TUI)**. It is published to npm as `kob-cli` and ships with a polished, btop-inspired TUI mode that runs by default when no subcommand is given.

- npm: `kob-cli@1.0.6` (or whatever the current `package.json` says)
- repo: `https://github.com/thekaroe-thailand/kobcli`
- runtime: Bun (TypeScript executed directly) or compiled native `kob-cli.exe`

## Map of Content (MOC)

### Foundations
- [[00-overview]] — purpose, features, philosophy
- [[01-architecture]] — high-level architecture, runtime stack, data flow
- [[02-source-map]] — file-by-file walkthrough of `src/`

### CLI surface
- [[03-cli-commands]] — commander.js subcommands (`auth`, `chat`, `stream`, `models`, `projects`, `rules`, `credits`)

### TUI mode (the default)
- [[04-tui-layout]] — header, conversation, input, overlays
- [[05-conversation-scrolling]] — line-based scroll engine
- [[06-images-vision]] — image paste (Ctrl+V), vision detection
- [[07-slash-system]] — `/ask`, `/models`, `/config`, autocomplete popup
- [[08-config-and-env]] — `/config` form, `.env.local` read/write
- [[09-models-picker]] — `/models` palette, search, picking

### Build, release, operations
- [[10-build-and-release]] — `bun build --compile`, `npm run publish`, version bumping
- [[11-conventions]] — coding style, naming, gotchas
- [[12-known-limitations]] — unimplemented features, intentional shortcuts

## Quick reference for AI agents

**If you are asked to add a slash command:**
1. Add it to `SLASH_COMMANDS` in `[[code-tui]]` (it appears in autocomplete).
2. Add a case in `handleSlashCommand` in `[[code-tui]]` to route it.
3. If it needs an overlay (like `/models` and `/config`), add state + a component in `src/ui/`.

**If you are asked to change the layout:**
- `[[BrandHeader]]` is 3 rows: identity · model info · session stats.
- `[[ConversationPanel]]` is the only main panel; it uses line-based slicing.
- Overlays (`[[ModelPicker]]`, `[[ConfigForm]]`) mount below the conversation.

**If you are asked to change streaming:**
- `[[KobApiClient.chatStream]]` in `[[api]]` returns an `AsyncGenerator<ChatCompletionChunk>`.
- It currently sends OpenAI-compatible text-only messages (`content: string`), so attached images are encoded as path hints in the user message — see [[12-known-limitations]].

**If you are asked to ship:**
1. `bunx tsc --noEmit` (must pass)
2. `npm run build` → produces `kob-cli.exe`
3. `npm run publish` → bumps version, builds, publishes

## Brand identity (do not change without asking)

- Name: **KOB CLI**
- Origin: Thailand 🇹🇭 (red ▰▰ · white ▰ · blue ▰▰)
- Founded by: **Tavon Seesenpila** (founder of Kob AI)
- Tone: confident, modern, terminal-native

## Last updated

This MOC was last regenerated on **2026-06-05**. All files use Obsidian-flavored markdown (frontmatter, `[[wiki-links]]`, `#tags`).
