---
title: "config"
type: stub
source: src/utils/config.ts
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - stub
  - source
  - config
aliases:
  - config
  - config.ts
  - getConfig
  - CliConfig
---

# config

> **Source file:** `src/utils/config.ts`

Reads `KOB_API_BASE_URL`, `KOB_API_KEY`, `KOB_MODEL_ID` from the shared KOB config file and mirrors them into `process.env`.

```ts
getConfig(): CliConfig
// { baseUrl, apiKey, apiToken?, bearerToken?, modelId }
```

Defaults:
- `baseUrl` → `https://www.kob-ai.dev`
- `modelId` → first model in the catalog

## See also

- [[08-config-and-env]] — how `/config` rewrites the shared config file
- [[env-file]] — the in-process writer
- [[api]] — the consumer of `CliConfig`
