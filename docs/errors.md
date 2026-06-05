---
title: "errors"
type: stub
source: src/utils/errors.ts
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - stub
  - source
  - errors
aliases:
  - errors
  - errors.ts
  - ApiError
  - handleApiError
  - validateRequired
---

# errors

> **Source file:** `src/utils/errors.ts`

- `ApiError` — custom error class for HTTP failures.
- `handleApiError(e)` — translates statuses (401, 404, 429, 5xx) into user-friendly terminal output and `process.exit(1)`.
- `validateRequired(value, name)` — tiny helper used by the one-shot CLI commands.

## See also

- [[03-cli-commands]] — the canonical `try / catch (e) { handleApiError(e); process.exit(1); }` pattern.
