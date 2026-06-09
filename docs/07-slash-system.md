---
title: "07 — Slash System"
type: reference
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - kob-cli
  - slash-commands
  - tui
  - autocomplete
---

# 07 — Slash System

Inside the TUI, every line that starts with `/` is **intercepted by `CodeEngine.handleSlashCommand`** before it ever reaches the model. The user can also see what commands exist by typing `/` — an autocomplete popup appears under the input.

## Catalog

Defined as `SLASH_COMMANDS` in `[[code-tui]]`:

```ts
{ name, desc, icon, group: 'mode' | 'session' | 'meta' }
```

| Group | Command | Description |
|-------|---------|-------------|
| mode (cyan) | `/ask` | switch to Ask mode (questions only) |
| mode (cyan) | `/plan` | switch to Plan mode (design first) |
| mode (cyan) | `/code` | switch to Code mode (full agent) |
| session (green) | `/clear` | clear this session (forget history) |
| session (green) | `/reset` | reset model to the `.env` default |
| session (green) | `/models` | pick a model from the catalog |
| meta (purple) | `/config` | edit base_url, key, model → `.env` |
| meta (purple) | `/help` | list every slash command |
| meta (purple) | `/exit` | quit KOB CLI |
| meta (purple) | `/find` | Find text within files in `cwd` |
| meta (purple) | `/replace` | Replace exact text across files |
| meta (purple) | `/open` | Open a file to read its contents |
| session (green) | `/project:list` | Select a saved project to switch into |
| session (green) | `/project:create` | Save a project name and path to the global list |
| session (green) | `/project:delete` | Remove a project from the global list |
| meta (purple) | `/init` | Scaffold an `AGENTS.md` file in the current directory |

Adding a new command means adding it to this array **and** adding a `case` in `handleSlashCommand`. Forgetting the second step will leave the command in the autocomplete popup but not actually do anything.

## Dispatcher

`handleSlashCommand(raw: string): boolean` is called from `handleSubmit` *before* the API call. If it returns `true`, the input is treated as handled and never sent to the model. If it returns `false`, the input falls through (currently unreachable because the only entry point is `/`-prefixed strings — kept for future extension).

Each case is short:

```ts
case 'clear':
    setExchanges([]);
    messagesRef.current = [];
    exchangesLenRef.current = 0;
    showBanner('◆ session cleared');
    return true;
```

Some cases open overlays (`/models` → `setPalette('models')`, `/config` → `setConfigOpen(true)`), some mutate mode/state, `/exit` calls `process.exit(0)`.

## The `/` autocomplete popup

`InputBox` watches its own `value` and, when it begins with `/` and contains no whitespace, shows a popup of matching commands.

```ts
const isSlashQuery = value.startsWith('/') && !/\s/.test(value);
const slashMatches = isSlashQuery
    ? SLASH_COMMANDS.filter(c => c.name.toLowerCase().startsWith(slashQuery))
    : [];
const slashOpen = isSlashQuery && slashMatches.length > 0;
```

- `slashQuery` is `value.slice(1).toLowerCase()` (everything after the `/`).
- Matching is `startsWith`, so `/m` → `/models` and `/co` → `/code`.
- The popup sits directly under the input, separated by a thin single-line border in `c.borderAccent`.
- The current selection (`slashIdx`) cycles on `↑` / `↓` and is clamped when the filter shrinks.
- `Tab` fills the highlighted command into the input (`/models `).
- `Enter`:
  - if the highlighted command is an **exact match** of what's typed → execute it immediately (same as submitting).
  - otherwise → fill it in with a trailing space so the user can keep typing arguments.

### Why exact-match execution?

Most slash commands take no arguments. If the user types `/models` and hits Enter, the most useful behavior is to **open the model picker right away**, not to fill the input with `/models ` and force a second Enter. If they typed `/mod` (partial), the next Enter fills it to `/models ` so they can refine (e.g. add a `--search` style argument in the future).

## Steering focus between overlays and `InputBox`

When `palette !== null || configOpen || phase === 'generating'`, `InputBox` receives `isActive: false`. Its `useInput` (and `usePaste`) short-circuit:

```ts
useInput((char, key) => {
    if (disabled) return;
    if (!isActive) return;
    ...
}, { isActive });
```

This is what fixes the original bug: pressing `Enter` inside `ModelPicker` would simultaneously trigger `onSubmit` on `InputBox`, accidentally starting a chat round. Disabling `isActive` while an overlay is open gives the overlay exclusive control of the keyboard.

## Banner feedback

Most `/` commands emit a short banner (`showBanner('◆ mode → Ask')`) that appears under the header for ~2.2 seconds. It's a single Text element, not a notification system.

## `Backspace` and `Esc` while the popup is open

- `Backspace` deletes the last character of the input (and the popup re-filters live).
- `Esc` clears the input **and** the popup if there's anything to clear; otherwise it's a no-op (we don't want Esc to dismiss the whole TUI — that would be too easy to do by accident).

## Adding a new slash command (checklist)

1. Add the entry to `SLASH_COMMANDS` (don't forget `group` for the right color).
2. Add a `case '<name>':` in `handleSlashCommand`.
3. If the command opens an overlay, add a boolean state in `CodeEngine` and mount the overlay in the render tree.
4. Update `isActive` on `InputBox` so the overlay can grab the keyboard.
5. Document it in this file (and in [[09-models-picker]] / [[08-config-and-env]] if it has its own overlay).
