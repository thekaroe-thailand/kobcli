---
title: "00 — Overview"
type: overview
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - kob-cli
  - overview
---

# 00 — Overview

## What is KOB CLI?

`kob-cli` is an **AI coding agent for the terminal**. The same package ships:

1. A **classic CLI** with subcommands (`auth`, `chat`, `stream`, `models`, …) for scripting and CI.
2. A **full-screen TUI** that is the default when you run `kob` with no arguments — a btop-styled chat workspace with a brand header, conversation panel, mode selector, and bottom key-bindings bar.

It talks to a single backend, the **KOB AI** API (`https://www.kob-ai.dev`), over an OpenAI-compatible `/api/v2/chat/completions` endpoint, and can stream responses.

## Who is it for?

Developers who want a fast, keyboard-only, terminal-native AI assistant that:

- **just works** — `npm i -g kob-cli && kob` drops you straight into a chat.
- **respects the terminal** — btop-style panels, TUI conventions, no Electron, no browser.
- **runs the code for you** — in `code` mode, model-written shell commands are executed automatically so you can stay in the loop without copy-pasting into another window.
- **stays in flow** — `Tab` cycles Ask/Plan/Code, `/` opens a slash-command palette, model picker is a keystroke away.

## Feature highlights

- **TUI by default** — `kob` alone opens the btop-styled workspace. See [[04-tui-layout]].
- **Three modes** — `Ask` (questions only) · `Plan` (design before code) · `Code` (write + auto-execute). Tab to cycle, `1/2/3` to jump.
- **Slash commands** — `/ask`, `/plan`, `/code`, `/clear`, `/reset`, `/models`, `/config`, `/help`, `/exit`. Type `/` to see them all. See [[07-slash-system]].
- **Model picker** — `/models` opens a searchable list of every model in the catalog; current model is marked. See [[09-models-picker]].
- **Image paste** — `Ctrl+V` pastes an image from the OS clipboard (Windows/macOS/Linux), or paste a file path with text. The badge `👁 vision` / `◌ text-only` tells you whether the active model can actually read it. See [[06-images-vision]].
- **Auto-run shell commands** — in `code` mode, fenced `bash` / `sh` / `shell` blocks in the model's response are executed via `execSync` (60-second timeout, first 8 output lines captured).
- **128k context** — `max_tokens: 16384` and a 131072 visual ceiling in the session stats.
- **Multi-turn** — every round is appended to an in-memory `messagesRef`; you can build up a long debugging session without losing context.
- **Built-in `/config`** — edit `BASE_URL`, `API_KEY`, `MODEL_ID` and write them to `.env.local` without leaving the TUI. See [[08-config-and-env]].
- **Live scroll** — long conversations auto-scroll to bottom; `PgUp` / `PgDn` / `g` / `G` for manual navigation. See [[05-conversation-scrolling]].
- **Native binary** — `bun build --compile` produces a self-contained `kob-cli.exe` for distribution.

## Philosophy

- **Terminal first.** Every interaction has a keyboard binding; no mouse required.
- **No magic, no framework tax.** A handful of well-named Ink components, no global state library.
- **One source of truth for the model id, key, and URL.** `.env.local` (or `.env`) — read at startup by `[[config]]` and re-read by `/config` and `/reset`.
- **Visible feedback.** The brand header always shows model, vision capability, context usage, and status. See [[04-tui-layout]].
- **Thailand-built.** This project deliberately highlights its origin (see brand identity in the [[README]]).

## Non-goals

- **No background daemon, no remote server.** `kob-cli` is a CLI; it exits when you exit.
- **No proprietary local state.** History is in-memory; use `/clear` to forget.
- **No images sent over the wire yet.** Pasted images are saved to `~/.kob-cli/images/` and their **paths** are appended to the user message — the API client does not yet send multimodal content. See [[12-known-limitations]].

## See also

- [[01-architecture]] — how the pieces fit together
- [[02-source-map]] — file-by-file tour
- [[04-tui-layout]] — the TUI itself
