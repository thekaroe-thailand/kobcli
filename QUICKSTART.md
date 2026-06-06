# 🚀 Quick Start Guide - KOB AI CLI

## 1. Setup (2 minutes)

### Install Dependencies
```bash
cd kob-cli
bun install
```

### Configure Credentials
Create a `.env` file:
```bash
KOB_API_BASE_URL=https://www.kob-ai.dev
KOB_API_KEY=kob_your_api_key_here
```

**Get your credentials from:** https://www.kob-ai.dev

---

## 2. Verify Setup
```bash
kob auth:verify
```

You should see your user info and credit balance.

---

## 3. Common Tasks

### Launch TUI (Recommended)
```bash
kob
```
Full-screen interactive coding agent. Switch modes with Tab: **Ask** → **Plan** → **Code**

### Check Balance
```bash
kob balance
```

### List Available Models
```bash
kob models
```

### Ask a Quick Question
```bash
kob ask "What is the difference between let and const?"
```

### Generate Code
```bash
kob code "Write a Python script that reads a CSV and outputs JSON"
```

### Chat with AI
```bash
kob chat "Hello, how are you?" \
  --provider DeepSeek \
  --model deepseek-chat
```

### Interactive Chat Mode
```bash
kob chat:interactive
```

Type messages and get responses. Use `/exit` to quit.

### Stream Response (Real-time)
```bash
kob stream "Write a poem about coding"
```

---

## 4. Help & Documentation

### View All Commands
```bash
kob --help
```

### Command-Specific Help
```bash
kob ask --help
kob code --help
kob chat --help
```

### Full Documentation
- [README.md](README.md) — Overview and commands
- [MANUAL.md](MANUAL.md) — Full user manual (Thai)
- [PROJECT.md](PROJECT.md) — Architecture details

---

## Troubleshooting

**Problem:** "KOB_API_KEY environment variable is required"
- **Solution:** Make sure your `.env` file exists with correct credentials

**Problem:** "Authentication failed"
- **Solution:** Check that your API key is correct and active

**Problem:** "Insufficient credits"
- **Solution:** Top up your account at https://www.kob-ai.dev

---

## Next Steps

1. ✅ Launch the TUI with `kob` for interactive coding
2. ✅ Try `kob ask` for quick Q&A
3. ✅ Use `kob code` to generate and save files
4. ✅ Try different AI models with `kob models`
5. ✅ Use streaming for long responses

---

**Need Help?** See [README.md](README.md) or [SPECTS.md](SPECTS.md) for detailed documentation.
