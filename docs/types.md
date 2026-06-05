---
title: "types"
type: stub
source: src/types/index.ts
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - stub
  - source
  - types
aliases:
  - types
  - types.ts
  - CliConfig
  - ModelsResponse
  - ProviderModels
  - AIModel
  - ChatResponse
---

# types

> **Source file:** `src/types/index.ts`

Single barrel of every TypeScript interface:

- `CliConfig` — `KOB_*` env values, parsed.
- `ModelsResponse`, `ProviderModels`, `AIModel` — `/api/models` payload.
- `ChatResponse` — non-streaming chat reply.
- `Project`, `Rule`, `CreditHistory` — admin resources (one-shot CLI).
- `Exchange` (UI shape) lives in [[code-tui]] because it's UI-only.

## See also

- [[01-architecture]] — where each type is consumed
- [[08-config-and-env]] — extending `CliConfig`
