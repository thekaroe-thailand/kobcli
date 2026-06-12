---
title: "env-file"
type: stub
source: src/utils/env-file.ts
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - stub
  - source
  - env
  - dotenv
aliases:
  - env-file
  - env-file.ts
  - readEnvFile
  - writeEnvFile
  - getEnvPath
  - describeEnvPath
---

# env-file

> **Source file:** `src/utils/env-file.ts`

The only file in the project that reads from / writes to the KOB config file directly (not `process.env`). Used by the `/config` form.

- `getEnvPath()` — `~/.kob-cli/config.env` first, then legacy local `.env.local` / `.env`.
- `readEnvFile()` — preserves comments, returns `Record<string, string>`.
- `writeEnvFile(updates, comments?)` — replaces existing keys, appends new ones, and migrates from a legacy local env file when needed.
- `describeEnvPath()` — human-readable path for the UI.

## See also

- [[08-config-and-env]] — full write-up
- [[config]] — the read-side companion
