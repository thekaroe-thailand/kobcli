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
KOB_API_BASE_URL=https://kob-ai.com
KOB_API_KEY=kob_your_api_key_here
KOB_API_TOKEN=your_api_token_here
```

**Get your credentials from:** https://kob-ai.com/token-keys

---

## 2. Verify Setup
```bash
kob auth:verify
```

You should see your user info and credit balance.

---

## 3. Common Tasks

### Check Balance
```bash
kob balance
```

### List Available Models
```bash
kob models
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

## 4. Project Management

### Create a Project
```bash
kob projects:create "My Chatbot"
```

### Add Rules to Project
```bash
kob rules:create \
  --project-id YOUR_PROJECT_ID \
  --text "Always respond in Thai" \
  --type required
```

### Chat with Project Rules
```bash
kob chat "สวัสดี" \
  --project-id YOUR_PROJECT_ID
```

---

## 5. View History

### Credit History
```bash
kob credits:history
```

### List Projects
```bash
kob projects:list
```

### List Rules
```bash
kob rules:list --project-id YOUR_PROJECT_ID
```

---

## 6. Help & Documentation

### View All Commands
```bash
kob --help
```

### Command-Specific Help
```bash
kob chat --help
kob projects --help
```

### Full Documentation
See [README.md](README.md) for complete documentation.

---

## Troubleshooting

**Problem:** "KOB_API_KEY and KOB_API_TOKEN environment variables are required"
- **Solution:** Make sure your `.env` file exists with correct credentials

**Problem:** "Authentication failed"
- **Solution:** Check that your API key and token are correct and active

**Problem:** "Insufficient credits"
- **Solution:** Top up your account at https://kob-ai.com

---

## Next Steps

1. ✅ Try different AI models
2. ✅ Create projects for different use cases
3. ✅ Set up rules to control AI behavior
4. ✅ Use streaming for long responses
5. ✅ Monitor your credit usage

---

**Need Help?** See [README.md](README.md) or [SPECTS.md](SPECTS.md) for detailed documentation.
