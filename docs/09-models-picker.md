---
title: "09 — Models Picker"
type: reference
status: active
created: 2026-06-05
updated: 2026-06-13
tags:
  - kob-cli
  - models
  - palette
  - search
  - rail
---

# 09 — Models Picker

`/models` opens the model picker — a searchable overlay with a left rail border that lists every model in the KOB AI catalog and lets the user pick one to switch to.

## Implementation

Located in `src/ui/prompts.ts`:
- `pickModel()` — entry point, fetches models, delegates to search UI for large lists
- `pickModelWithSearch()` — real-time search with left rail, arrow navigation, and Enter/Esc handling

## Data source

- Endpoint: `POST /api/models` (via `KobApiClient.listModels()`)
- Returns normalized `ModelInfo[]` array
- Each model has `id`, `displayName`, `provider`, `inputPricePer1M`, `outputPricePer1M`

## UI Design (Large Lists > 12 Models)

### Left Rail Border
All output lines are prefixed with a left rail `│` for visual consistency with the conversation frame:

```
  │ ◆ Search: deepseek█
  │ 19 models
  │ ───────────────────────────────────────
  │ ▸ ● deepseek-v4-pro  [kob]  in $0.27/1M | out $1.10/1M
  │   ○ deepseek-v4-flash  [kob]  in $0.14/1M | out $0.56/1M
  │   ○ qwen3.7-max  [kob]  in $0.50/1M | out $2.00/1M
  │ ...
  │ 1-12 of 19
  │ ↑↓ navigate · Enter select · Esc cancel
```

### Real-time Search
- **Live filtering** as you type — searches model ID and label (case-insensitive substring)
- **Arrow keys** (↑↓) navigate filtered results
- **Enter** selects highlighted model
- **Esc** cancels and returns to REPL
- **Scroll indicator** shows position when list exceeds visible rows
- **Current model** marked with green `●`
- **Selected item** highlighted with cyan `▸` and background

### Navigation

| Key | Effect |
|-----|--------|
| Printable character | append to search query, reset selection to top |
| `Backspace` / `Delete` | remove character from query |
| `↑` | selection up |
| `↓` | selection down |
| `Enter` | pick the highlighted model |
| `Esc` | cancel and return to REPL |
| `Ctrl+C` | cancel and return to REPL |

### Small Lists (≤ 12 Models)
Uses `@clack/prompts` `select()` widget directly — no custom search UI needed.

## Lifecycle

```
fetch models → spinner "Fetching models"
             ↓
         ≤ 12 models? → @clack select widget
             ↓
         > 12 models → pickModelWithSearch()
             ↓
         render rail + search prompt
             ↓
         user types → filter + re-render
             ↓
         Enter → formatModel() + return
         Esc → return null
```

## On select

In `src/repl.ts`:

```ts
case 'models': {
    const m = await pickModel(state.model);
    if (m) { state = { ...state, model: m }; banner(`Model → ${m}`, C.amber); }
    return { state };
}
```

- Updates `state.model`
- Shows confirmation banner: `◆ Model → deepseek/deepseek-v4-pro`

## Failure modes

- **Network error** → spinner shows "Could not fetch models", falls back to manual text input
- **Empty catalog** → manual text input for model ID
- **No search matches** → shows "0 models", user can clear query to see all

## Adding filters

The picker currently supports a single text search across model ID and label. To add additional filters (e.g., provider-only filter):

1. Add a `providerFilter` state in `pickModelWithSearch()`
2. Bind a hotkey in `onKeypress` to toggle provider filter
3. Apply it in the `getFiltered()` function

## 2026-06-13 Update: Left Rail + Real-time Search

Added left rail border (`│`) and real-time search functionality to the model picker for large model lists (> 12 models):

- **Left rail**: All model list output now uses `railLine()` helper that prefixes each line with `  │ ` for visual consistency with conversation frames
- **Real-time search**: New `pickModelWithSearch()` function provides live filtering as you type, arrow key navigation, scroll indicator, and Enter/Esc handling
- **Search scope**: Case-insensitive substring search across model ID and full label (including provider and pricing)
- **Visual markers**: Current model marked with green `●`, selected item with cyan `▸` and highlighted background
- **Navigation hint**: Bottom line shows `↑↓ navigate · Enter select · Esc cancel`
