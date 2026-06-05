---
title: "05 — Conversation Scrolling"
type: reference
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - kob-cli
  - tui
  - scrolling
  - ink
---

# 05 — Conversation Scrolling

Ink 7 has **no native scrollable box**. `overflow: 'hidden'` exists, but it doesn't clip reliably across terminals. We solve this by **line-based slicing**.

## High-level idea

1. Compute a rough height (in terminal rows) for every round.
2. Sum them to get `totalHeight`.
3. If `totalHeight ≤ maxHeight` (the available rows for the conversation), show everything.
4. Otherwise, expose a `scrollOffset` (lines hidden from the top) and a `maxScroll = totalHeight - maxHeight`. The default is `0` (auto-scroll to bottom).
5. When the user submits, reset `scrollOffset = 0` → "follow tail".
6. When the user presses `PgUp` / `PgDn` / `g` / `G`, adjust `scrollOffset`.

## Available height

`CodeEngine` listens to `process.stdout` `resize` events and stores the current `viewportRows`. The conversation is given `convMaxHeight = max(8, viewportRows - RESERVED_ROWS)` where `RESERVED_ROWS = 22` (logo + header + input + bottom + padding).

## Round height estimator

```ts
function estimateRoundHeight(exc: Exchange, respMax: number): number {
    // round header     1
    // input line       1
    // response margin  1
    // response lines   min(respMax, totalLines)
    // trunc marker     1 if response was truncated
    // no-response      1 if output is empty
    // files            1 + N (if any files)
    // commands         per-command: 1 margin + 2 border + 1 header + min(8, outLines)
    // meta margin      1
    // meta line        1
    // separator        2
}
```

The estimator is approximate (Ink may wrap/pad slightly differently) but it stays close enough that the conversation panel never overflows visibly.

## Visible-window function

```ts
getVisibleWindow(exchanges, maxHeight, scrollOffset, defaultRespMax)
```

Returns:
```ts
{
    visible: Array<{ exc, respMax, isFirst, isLast }>,
    hiddenAbove: number,    // lines clipped above the visible window
    hiddenBelow: number,    // lines clipped below the visible window
}
```

Algorithm:
1. `totalH = sum(estimateRoundHeight(e, defaultRespMax))`
2. If `totalH ≤ maxHeight` → return everything, both hidden counts = 0.
3. `effOffset = clamp(scrollOffset, 0, totalH - maxHeight)`
4. `startLine = totalH - maxHeight - effOffset`
5. `endLine   = startLine + maxHeight`
6. Walk rounds from top to bottom:
   - if a round is fully above `startLine` → skip it
   - if fully below `endLine` → stop iterating
   - otherwise: figure out how much of its response fits and emit `{ exc, respMax: slicedRespMax }` for the first partially-visible round; full rounds pass through with their default `respMax`.

The header of the conversation panel also shows `↑ hiddenAbove / (hiddenAbove + hiddenBelow + maxHeight)` whenever there is overflow, so the user always knows where they are in the scroll.

## Auto-scroll to bottom

In `CodeEngine`:
```ts
useEffect(() => {
    if (exchanges.length !== exchangesLenRef.current) {
        exchangesLenRef.current = exchanges.length;
        setScrollOffset(0);
    }
}, [exchanges.length]);
```

So submitting a new round always returns the user to the latest response.

## Keys (in `ConversationPanel`)

| Key | Effect |
|-----|--------|
| `PgUp` | `scrollOffset += 3` |
| `PgDn` | `scrollOffset -= 3` (clamped at 0) |
| `g` | jump to top (`scrollOffset = totalScrollable`) |
| `G` (shift) | jump to bottom (`scrollOffset = 0`) |

These are bound in `ConversationPanel`'s own `useInput` and survive even while the user is typing in `InputBox` because they only fire on those specific keys.

## Why not use `Box overflow="hidden"` + `height`?

- Ink's `overflow="hidden"` does not clip the underlying terminal buffer on every terminal emulator — content can still leak upward.
- It also doesn't expose a scroll offset to us, so the user would have no way to scroll back up to read older rounds.
- The line-based slicer gives us full control: indicators above/below, auto-follow tail, manual navigation, and reliable visual layout.

## Adding a per-round feature (e.g. tool calls)

If you add a new block to a round (say, a "tool call" section), update `estimateRoundHeight` to count its lines. If a partial block could be sliced, extend the partial-slice math in `getVisibleWindow` to subtract its lines from the response budget — otherwise the first visible round may overflow by exactly the number of lines you forgot to count.
