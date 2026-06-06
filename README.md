# 🤖 KOB AI CLI

Command-line interface for interacting with KOB AI API. Built with Bun and TypeScript.

Developed by **Kob AI** — [www.kob-ai.dev](https://www.kob-ai.dev) | Developer in Thailand 🇹🇭

## ✨ Features

- 🖥️ **TUI Mode** - Full-screen interactive coding agent (default when running `kob` with no args)
- 🔐 **Authentication** - Verify credentials and check balance
- 💬 **AI Chat** - Send messages and get AI responses
- 🌊 **Streaming** - Real-time streaming AI responses
- 💡 **Ask** - Quick one-shot question answering
- 💻 **Code** - AI code generation with auto file creation
- 🤖 **Models** - Browse available AI models and pricing
- 🧠 **Skills** - List all available CLI skills
- 🎨 **Rich Output** - Beautiful terminal output with colors and formatting

## 🚀 Quick Start

### Prerequisites

- **Bun** runtime installed ([Install Bun](https://bun.sh/docs/installation))
- KOB AI API credentials (API Key)

### Installation via npm (recommended)

```bash
npm install -g kob-cli
```

### Installation from source

1. Clone or navigate to the kob-cli directory:
```bash
cd kob-cli
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your credentials
# KOB_API_BASE_URL=https://www.kob-ai.dev
# KOB_API_KEY=kob_your_api_key
```

Or export them directly:
```bash
export KOB_API_KEY=kob_your_api_key
```

### Usage

Run the CLI directly with Bun:
```bash
bun run src/index.ts <command>
```

Or use the npm script:
```bash
bun dev <command>
```

## 📖 Commands

### TUI Mode (Default)

Run `kob` with no arguments to launch the full-screen interactive TUI:
```bash
kob
```

The TUI has 3 modes switchable with Tab or `1`/`2`/`3`:
- **Ask** (`/ask`) — Quick Q&A
- **Plan** (`/plan`) — Get an implementation plan before coding
- **Code** (`/code`) — Generate code + auto-run shell commands

Slash commands inside TUI: `/models`, `/config`, `/clear`, `/help`, `/exit`

### Authentication

**Verify credentials:**
```bash
bun dev auth:verify
```
Shows user information, package details, and credit balance.

**Check balance:**
```bash
bun dev balance
```
Quick check of your current credit balance.

### Ask

**Ask a one-shot question:**
```bash
bun dev ask "What is a closure in JavaScript?"
bun dev ask "อธิบาย recursion หน่อย" --provider DeepSeek --model deepseek-chat
```

### AI Chat

**Send a message:**
```bash
bun dev chat "Explain quantum computing" \
  --provider DeepSeek \
  --model deepseek-chat \
  --temperature 0.7
```

**Interactive chat mode:**
```bash
bun dev chat:interactive \
  --provider OpenRouter \
  --model openai/gpt-4o
```

Interactive commands: `/clear`, `/stats`, `/help`, `/exit`

### Code Generation

**Generate code:**
```bash
bun dev code "Write a REST API in Python" --lang python
```

If no prompt is given, launches the TUI in Code mode:
```bash
bun dev code
```

### Streaming

**Stream AI response:**
```bash
bun dev stream "Write a poem about coding" \
  --provider OpenRouter \
  --model google/gemini-flash-1.5
```

Real-time token-by-token display as AI generates response.

### Models

**List all models:**
```bash
bun dev models
```

**Filter by provider:**
```bash
bun dev models --provider DeepSeek
```

**JSON output:**
```bash
bun dev models --format json
```

### Skills

**List all available CLI skills:**
```bash
bun dev skills
```

## 🔧 Options

### Chat, Ask, Stream & Code Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --provider` | AI provider (DeepSeek, OpenRouter, DeepInfra) | DeepSeek |
| `-m, --model` | Model ID | deepseek-chat |
| `-t, --temperature` | Temperature (0.0-2.0) | 0.7 |
| `--max-tokens` | Maximum tokens | 4096 |
| `--system-prompt` | System prompt | - |
| `--lang` | Programming language hint (code command only) | - |

### Common Providers and Models

**DeepSeek:**
- `deepseek-chat` (DeepSeek V3)
- `deepseek-reasoner` (DeepSeek R1)
- `deepseek-v4-pro`
- `deepseek-v4-flash`

**OpenRouter:**
- `openai/gpt-4o`
- `openai/gpt-4o-mini`
- `anthropic/claude-3.5-sonnet`
- `google/gemini-1.5-pro`

**DeepInfra:**
- `meta-llama/Meta-Llama-3.1-8B-Instruct`
- `meta-llama/Meta-Llama-3.1-70B-Instruct`
- `Qwen/Qwen2.5-72B-Instruct`

## 💡 Examples

### Complete Workflow

```bash
# 1. Verify connection
bun dev auth:verify

# 2. Check available models
bun dev models --provider DeepSeek

# 3. Ask a quick question
bun dev ask "อธิบาย async/await ใน JavaScript"

# 4. Generate code
bun dev code "Write a Express.js REST API with CRUD endpoints" --lang javascript

# 5. Chat interactively
bun dev chat:interactive --provider DeepSeek --model deepseek-chat

# 6. Stream response for longer content
bun dev stream "Write a detailed guide about AI" \
  --model openai/gpt-4o

# 7. Check credit balance
bun dev balance

# 8. Or just launch TUI for everything
kob
```

## 🛠 Development

### Project Structure

```
kob-cli/
├── src/
│   ├── index.ts              # CLI entry point (also launches TUI if no args)
│   ├── commands/             # One-shot CLI commands
│   │   ├── auth.ts          # auth:verify, balance
│   │   ├── chat.ts          # chat, chat:interactive
│   │   ├── stream.ts        # stream
│   │   ├── models.ts        # models
│   │   ├── ask.ts           # ask
│   │   ├── code.ts          # code
│   │   └── skills.ts        # skills
│   ├── ui/                  # TUI (full-screen mode)
│   │   ├── code-tui.tsx     # Main TUI component (CodeEngine)
│   │   ├── colors.ts        # Shared color tokens
│   │   ├── model-picker.tsx # Model selection overlay
│   │   └── config-form.tsx  # .env editor overlay
│   ├── utils/               # Utility modules
│   │   ├── api.ts           # API client (KobApiClient)
│   │   ├── config.ts        # Configuration (getConfig)
│   │   ├── env-file.ts      # .env read/write
│   │   ├── format.ts        # Output formatting
│   │   └── errors.ts        # Error handling
│   └── types/               # TypeScript types
│       └── index.ts
├── bin/
│   └── cli.cjs              # CJS shim entry point
├── .env.example             # Environment variables template
├── package.json
└── README.md
```

### Adding New Commands

1. Create command file in `src/commands/`
2. Export the command
3. Import and add to `src/index.ts`

### Build for Distribution

```bash
bun run build
```

This creates a compiled binary `kob-cli.exe`.

## ❓ Troubleshooting

**Error: KOB_API_KEY environment variable is required**
- Make sure you've set your environment variables
- Check that they're exported correctly or in .env file

**Authentication failed**
- Verify your API key is correct
- Check that your key is active on the Kob AI dashboard

**Insufficient credits**
- Check your balance with `bun dev balance`
- Top up your account at https://www.kob-ai.dev

**Model not available**
- List available models with `bun dev models`
- Verify the model ID is correct

## 📝 Documentation

- [MANUAL.md](MANUAL.md) — คู่มือการใช้งานฉบับเต็ม (ภาษาไทย)
- [QUICKSTART.md](QUICKSTART.md) — เริ่มต้นใช้งานอย่างรวดเร็ว
- [PROJECT.md](PROJECT.md) — สถาปัตยกรรมและโครงสร้างโปรเจค
- [AGENTS.md](AGENTS.md) — คู่มือสำหรับนักพัฒนา / AI agents
- [SPECTS.md](SPECTS.md) — Technical specifications

## 📄 License

KOB AI CLI - Non-Commercial Open Source License

Copyright (c) 2025 KOB AI Project Owner

This software is open source and free to use, modify, and distribute for **non-commercial purposes only**.

**Commercial use is strictly prohibited without prior written permission from the owner.**

For commercial licensing inquiries, please contact the project owner.

See the [LICENSE](LICENSE) file for full terms.

## 🤝 Support

For issues or questions, please visit https://www.kob-ai.dev or contact the Kob AI development team.
