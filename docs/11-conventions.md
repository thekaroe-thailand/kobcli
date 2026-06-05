---
title: "11 — Conventions"
type: reference
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - kob-cli
  - conventions
  - style
---

# 11 — Conventions

The "house style" — the small set of rules we follow everywhere so the codebase stays consistent and easy to read.

## TypeScript

- `tsconfig.json` is strict. Don't add `any`, `// @ts-ignore`, or `as unknown as Foo` to silence the compiler — fix the types.
- `import type` for type-only imports.
- Path-relative imports end in `.js` even for `.ts` files (ESM `type: "module"` quirk):
  ```ts
  import { getConfig } from '../utils/config.js';
  ```
- Top-level `const`s for tokens (colors, modes, slash commands).
- Prefer `interface` for public shapes, `type` for unions/aliases.

## React / Ink

- One component per file when it's reused across the TUI (e.g. `[[model-picker]]`, `[[config-form]]`).
- Big components that aren't reused live inside `[[code-tui]]` (WelcomeHero, ResponseBox, …). Don't extract them just for the sake of file count.
- Always guard `useInput` with an `isActive` option for overlay-able components.
- All `useEffect` cleanups must be symmetric (return the cleanup that undoes the setup).
- `useRef` for mutable values that shouldn't trigger re-renders (e.g. `messagesRef`, `exchangesLenRef`, `configRef`).

## Naming

| Thing | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `BrandHeader`, `ConversationPanel` |
| Functions / helpers | camelCase | `formatV2Model`, `modelSupportsVision` |
| Constants | UPPER_SNAKE | `SLASH_COMMANDS`, `MODES`, `RESERVED_ROWS` |
| Types / interfaces | PascalCase | `Exchange`, `Mode`, `SlashCommand` |
| Color tokens | lower keys in `c` | `c.brand`, `c.textDim` |
| Files | kebab-case | `model-picker.tsx`, `env-file.ts` |

## Error handling

- One-shot CLI commands: `try { ... } catch (e) { handleApiError(e); process.exit(1); }`.
- TUI: errors that abort the action (e.g. a failed network call) call `handleApiError` and `process.exit(1)`. Errors that are recoverable (e.g. a transient `/models` fetch failure) show a toast / inline error and let the user keep working.

## Comments

- Use them sparingly. Prefer self-documenting code.
- Use them in two cases: explaining *why* (intent) and explaining *non-obvious terminal quirks* (e.g. "Bun auto-loads `.env.local` at startup, so we don't read the file ourselves here").
- Don't comment what a function does if its name already says it.
- Module-level banner comments (`// ========== … ==========`) for big sections are fine.

## Output formatting

- `chalk` is available globally but the TUI uses Ink's `<Text color={…}>` exclusively. Don't mix the two — pick one surface per command.
- For TUI always reach for a `c.*` token, never raw hex.

## File layout

- New utilities go in `src/utils/`, new types in `src/types/index.ts`, new TUI components in `src/ui/`.
- If a file grows past ~300 lines, look for a clean extraction; `[[code-tui]]` is the exception (it's the one big TUI file by design).

## Tests

- There is no test framework wired up. Add one only if the user asks for it; for now the smoke test in [[10-build-and-release]] is the safety net.
- Use the manual testing checklist in `AGENTS.md` (root) when exercising changes.

## Git (informal)

- Commit messages in English.
- `feat: …`, `fix: …`, `docs: …`, `chore: …` prefixes are nice but not enforced.
- The user drives `git` themselves — the assistant never commits without explicit instruction.
