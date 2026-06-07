---
title: "17 - Legacy and Migration Notes"
type: reference
status: active
created: 2026-06-07
updated: 2026-06-07
tags:
  - kob-cli
  - legacy
  - migration
---

# 17 - Legacy and Migration Notes

This repository contains traces of earlier architecture iterations. That is normal, but it is important not to confuse historical files with the active runtime.

## What is current

As of the current v2 codebase, the primary runtime is:

- `src/index.ts`
- `src/repl.ts`
- `src/core/*`
- `src/tools/*`
- selected helpers in `src/ui/*`

If you want to know what the shipped product does, start from those files.

## What appears legacy or transitional

### `src/commands/`
Contains command implementations that are not all registered by the current entry point.

### `src/utils/`
Contains an older utility layout that overlaps with the newer `src/core/` structure.

### `src/logic/`
Contains logic modules from a different organization pass.

### `src/ui-backup/`
Contains backup copies of previous UI files.

### Older docs in `docs/`
Some pages describe an Ink full-screen TUI centered around `code-tui.tsx`. Those pages may still contain useful design intent, but they should not override the actual imports and control flow in the current source.

## How to work safely in this mixed-history repository

When editing behavior:

1. trace from `src/index.ts`
2. confirm the imported runtime path
3. check whether the target file is still referenced
4. prefer the actively imported module over a similarly named legacy file
5. update docs after choosing the authoritative path

## Recommended cleanup directions

If the team chooses to reduce confusion later, likely cleanup candidates are:

- remove or archive unused root artifacts
- collapse duplicate `core` / `utils` responsibilities
- prune backup UI files once the new runtime is fully settled
- annotate old docs more explicitly or move them under a `legacy/` subfolder

## Why this note exists

The project has reached a strong, more mature phase, and that means documentation should help contributors distinguish between:

- active runtime behavior
- legacy implementation history
- future ideas that are not yet wired into `src/index.ts`

This page exists to keep that boundary clear.
