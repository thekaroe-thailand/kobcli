---
title: "12 — Known Limitations"
type: reference
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - kob-cli
  - limitations
  - roadmap
---

# 12 — Known Limitations

Things that are intentionally simple today, or that haven't been built yet. Use this as a checklist for future work, and as a way to set expectations with the user.

## Image upload is path-only

**Today.** `Ctrl+V` saves the image to `~/.kob-cli/images/` and appends its path to the user message. The `KobApiClient.chatStream` sends only `content: string`, so the **bytes are not** transmitted.

**Why it's OK for now.** Most vision-capable models in the catalog have their own tool/agent layer that can read a file path from disk on the model-server side. The path gives the model enough context to reason about the image. For models that don't (and for any model that the model-server can't reach), the image is effectively ignored.

**To make it true multimodal:**

1. Extend `KobApiClient.chatStream` to accept a richer message shape:
   ```ts
   type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
   type Message = { role: string; content: string | ContentPart[] };
   ```
2. In `CodeEngine.handleSubmit`, build `ContentPart[]` with the image bytes as `data:image/png;base64,…` (or a presigned URL if the API supports it).
3. Adjust the request body to match whatever shape the server expects (likely OpenAI multimodal).

This is the highest-impact unimplemented feature.

## Command-result output is capped at 8 lines

`runShellCommand` keeps the first 8 lines of stdout/stderr to keep the round height predictable for the scroll engine (see [[05-conversation-scrolling]]). If a user wants the full log, they can `cat` the file the command wrote (or we could add a "see full output" affordance later).

## Timeout is 60 seconds per shell command

`runShellCommand` uses `execSync` with `timeout: 60_000`. Long-running commands (e.g. `npm install` for a fresh project) will be killed and the result will say "timed out". The user can run them again or use a longer-lived shell outside of KOB CLI.

## Conversation history lives only in memory

`/clear` and `/reset` wipe `exchanges` and `messagesRef`. There is no on-disk log to resume from. The round metadata (input, output, files, commands, model, tokens) is lost when the process exits.

Possible future work:
- Persist to `~/.kob-cli/sessions/<id>.json` after every round.
- A `/history` slash command to list past sessions.
- `--resume <id>` on the CLI to bring one back.

## `index.ts` and `json` in the project root

- `index.ts` at the root is a leftover Bun scaffold (`console.log("Hello via Bun!")`). Not the entry; the real entry is `src/index.ts`. Safe to delete.
- The `json` file at the root is 499 bytes of stray output from a test run. Safe to delete.

## `projects:*`, `rules:*`, `credits:*` are documented but minimal

The `AGENTS.md` (root) lists `projects:list|create|update|delete`, `rules:list|create|update|delete`, and `credits:history` as part of the design surface. Some of them may not be implemented yet — they appear in the architecture diagram and the one-shot CLI list, but the user is currently driving the project through the TUI. The cleanest path forward is to keep them as one-shot CLI commands (mirroring `models`) rather than re-implementing them in the TUI.

## `useViewportSize` is not available in Ink 7

Ink 7.0.5 doesn't ship a `useViewportSize` hook. We track the terminal height ourselves by listening to `process.stdout` `resize` events and storing the value in `useState`. This is reactive enough for our purposes but is a known workaround.

## `oklch`/modern CSS color names are not used

We stick to hex tokens (see `[[colors]]`) because not every terminal emulator supports OKLCH or named CSS colors. If a future terminal does, this is a low-risk upgrade.

## No MCP / tool-use layer

The TUI is purely a chat surface. It doesn't manage tool definitions, function-calling, or MCP servers. If the model writes `bash` code blocks, we execute them; otherwise we don't intercept anything.

## Native binary is large

`bun build --compile` produces a ~70 MB executable. This is normal for a runtime-bundled binary but worth knowing. Compression (UPX) is a future option if size matters.

## No automatic updates

The user runs `npm i -g kob-cli` to upgrade. There's no in-app "new version available" banner. Low priority.

## No telemetry

Zero analytics, zero network calls outside of explicit API requests. The only side-effects of running `kob` are: the API call, the writes to `~/.kob-cli/images/` for pasted images, and (when `/config` is used) writes to `.env.local`.

## See also

- [[06-images-vision]] — the current image flow
- [[10-build-and-release]] — the release process
- [[01-architecture]] — overall structure
