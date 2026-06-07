---
title: "16 - History and Sessions"
type: runtime
status: active
created: 2026-06-07
updated: 2026-06-07
tags:
  - kob-cli
  - history
  - sessions
---

# 16 - History and Sessions

KOB CLI persists conversation state per working directory so the assistant can resume project context naturally.

## Storage location

Session files live under:

```text
~/.kob-cli/sessions/
```

The exact file name is derived from a SHA-1 hash of `process.cwd()`, truncated to 16 hex characters.

## Why cwd-scoped sessions matter

This design gives the right default behavior for a coding assistant:

- each repository keeps its own transcript
- changing directories means changing sessions
- reopening the same project restores recent context
- unrelated projects do not leak history into each other

## Stored data shape

The persisted JSON contains:

- `exchanges` - summarized rounds for replay and reporting
- `messages` - the transcript sent back to the model on later turns

The structure is defined by `SessionData` in `src/core/history.ts`.

## Trimming strategy

`saveHistory()` deliberately trims stored data:

- only the last `40` exchanges are kept
- only the last `60` messages are kept

This prevents unbounded growth and keeps resumed sessions manageable.

## Session lifecycle

### On startup
`createInitialState(cfg)` calls `loadHistory()` and seeds the engine with saved exchanges and messages.

### During use
Every successful or partially successful turn goes through `finalize()` in the engine, which calls `saveHistory()`.

### On clear/reset
- `/clear` and `/newchat` wipe exchanges and messages
- `/reset` also wipes history, then re-reads the model default from env if present

All of these use `clearHistory()` underneath.

## Failure behavior

History persistence is intentionally non-fatal:

- malformed JSON falls back to an empty session
- file write failures are ignored silently
- missing session files are treated as fresh starts

This keeps the CLI resilient even when the local cache is corrupted or unavailable.

## What is not persisted

Several runtime helpers stay local to the current process only:

- `lastUndo`
- `lastSearch`
- active spinner or abort state
- transient command approval prompts

This is a good trade-off because those values are tied to one active terminal interaction rather than long-term project memory.

## Operational implications

If a user reports surprising resumed context, the first places to check are:

1. current working directory
2. session file under `~/.kob-cli/sessions/`
3. whether they expected `/clear` or `/reset` semantics

## Recommended future enhancements

Possible next steps if session handling evolves:

- explicit session listing and deletion commands
- export/import of transcripts
- richer metadata in session files, such as timestamps or project names
- optional user-controlled retention policies
