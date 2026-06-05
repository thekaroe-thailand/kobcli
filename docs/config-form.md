---
title: "config-form"
type: stub
source: src/ui/config-form.tsx
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - stub
  - source
  - tui
  - config
aliases:
  - config-form
  - config-form.tsx
  - ConfigForm
---

# config-form

> **Source file:** `src/ui/config-form.tsx`

The `/config` overlay — a step-by-step wizard over `Base URL`, `API Key`, `Default Model`. Writes through [[env-file]] so existing keys and comments are preserved.

Keys: `Enter` to commit + advance, `Esc` to cancel, `Backspace` to delete, `Tab` to jump fields. After saving, any key closes the panel.

## See also

- [[08-config-and-env]] — full walkthrough
- [[env-file]] — the writer
- [[config]] — the reader
- [[07-slash-system]] — how `/config` reaches this component
