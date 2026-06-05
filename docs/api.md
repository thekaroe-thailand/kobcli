---
title: "api"
type: stub
source: src/utils/api.ts
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - stub
  - source
  - api
  - streaming
aliases:
  - api
  - api.ts
  - KobApiClient
  - chatStream
  - ChatCompletionChunk
  - ChatCompletionResult
---

# api

> **Source file:** `src/utils/api.ts`

HTTP client for the KOB AI API.

- `KobApiClient` — class with `get`, `post`, and the streaming `chatStream`.
- `chatStream(model, messages, options)` — `AsyncGenerator<ChatCompletionChunk>` that yields OpenAI-compatible SSE chunks.
- Currently sends `messages: { role, content: string }[]` (text-only). Multimodal support is pending — see [[12-known-limitations]].

Detailed walkthrough: [[01-architecture]].

## See also

- [[06-images-vision]] — how images are (not yet) sent
- [[03-cli-commands]] — what calls this in the one-shot CLI mode
- [[12-known-limitations]] — the multimodal roadmap
