---
title: "model-picker"
type: stub
source: src/ui/model-picker.tsx
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - stub
  - source
  - tui
  - models
aliases:
  - model-picker
  - model-picker.tsx
  - ModelPicker
---

# model-picker

> **Source file:** `src/ui/model-picker.tsx`

The `/models` overlay. Fetches `POST /api/models`, flattens the providers into a single list, and exposes a real-time substring search over `displayName | modelId | provider`. The current model is marked `●current`.

Keys: `↑↓ PgUp PgDn` to move · type to filter · `Enter` to pick · `Esc` to close.

## See also

- [[09-models-picker]] — full walkthrough
- [[07-slash-system]] — how `/models` reaches this component
- [[api]] — the request shape
