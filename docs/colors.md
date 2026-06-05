---
title: "colors"
type: stub
source: src/ui/colors.ts
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - stub
  - source
  - tui
  - design
aliases:
  - colors
  - colors.ts
---

# colors

> **Source file:** `src/ui/colors.ts`

The shared color token map. Every TUI file imports the `c` object from here — never hardcode hex.

| Token | Use |
|------|-----|
| `c.brand` (cyan) | primary accent, KOB logo |
| `c.pink` | CLI logo, model name, branding |
| `c.accent` (purple) | vision badge |
| `c.green` | success, "ready" |
| `c.yellow` | warnings, "thinking" |
| `c.red` | errors, deletions |
| `c.text` / `c.textDim` / `c.textMuted` | text hierarchy |
| `c.border` / `c.borderDim` / `c.borderAccent` | panel outlines |

## See also

- [[04-tui-layout]] — the design system in context
- [[11-conventions]] — "always reach for a token, never raw hex"
