# 🤖 KOB AI CLI

Command-line interface for interacting with KOB AI API. Built with Bun and TypeScript.

## ✨ Features

- 🔐 **Authentication** - Verify credentials and check balance
- 💬 **AI Chat** - Send messages and get AI responses
- 🌊 **Streaming** - Real-time streaming AI responses
- 🤖 **Models** - Browse available AI models and pricing
- 📁 **Projects** - Create, update, list, and delete projects
- 📜 **Rules** - Manage project rules (forbidden, required, custom)
- 💰 **Credits** - View credit history and transactions
- 🎨 **Rich Output** - Beautiful terminal output with colors and formatting

## 🚀 Quick Start

### Prerequisites

- **Bun** runtime installed ([Install Bun](https://bun.sh/docs/installation))
- KOB AI API credentials (API Key and API Token)

### Installation

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
# KOB_API_BASE_URL=https://kob-ai.com
# KOB_API_KEY=kob_your_api_key
# KOB_API_TOKEN=your_api_token
```

Or export them directly:
```bash
export KOB_API_KEY=kob_your_api_key
export KOB_API_TOKEN=your_api_token
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

Interactive commands:
- `/clear` - Clear conversation history
- `/stats` - Show conversation statistics
- `/help` - Show available commands
- `/exit` - Exit chat mode

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

### Projects

**List projects:**
```bash
bun dev projects:list
```

**Create project:**
```bash
bun dev projects:create "My Chatbot" \
  --description "AI chatbot for customer support"
```

**Update project:**
```bash
bun dev projects:update <project-id> \
  --name "Updated Name" \
  --description "New description"
```

**Delete project:**
```bash
bun dev projects:delete <project-id>
```

### Rules

**List rules:**
```bash
bun dev rules:list --project-id <project-id>
```

**Create rule:**
```bash
bun dev rules:create \
  --project-id <project-id> \
  --text "Must respond in Thai only" \
  --type required
```

Rule types:
- `forbidden` - 🚫 Things AI must not do
- `required` - ✅ Things AI must do
- `custom` - 📌 Custom rules

**Update rule:**
```bash
bun dev rules:update <rule-id> \
  --project-id <project-id> \
  --text "Updated rule text" \
  --active false
```

**Delete rule:**
```bash
bun dev rules:delete <rule-id> --project-id <project-id>
```

### Credits

**View credit history:**
```bash
bun dev credits:history
```

**With pagination:**
```bash
bun dev credits:history --limit 50 --offset 0
```

## 🔧 Options

### Chat & Stream Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --provider` | AI provider (DeepSeek, OpenRouter, DeepInfra) | DeepSeek |
| `-m, --model` | Model ID | deepseek-chat |
| `-t, --temperature` | Temperature (0.0-2.0) | 0.7 |
| `--max-tokens` | Maximum tokens | 4096 |
| `--project-id` | Project ID for rules | - |
| `--system-prompt` | System prompt | - |

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

# 3. Create a project
bun dev projects:create "Customer Support Bot"

# 4. Add rules to project
bun dev rules:create \
  --project-id <id> \
  --text "Always respond in Thai" \
  --type required

# 5. Chat with AI using project rules
bun dev chat "สวัสดี ช่วยแนะนำสินค้าหน่อย" \
  --project-id <id>

# 6. Stream response for longer content
bun dev stream "Write a detailed guide about AI" \
  --model openai/gpt-4o

# 7. Check credit usage
bun dev balance
bun dev credits:history
```

## 🛠 Development

### Project Structure

```
kob-cli/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/             # Command implementations
│   │   ├── auth.ts          # Authentication commands
│   │   ├── chat.ts          # Chat commands
│   │   ├── stream.ts        # Streaming command
│   │   ├── models.ts        # Models command
│   │   ├── projects.ts      # Project CRUD
│   │   ├── rules.ts         # Rules CRUD
│   │   └── credits.ts       # Credit history
│   ├── utils/               # Utility modules
│   │   ├── api.ts           # API client
│   │   ├── config.ts        # Configuration
│   │   ├── format.ts        # Output formatting
│   │   └── errors.ts        # Error handling
│   └── types/               # TypeScript types
│       └── index.ts
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

**Error: KOB_API_KEY and KOB_API_TOKEN environment variables are required**
- Make sure you've set your environment variables
- Check that they're exported correctly or in .env file

**Authentication failed**
- Verify your API key and token are correct
- Check that your token is active on the KOB AI website

**Insufficient credits**
- Check your balance with `bun dev balance`
- Top up your account on the KOB AI website

**Model not available**
- List available models with `bun dev models`
- Verify the model ID is correct

## 📝 API Documentation

For detailed API documentation, see the official KOB AI API docs in the parent directory:
- `/my-app/docs/api-token-verify.md`
- `/my-app/docs/api-ai-chat.md`
- `/my-app/docs/api-ai-stream.md`
- `/my-app/docs/api-models.md`
- `/my-app/docs/api-projects.md`
- `/my-app/docs/api-project-rules.md`
- `/my-app/docs/api-credit-history.md`

## 📄 License

Private - KOB AI Project

## 🤝 Support

For issues or questions, please contact the KOB AI development team.
