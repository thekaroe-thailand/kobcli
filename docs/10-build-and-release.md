---
title: "10 — Build & Release"
type: reference
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - kob-cli
  - build
  - release
  - npm
---

# 10 — Build & Release

## Scripts (from `package.json`)

| Script | Command | What it does |
|--------|---------|--------------|
| `dev` | `bun run src/index.ts` | Run the TUI in dev mode |
| `start` | same as `dev` | Alias |
| `build` | `bun build src/index.ts --compile --outfile kob-cli` | Produce a native executable |
| `prepublishOnly` | `bun run build` | Auto-runs before `npm publish` |
| `publish` | `bun run src/scripts/release.ts` | Bump version + build + publish |
| `release:patch` | `npm version patch --no-git-tag-version && npm publish` | One-shot patch release |
| `release:minor` | `npm version minor --no-git-tag-version && npm publish` | One-shot minor release |
| `release:major` | `npm version major --no-git-tag-version && npm publish` | One-shot major release |

## Type-check

```bash
bunx tsc --noEmit
```

Must pass with `exit 0` before committing. There is no test framework set up yet.

## `bun build --compile`

- `bun build src/index.ts --compile --outfile kob-cli`
- Produces a **standalone native binary** (e.g. `kob-cli.exe` on Windows).
- Bundles every dependency (Ink, React, commander, etc.) into the binary.
- Output: ~70 MB (most of it is the V8 runtime + Ink + React + TypeScript runtime).
- Cross-compile: set `BUN_TARGET=linux-x64` (etc.) before running. Bun's compile target list is in their docs.

## Release flow (`npm run publish`)

`src/scripts/release.ts` (run by `bun`):

1. Read `package.json`.
2. Parse `version` (e.g. `1.0.5`), bump the patch digit.
3. Write the new `version` back to `package.json` (formatted with 2-space indent + trailing newline).
4. Print `📦 kob-cli@<newversion>` to the terminal.
5. Run `bun run build` (rebuilds the binary — kept for parity with the local artifact).
6. Run `npm publish --ignore-scripts` (so the `prepublishOnly` doesn't run *another* build and double the time).

The result is a new version on the [public npm registry](https://www.npmjs.com/package/kob-cli) and a tarball of 29 files (~45 kB unpacked) containing `bin/`, `src/`, docs, and the `.env.example` template.

> Note: the `kob-cli.exe` binary itself is **not** in the npm tarball (only the `bin/cli.cjs` CJS shim is). The tarball is meant to be installed on a machine with Bun and uses the shim to spawn `bun`.

## Manual release (if the script misbehaves)

```bash
bun run build
# Update version in package.json by hand
npm version patch --no-git-tag-version
npm publish --ignore-scripts
```

## Versioning policy

- **patch** — bug fixes, doc edits, internal refactors that don't change behavior.
- **minor** — new slash command, new overlay, new mode, new image backend, anything the user can see.
- **major** — breaking changes to the TUI keybindings, `.env` schema, or the `kob` binary name.

## Pre-release smoke test (recommended)

Before publishing, run through:

1. `bunx tsc --noEmit` (clean).
2. `bun run src/index.ts` → type `/help`, confirm every command appears.
3. `/models` → pick a model → confirm banner + new header.
4. `/config` → walk through the wizard → save → confirm file written.
5. Submit a short prompt → confirm streaming + response.
6. Submit a prompt with `bash` code block → confirm auto-execution.
7. `Ctrl+V` with an image in the clipboard → confirm chip.
8. Resize the terminal → confirm scroll recomputes.

If all eight pass, ship it.

## Post-release

- Tag the commit: `git tag v1.0.6` and `git push --tags`.
- Smoke-test the published package on a clean machine:
  ```bash
  npm i -g kob-cli
  kob
  ```
