---
title: "09 — Models Picker"
type: reference
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - kob-cli
  - models
  - palette
  - search
---

# 09 — Models Picker

`/models` opens `ModelPicker` ([src/ui/model-picker.tsx](file:///c:/Users/controlc/MyDocuments/project_of_customer/kobai-website/kob-cli/src/ui/model-picker.tsx)) — a searchable overlay that lists every model in the KOB AI catalog and lets the user pick one to switch to.

## Data source

- Endpoint: `POST /api/models`
- Returns `{ providers: ProviderModels[] }` (see `[[types]]`).
- Each provider has `provider` (e.g. `DeepSeek`) and `models: AIModel[]` where `AIModel = { modelId, displayName, inputPricePer1M, outputPricePer1M, ... }`.
- The picker flattens everything into one `FlatModel[]` for unified searching.

## Lifecycle

```
mount → spinner "Fetching model catalog…"
       ↓
       POST /api/models  (with current API key from getConfig())
       ↓
       success → render the searchable list
       failure → render red error line
```

The request is `useEffect`-scoped; an `alive` flag prevents setting state after unmount.

## Search

The query is `value` (whatever the user typed into `InputBox`, after `/models` is filled/entered). Wait — actually the picker has **its own** input handling. It runs its own `useInput` and treats every printable keystroke as a search-character (`text` is appended to `query`). The user's main `InputBox` is `isActive: false` while the picker is open, so it doesn't interfere.

Filter is case-insensitive `startsWith` against `displayName`, `modelId`, **or** `provider`:

```ts
flat.filter(m =>
    m.displayName.toLowerCase().includes(q) ||
    m.modelId.toLowerCase().includes(q) ||
    m.provider.toLowerCase().includes(q)
);
```

We use `includes` (not `startsWith`) so the query is a true substring search, which is what users expect for "hundreds of models".

## Navigation

| Key | Effect |
|-----|--------|
| Printable character | append to `query` |
| `Backspace` / `Delete` | drop last char from `query` |
| `↑` | selection up |
| `↓` | selection down |
| `PgUp` | selection -12 |
| `PgDn` | selection +12 |
| `Enter` | pick the highlighted model (calls `onSelect`) |
| `Esc` | close (calls `onClose`) |

The list area is fixed at 12 visible rows; if the filtered set is larger, the picker shows `<start>–<end> of <total>` and centers the selection by re-anchoring the window on every move.

## Display

Each row:

```
▶  <displayName>  ●current  <provider>  $0.27/$1.10/M  <modelId>
```

- The `▶` marker is `c.brand` for the selected row, dim otherwise.
- `●current` (green) is appended when `modelId === currentModel`.
- Provider name is padded to 10 chars to align the price column.
- Prices are colored `c.yellow` (they draw the eye).

## On select

In `CodeEngine`:

```ts
onSelect={(modelId, displayName) => {
    setModel(modelId);
    configRef.current = { ...configRef.current, modelId };
    setPalette(null);
    setExchanges([]);
    messagesRef.current = [];
    exchangesLenRef.current = 0;
    showBanner(`◆ model → ${displayName} (${modelId})`);
}}
```

Three things happen:
1. The active `model` state is updated (header + model badge in the right panel change immediately).
2. The session is **cleared** — switching models mid-conversation would mix contexts that don't apply, so we wipe history.
3. A banner shows the new model name for ~2 seconds.

`configRef.current.modelId` is also updated so the *next* `handleSubmit` uses the right model.

## Failure modes

- **Network error** → red error line: `✗ <message>`. User can press `Esc` to leave the picker and try again later.
- **Empty result** → `No models match "<query>".` in `c.yellow`. The query can be edited to widen the search.
- **No providers in response** → treated like an empty catalog; the `Enter` key does nothing.

## Adding filters

The picker is currently a single text field. If you want to add a separate provider filter:

1. Add a `providerFilter` state in `ModelPicker`.
2. Bind a hotkey (e.g. `p` to cycle providers) in `useInput`.
3. Apply it in the `filtered` `useMemo`.

The data shape and `onSelect` contract should stay the same.
