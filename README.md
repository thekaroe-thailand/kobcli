<div align="center">

# KOB CLI

**A beautiful, fully agentic AI coding assistant for your terminal.**

[🇹🇭 Made in Thailand](https://www.kob-ai.dev) · v2.0.38 · MIT

<br>

> Read your project, write your code, run your tests, fix your bugs —
> all without leaving the terminal. No editor plugin. No background daemon.
> Just `kob`.

<br>

[![npm](https://img.shields.io/badge/bun-runtime-f9f1e1?logo=bun&logoColor=black)](https://bun.sh)
[![node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![typescript](https://img.shields.io/badge/typescript-5.7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![license](https://img.shields.io/badge/license-MIT-22d3ee)](LICENSE)
[![kob](https://img.shields.io/badge/KOB%20AI-www.kob--ai.dev-a78bfa)](https://www.kob-ai.dev)

</div>

---

## ✨ Why KOB CLI

Most AI chat tools are passive: you paste code, you get text back. **KOB CLI is active** — it understands your project, decides which tools to call, and shows you exactly what it changed, with diffs and undo support.

It is designed to feel like a disciplined pair programmer inside your terminal:

- 🔍 **Reads first** — the engine injects your file tree into context, so the model knows what you have before suggesting changes.
- 🛠 **Acts, not just answers** — `read_file`, `str_replace`, `write_file`, and shell commands are first-class tool calls, not hidden magic.
- 🎨 **Colored diffs, visible progress** — every read, replacement, file write, and command run is reported inline as it happens.
- ⚡ **Interactive slash commands** — real-time autocomplete for commands like `/models`, `/undo`, and `/config` directly in the prompt.
- ↩️ **`/undo` is real undo** — every file mutation in the last turn can be reverted, no Git ceremony required.
- 🛡 **Safe by default** — destructive shell commands are flagged in red and require explicit `Y` confirmation.
- 💾 **Remembers your project** — per-project session history means reopening `kob` in the same repo picks up where you left off.
- 🌍 **Bilingual** — status banners, help text, and prompts in English and ไทย.

---

## 🚀 Quick start

```bash
# 1. Install globally from npm
npm i -g kob-cli

# 2. Configure — the program creates a global config file for you
kob config
#   API key : kob_xxx:token         (paste from https://www.kob-ai.dev)
#   Model   : deepseek/deepseek-v4-flash   (or pick from /models)
#   Base URL: https://www.kob-ai.dev       (default, just press Enter)

# 3. Launch the REPL
kob
```

That's it. No git clone, no `bun install`, no manual config file editing.

Inside the REPL, type a plain request — the agent does the rest.

```text
❯ add a healthcheck endpoint to src/server.ts and write a test
```

Press `Tab` to switch between **Ask**, **Plan**, and **Code** modes. Press `R` to retry if the network blips. Type `?` to see all key bindings.

---

## 📦 Installation

### Recommended: from npm

```bash
npm i -g kob-cli
kob --version            # smoke test → e.g. 2.0.3
```

Works on macOS, Linux, and Windows. The `kob` binary is added to your PATH automatically.

### From source (for contributors)

```bash
git clone https://github.com/thekaroe-thailand/kobcli.git
cd kobcli
bun install
bun run dev               # live REPL against the source
```

> If you want the local checkout to be the global `kob`:
>
> ```bash
> bun link                  # exposes this checkout as `kob` on your PATH
> kob --version             # should match package.json
> ```
>
> `bun link` creates a symlink in your global bin pointing at this checkout, so any edit here is immediately reflected when you run `kob`.

**Sanity check** (the same checks the CI runs):

```bash
bun run typecheck          # tsc --noEmit, no compile
bun run src/index.ts --version    # should print the version from package.json
bun run src/index.ts ask "hi"     # should hit the API and return text
```

If any of those three error out, the checkout is broken — open an issue.

### Update

You can easily upgrade KOB CLI to the latest version directly using:

```bash
kob upgrade
```

The built-in upgrader shows a live progress bar and suppresses routine npm warning noise such as funding notices and cleanup warnings. If npm returns a real error, KOB still prints it.

Or manually via npm:

```bash
npm update -g kob-cli
```

### Uninstall

```bash
npm uninstall -g kob-cli
rm -rf ~/.kob-cli            # wipes persisted sessions
```

---

## ⚙️ Configuration

You do **not** need to edit config by hand. Run `kob config` (or `/config` from inside the REPL) and the program creates a single global file for you at `~/.kob-cli/config.env`, pre-filled with the values you entered.

```bash
kob config

  ┌  KOB CLI configuration
  │
  ◇  API key (kob_xxx:token) — leave blank to keep current
  │  kob_xxxxxxxxxxxxxxxxxxxxxxxx
  │
  ◇  Default model id
  │  deepseek/deepseek-v4-flash
  │
  ◇  API base URL
  │  https://www.kob-ai.dev
  │
  └  ✓ Configuration saved
```

The form writes one global config file shared across projects. It looks like this:

```env
KOB_API_BASE_URL=https://www.kob-ai.dev
KOB_API_KEY=kob_your_api_key_here
KOB_MODEL_ID=deepseek/deepseek-v4-flash
KOB_MAX_TOKENS=16384
KOB_AUTO_APPROVE_READONLY=true
```

### Config keys

| Key                          | Required | Default                              | Description                                  |
| ---------------------------- | -------- | ------------------------------------ | -------------------------------------------- |
| `KOB_API_KEY`                | ✅       | —                                    | Format: `kob_xxx` or `kob_xxx:token`         |
| `KOB_API_BASE_URL`           | ❌       | `https://www.kob-ai.dev`             | OpenAI-compatible endpoint                   |
| `KOB_MODEL_ID`               | ❌       | `deepseek/deepseek-v4-flash`         | `provider/model` form                        |
| `KOB_MAX_TOKENS`             | ❌       | `16384`                              | Output cap per response                      |
| `KOB_AUTO_APPROVE_READONLY`  | ❌       | `true`                               | Skip confirm on read-only shell commands     |

### Switching config later

The same form is available at any time — inside the REPL just type `/config`:

```text
❯ /config
```

Edit one field, press Enter, the file is rewritten and the REPL reloads. Your session and history are preserved.

---

## 🧑‍💻 Usage

### CLI commands

```bash
kob                       # launch interactive REPL (default)
kob chat                  # same as above, explicit
kob ask "…"               # one-shot question, no REPL
kob ask "…" -m gpt-4o     # override model for one request
kob models                # list available models from backend
kob config                # edit global KOB settings
kob --version             # show version
kob --help                # full CLI help
```

### Modes

Press `Tab` to cycle, or `1`/`2`/`3` to jump:

| Key   | Mode   | Color    | Purpose                                                                 |
| ----- | ------ | -------- | ----------------------------------------------------------------------- |
| `1`   | Ask    | 🩵 blue  | Read-only Q&A about your code                                          |
| `2`   | Plan   | 🩷 pink  | Design a solution, no file changes                                      |
| `3`   | Code   | 🟢 green | Build / edit autonomously — the only mode that mutates your project    |

The mode colours the system prompt, the rail around the conversation, and the prompt icon. **Code** is the default.

### Slash commands

Type `/` to open the autocomplete menu, or type the command directly:

| Command         | What it does                                                          |
| --------------- | --------------------------------------------------------------------- |
| `/ask`          | Switch to Ask mode                                                    |
| `/plan`         | Switch to Plan mode                                                   |
| `/code`         | Switch to Code mode                                                   |
| `/models`       | Pick a model from the live backend catalog                            |
| `/config`       | Edit global KOB settings                                              |
| `/git`          | Branch + dirty file count + first 30 lines of `git status`            |
| `/diff`         | Show the file changes from the last turn                              |
| `/undo`         | Revert every file mutation from the last turn                         |
| `/init`         | Scaffold an `AGENTS.md` (file tree + commands)                        |
| `/tokens`       | Show session input/output token totals                                |
| `/find <text>`  | Search text across the project, scoped to the current directory        |
| `/replace <a> <b>` | Replace `<a>` with `<b>` in one or all files                       |
| `/open`         | Open a file and read it with line numbers                             |
| `/project:create` | Create a new project bookmark (prompts for name and path)             |
| `/project:list`   | List saved projects and switch to one (changes cwd)                   |
| `/project:delete` | Remove a project bookmark from the list                               |
| `/clear`        | Clear the in-memory session                                           |
| `/reset`        | Clear + reload model from config                                      |
| `/help`         | Show all slash commands                                               |
| `/exit`         | Quit (`/quit` works too)                                              |

### Direct shell commands

Any input starting with `$` or `>` is run as a shell command in your project root:

```text
❯ $ npm test
✓ $ npm test
    > my-project@1.0.0 test
    > jest
    PASS  src/sum.test.ts
  exit 0 · 4.1s
```

Read-only commands (`ls`, `cat`, `git status`, …) run with auto-approval when `KOB_AUTO_APPROVE_READONLY=true`. Mutating ones ask once. Dangerous ones (`rm -rf`, `git reset --hard`, `curl … | sh`, …) are flagged in red and always require explicit `Y`.

### Special keys

| Key      | Action                                                    |
| -------- | --------------------------------------------------------- |
| `Tab`    | Cycle mode (Ask → Plan → Code)                            |
| `1`/`2`/`3` | Jump to mode                                          |
| `↑` / `↓` | Walk through your last 100 prompts                       |
| `Esc`    | Abort the current generation (during streaming)           |
| `Ctrl+C` | Quit                                                      |
| `Ctrl+V` | Paste an image (vision-capable models only)               |
| `y`      | Copy the last assistant response to your clipboard        |
| `R`      | When shown "Press R to retry" — re-send the last request  |

---

## 🧠 How the agent works

The runtime is a small, explicit pipeline — no hidden orchestration, no opaque plugin system.

```
┌──────────────────────────────────────────────────────────────┐
│  USER INPUT                                                 │
│  "add a healthcheck endpoint to src/server.ts"             │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  ENGINE  (src/core/engine.ts)                               │
│  • load session history (scoped to cwd)                     │
│  • inject file tree into the system prompt                  │
│  • send to KOB AI /api/v2/chat/completions (streaming)      │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  PARSER  (src/tools/parser.ts)                              │
│  • extract ```ts:path fenced blocks → write_file            │
│  • extract ```bash fenced blocks   → run_shell              │
│  • extract tool_call JSON          → str_replace / read_file│
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  EXECUTOR                                                   │
│  • sandbox path: must be inside project root                │
│  • show inline: read · str_replace · write · command output │
│  • destructive commands → red confirmation banner           │
│  • every mutation pushed to the undo stack                  │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  RENDER  (src/ui/render.ts)                                 │
│  • colored diffs of changed files                           │
│  • command output (first 8 lines + exit code + duration)    │
│  • markdown assistant reply with syntax tint                │
│  • "✓ Done" round close                                     │
└──────────────────────────────────────────────────────────────┘
```

A single user request can produce **multiple rounds**: the model reads a file, decides to edit, applies a `str_replace`, runs a test, sees the failure, and fixes it — all inside one turn.

### Network resilience

- Up to **5 automatic retries** on transient failures (DNS, TCP, TLS, fetch aborted) with exponential backoff + jitter (0.5s → 1s → 2s → 4s, capped at 5s).
- HTTP 4xx/5xx are **not retried** — they bubble up immediately with the server's message.
- User aborts (`Esc`) are **not retried** — they propagate instantly.
- On final failure the REPL prints `Press R to retry, any other key to continue.` — one keypress, no retyping.

---

## 🗂 Project layout

```
src/
├── index.ts              CLI entry + non-interactive subcommands
├── repl.ts               interactive REPL loop, command routing, Esc interrupt
├── core/
│   ├── api.ts            streaming OpenAI-compatible client + retry logic
│   ├── engine.ts         agentic multi-round loop
│   ├── modes.ts          chat / ask / plan / code prompts
│   ├── config.ts         env loading + validation
│   ├── env-file.ts       read/write ~/.kob-cli/config.env (comment-preserving)
│   ├── history.ts        per-project session persistence
│   └── types.ts
├── tools/
│   ├── parser.ts         extract file blocks, tool calls, shell commands
│   ├── files.ts          sandboxed read/write/str_replace + file tree
│   ├── shell.ts          run commands, read-only & danger classifiers
│   ├── git.ts            branch / dirty / ahead-behind
│   ├── diff.ts           LCS line diff + compact hunks
│   └── clipboard.ts
├── ui/
│   ├── banner.ts         the KOB header
│   ├── gradient.ts       dependency-free hex gradient
│   ├── markdown.ts       Markdown → ANSI with syntax tint
│   ├── render.ts         status bar, diffs, help, results
│   ├── spinner.ts        interleaving single-line spinner
│   ├── prompts.ts        model picker, config form, approvals
│   └── theme.ts          palette + helpers
└── scripts/
    └── release.ts        bump + build + publish + push + tag
```

---

## 🛠 Development

```bash
bun run dev          # bun run src/index.ts — live REPL
bun run typecheck    # tsc --noEmit, no compile
bun run build        # compile to a single native binary
bun run build:only   # bun build src/index.ts --compile --outfile kob-cli
```

### Releasing a new version

The release script (`src/scripts/release.ts`) bumps `package.json`, runs the typecheck, rebuilds the binary, and commits in one step:

```bash
bun run release:patch    # 2.0.0 → 2.0.1
bun run release:minor    # 2.0.0 → 2.1.0
bun run release:major    # 2.0.0 → 3.0.0
```

### Style

- TypeScript, strict, ESM modules
- async/await everywhere — no `.then` chains
- single responsibility per file under `src/tools/`, `src/ui/`
- prefer editing existing files; only create new ones when there is no good host
- run `bun run typecheck` before opening a PR

---

## 🔌 Backend contract

KOB CLI speaks the OpenAI streaming protocol to `KOB_API_BASE_URL`. Minimum the backend must support:

| Endpoint                     | Method | Purpose                       |
| ---------------------------- | ------ | ----------------------------- |
| `/api/v2/chat/completions`   | POST   | streaming chat (SSE)          |
| `/api/ai/models`             | POST   | model catalog (primary)       |
| `/api/models`                | POST   | model catalog (fallback)      |
| `/api/v2/models`             | GET    | model catalog (fallback)      |

Authentication is a Bearer token. The `KobApiClient` (see [src/core/api.ts](src/core/api.ts)) tries the catalog endpoints in order, so older backends stay compatible.

---

## 🗺 Roadmap

In priority order, not promised:

- [ ] Conversation export to Markdown / JSON
- [ ] Multi-profile `.env` switching
- [ ] Plugin hooks (pre/post tool execution)
- [ ] Background "watch this file" agents
- [ ] In-terminal Markdown preview pane
- [ ] Built-in token cost estimator

Out of scope, intentionally: editor plugin, GUI client, global cross-project memory store.

---

## 🐛 Troubleshooting

**`Connection failed. Please check your network and try again.`**
The backend was unreachable for 5 retries. Check `KOB_API_BASE_URL`, your network, or just press `R` to retry.

**`This model does not support the requested operation.`**
You tried to paste an image into a text-only model, or called a vision tool on a model that has no `vl` in its id. Run `/models` to switch.

**`No API key configured. Exiting.`**
Run `kob config` and paste your `kob_xxx:token` key.

**`✗ Permission denied` on shell commands**
Mutating shell commands require an explicit `Y` at the prompt. Destructive ones are flagged in red — type `Y` only if you mean it.

---

## 🤝 Contributing

Issues and PRs are welcome. Please read the design log under [docs/](docs/README.md) first — most architectural questions are answered there. The codebase is small enough that you can read it in an afternoon.

---

## 📄 License

[MIT](LICENSE) · © Kob AI · [www.kob-ai.dev](https://www.kob-ai.dev)

---

<div align="center">

**ถ้าชอบ ฝากกด ⭐ ที่ GitHub ให้ด้วยนะครับ 🇹🇭**

If you like it, drop a ⭐ on GitHub.

</div>
