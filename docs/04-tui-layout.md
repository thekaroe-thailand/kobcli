---
title: "04 — TUI Layout"
type: reference
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - kob-cli
  - tui
  - layout
  - ink
---

# 04 — TUI Layout

The default experience. Run `kob` with no args and you land here.

## Vertical structure (top → bottom)

```
┌────────────────────────────────────────────────────────────────┐
│  KOB CLI  ASCII logo  (big, cyan+pink)                         │
├────────────────────────────────────────────────────────────────┤
│  KOB CLI  Thailand ▰▰▮▰▰ · powered by Tavon Seesenpila …      │
│  v1.0.5 · AI CLI          model mimo-v2.5 · DeepSeek · vision  │  ← BrandHeader
│  session 1 round · …      ctx 152/131072 · ↓1 ↑151 · ready     │     (3 rows)
├────────────────────────────────────────────────────────────────┤
│  ◇ Conversation   1 round  ↑ 0/…                ← banner     │
│  ✦ Round 1  ·  00:12  ·  ● Code                 ← ConversationPanel
│  ❯ mimo                                                (full width)
│  ◀ ````json
│    { ... }
│    ````
│  ↳ 511 chars · ↓1 ↑151 tok · deepseek-v4-flash
├────────────────────────────────────────────────────────────────┤
│  ▶ Input · 💡Ask  ○Plan  ●Code    paste image · Tab switch    │  ← InputBox or GeneratingPanel
│  ❯ What do you want to build?▌                                │
│  ── / commands  (autocomplete popup, if value starts with /)  │
├────────────────────────────────────────────────────────────────┤
│  ⏎ submit · Esc clear · Tab mode · /models switch · Ctrl+C    │  ← BottomBar
└────────────────────────────────────────────────────────────────┘
```

## Components (in render order)

All defined in `src/ui/code-tui.tsx`.

### `BrandHeader`
- Props: `phase`, `modelName`, `provider`, `version`, `session`
- The 3-row info block under the logo.
- 3 rows: identity · model info (`provider · /v2/chat · bearer · vision|text-only · stream ✓`) · session stats (`rounds · files · cmds · elapsed · ctx · in/out · status`).
- Replaces the old right-side panel. See [[01-architecture]] for why.

### `ConversationPanel`
- Props: `exchanges`, `maxHeight`, `scrollOffset`, `defaultRespMax`, `onScrollChange`
- Renders the round-by-round log.
- Has its own `useInput` for `PgUp` / `PgDn` / `g` / `G` (vim-style). See [[05-conversation-scrolling]].

### `ConversationView`
- Used inside `ConversationPanel`; does the actual line-slicing. See [[05-conversation-scrolling]].

### `ResponseBox`
- Props: `content`, `modeColor`, `maxLines`
- Renders the AI's response with `◀ ` at the first line (no border, no padding).
- Subsequent lines are indented to align with the arrow.

### `CommandResultBox`
- Renders auto-executed shell output (top/bottom single border, header with the command, ≤ 8 output lines).

### `InputBox`
- Props: `onSubmit`, `mode`, `onModeChange`, `visionSupported`, `isActive`
- The text + attachment input.
- `isActive` is `false` whenever `palette !== null || configOpen || phase === 'generating'` — this surrenders keystrokes to overlays so an `Enter` inside `ModelPicker` doesn't simultaneously fire `onSubmit` (the original bug).
- Supports: `Tab` (cycle mode), `1/2/3` (jump mode), `Esc` (clear), `Backspace`, `Ctrl+V` (paste image), `/` (open autocomplete popup), `Enter` (submit). See [[07-slash-system]].

### `GeneratingPanel`
- Visible while `phase === 'generating'`.
- Spinner + ticking status messages ("Analyzing request", …).
- Replaces `InputBox` so the user can't type mid-stream.

### `BottomBar`
- Static key-bindings reminder.
- `⏎ submit · Esc clear · Tab mode · /models switch · Ctrl+C quit` + mode + status indicator.

### `WelcomeHero`
- Shown inside `ConversationPanel` only when `exchanges.length === 0`.
- Short intro + 3-mode legend + a few tips. **No QUICK START, no "Try saying"** (explicitly removed).

## Overlays (mount below the conversation)

- `ModelPicker` — `palette === 'models'`. See [[09-models-picker]].
- `ConfigForm` — `configOpen === true`. See [[08-config-and-env]].

## Live viewport tracking

`CodeEngine` listens to `process.stdout` `resize` events and stores the current row count in `viewportRows` (default 30). The available height for the conversation is `viewportRows - RESERVED_ROWS` where `RESERVED_ROWS = 22` (logo ~6, header 3 rows + borders, input + mode bar, bottom bar, padding).

## Color tokens

All TUI files import the shared `c` map from `src/ui/colors.ts`. **Never** hardcode hex — always reach for a token:

| Token | Use |
|------|-----|
| `c.brand` (cyan) | primary accent, KOB logo, action keys |
| `c.pink` | CLI logo, model name, branding |
| `c.accent` (purple) | vision badge, secondary highlights |
| `c.green` | success, file-creations, "ready" |
| `c.yellow` | warnings, "thinking" status, elapsed |
| `c.red` | errors, deleted lines |
| `c.text` | body text |
| `c.textDim` | separators, dimmed labels |
| `c.textMuted` | secondary values (endpoint, auth) |
| `c.border` | panel outlines |
| `c.borderDim` | section separators under headers |

## Animations

- `useAnimation({ interval: 600 })` powers the breathing "ready ↔ thinking" indicator in the header.
- `useAnimation({ interval: 500 })` powers the `▌` cursor in `InputBox` (toggles on frame parity).
- `useAnimation({ interval: 80 })` powers the spinner in `GeneratingPanel`.

## Adding a new overlay

1. Create `src/ui/<name>.tsx`. It should manage its own `useInput` for navigation and call `onClose` on `Esc`.
2. Add a state in `CodeEngine` (e.g. `const [myOverlay, setMyOverlay] = useState(false);`).
3. In the return tree, after `<ConversationPanel>` and before `<InputBox>`, mount it conditionally:
   ```tsx
   {myOverlay && <MyOverlay onClose={() => setMyOverlay(false)} … />}
   ```
4. Make sure `InputBox` receives `isActive={!myOverlay && !palette && !configOpen && phase === 'input'}`.

See `[[model-picker]]` and `[[config-form]]` for worked examples.
