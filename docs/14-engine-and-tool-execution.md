---
title: "14 - Engine and Tool Execution"
type: runtime
status: active
created: 2026-06-07
updated: 2026-06-07
tags:
  - kob-cli
  - engine
  - tools
---

# 14 - Engine and Tool Execution

`src/core/engine.ts` is where KOB CLI becomes an agent instead of a plain chat client.

## Core state

The engine operates on `EngineState`:

- `exchanges` - completed rounds with metadata
- `messages` - chat transcript sent back to the model
- `mode` - current behavior mode
- `model` - active `provider/model` identifier

The engine returns updated state plus:

- optional error text
- an `undo` array describing how to revert written files

## Turn lifecycle

`handleSubmit(state, input, hooks)` follows this high-level lifecycle:

1. resolve mode and configuration
2. construct the outbound message list by appending the user input
3. add a mode-specific system prompt
4. in ask/plan/code-related flows, append the current working directory and generated file tree to the system prompt
5. stream assistant output from `KobApiClient.chatStream()`
6. parse the assistant output for tool calls, file blocks, and shell commands
7. execute allowed actions and collect results
8. feed execution results back as synthetic user messages when more rounds are needed
9. finalize the exchange and persist history

## Multi-round execution

The engine allows up to `MAX_ROUNDS = 12` rounds during a single submitted turn.

This is what makes iterative tool use possible:

- the assistant asks to read a file
- the engine reads it and returns the content as a tool result
- the assistant emits a replacement or file write
- the engine applies it and reports the result
- the assistant may then emit a shell command or finish with an explanation

## Tool syntaxes supported

### XML-like tool tags
The parser accepts:

- `<tool:read_file>`
- `<tool:str_replace>`
- `<tool:write_file>`

Each includes nested tags such as `<path>`, `<old_str>`, `<new_str>`, or `<content>`.

### Fenced file blocks
The parser can also interpret fenced code blocks whose info string carries a path, for example:

```text
```ts:src/example.ts
...
```
```

or code blocks whose first line is a file path comment.

### Shell blocks
In code mode, fenced blocks marked as shell-like languages or inline `$ ...` lines can become commands.

## Execution details

### File reads
- executed through `safeReadFile()`
- result text is returned to the model in a `<tool_result:read_file ...>` wrapper
- read metadata is stored in the exchange

### String replacement
- executed through `applyStrReplace()`
- requires exactly one match of `old_str`
- successful replacements create undo snapshots
- results are stored as `StrReplaceResult`

### File writes
- executed through `writeFile()`
- directories are created as needed
- previous content is captured when the file existed already
- results are stored as `FileChange`

### Shell execution
- only in mutating mode
- command kind is classified as `readonly`, `mutating`, or `dangerous`
- readonly commands may auto-approve depending on config
- all other commands can be routed through a user approval hook
- results are captured as `CommandResult`

## Progress hooks

The engine stays UI-agnostic by exposing hooks instead of printing directly.

Important hooks include:

- `onProgress`
- `onToken`
- `onRoundStart`
- `approveCommand`
- `onFileChange`
- `onStrReplace`
- `onCommand`
- `onReadFile`

The REPL supplies these hooks to update spinners, show diffs, and prompt the user.

## Context and token helpers

The engine includes lightweight helpers for approximate token accounting:

- `countTokens(text)` approximates by `text.length / 4`
- `contextUsage(messages)` sums estimated message usage
- `getContextWindow(model)` returns known context sizes for common models, defaulting to `128000`

These numbers are pragmatic approximations for CLI UX, not billing-grade accounting.

## Nudge behavior

In code mode the engine contains an important fallback: if the model only describes a change and emits no actual tool call, file block, or shell command, the engine nudges it once with a corrective instruction telling it to emit a real edit.

This significantly improves reliability for code-generation turns where the assistant might otherwise speak abstractly without changing files.

## Finalization

At the end of the turn the engine builds an `Exchange` object containing:

- raw input and output
- model and mode
- token estimates
- file changes
- created file paths
- command results
- string replacements
- read file metadata
- round duration

That exchange and the final message list are then saved through `saveHistory()`.

## Error handling

The engine treats several classes of failure differently:

- missing config -> friendly error asking the user to run `/config`
- abort signal -> finalize partial content with `Interrupted.`
- API or runtime errors -> redact sensitive token-like strings before returning the message
- history save failures -> non-fatal and silent in the persistence layer

## Design takeaways

The engine is intentionally simple in structure:

- parse model output
- execute safe local actions
- feed structured results back to the model
- persist a useful exchange record

That simplicity makes it easier to extend with new tools or validation rules later.
