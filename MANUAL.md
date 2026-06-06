# 📘 KOB CLI User Manual

คู่มือการใช้งาน KOB AI CLI — พัฒนาโดย Kob AI (www.kob-ai.dev) Developer in Thailand 🇹🇭

---

## 🚀 Quick Start (ใช้งานเลย!)

**หลังติดตั้งแล้ว ใช้คำสั่ง `kob` ได้เลย:**

```bash
# เปิด TUI (โหมดหลัก)
kob

# เช็คการเชื่อมต่อ
kob auth:verify

# ถามคำถามแบบ one-shot
kob ask "อธิบาย async/await หน่อย"

# เขียนโค้ด
kob code "Write a Python script to read CSV"

# แชทกับ AI
kob chat "สวัสดีครับ"

# แชทแบบต่อเนื่อง
kob chat:interactive

# ดูโมเดลทั้งหมด
kob models

# เช็คยอดเงิน
kob balance
```

---

## 📋 สารบัญ

1. [ติดตั้งและตั้งค่า](#ติดตั้งและตั้งค่า)
2. [คำสั่งพื้นฐาน](#คำสั่งพื้นฐาน)
3. [TUI Mode (โหมดหลัก)](#tui-mode-โหมดหลัก)
4. [Ask — ถามคำถาม](#ask--ถามคำถาม)
5. [Code — เขียนโค้ด](#code--เขียนโค้ด)
6. [ใช้งาน AI Chat](#ใช้งาน-ai-chat)
7. [เทคนิคขั้นสูง](#เทคนิคขั้นสูง)
8. [แก้ปัญหา](#แก้ปัญหา)

---

## ติดตั้งและตั้งค่า

### 1. ติดตั้ง Dependencies
```bash
cd kob-cli
bun install
```

### 2. ตั้งค่า API Credentials

สร้างไฟล์ `.env` ในโฟลเดอร์ `kob-cli`:
```env
KOB_API_BASE_URL=https://www.kob-ai.dev
KOB_API_KEY=kob_XXXXXXXXXXXXXXXXXXXX
```

**วิธีรับ API Key:**
1. เข้า https://www.kob-ai.dev
2. ไปที่เมนู "Token Keys"
3. สร้าง Key ใหม่
4. คัดลอก `api_key` มาใส่ใน `.env`

### 3. ทดสอบการเชื่อมต่อ
```bash
kob auth:verify
```

ถ้าขึ้นข้อมูลผู้ใช้ = ✅ สำเร็จ!

---

## คำสั่งพื้นฐาน

### ดูวิธีใช้ทั้งหมด
```bash
kob --help
```

### ดูวิธีใช้แต่ละคำสั่ง
```bash
kob <command> --help
# ตัวอย่าง:
kob chat --help
```

---

## TUI Mode (โหมดหลัก)

รัน `kob` โดยไม่มี argument เพื่อเปิด full-screen TUI:

```bash
kob
```

TUI มี 3 โหมด สลับด้วย Tab หรือกด `1` / `2` / `3`:

| โหมด | ไอคอน | ใช้ทำอะไร |
|------|------|-----------|
| Ask | 💡 | ถามคำถาม ตอบแบบกระชับ |
| Plan | ◐ | ขอ implementation plan ก่อนลงมือ |
| Code | ◉ | เขียนโค้ด + รัน shell commands อัตโนมัติ + สร้างไฟล์ |

**Slash commands ใน TUI:**

| คำสั่ง | ผล |
|--------|-----|
| `/ask` `/plan` `/code` | เปลี่ยนโหมด |
| `/models` | เปิด model picker overlay |
| `/config` | แก้ไข API key / model ใน .env |
| `/clear` | ล้างประวัติการคุย |
| `/help` | แสดง help |
| `/exit` | ออกจาก TUI |

**Keyboard:**
- ← → เลื่อน cursor ในช่อง input
- PgUp / PgDn / `g` / `G` เลื่อนดู conversation
- Ctrl+V วางรูปภาพ (path-based)

---

## Ask — ถามคำถาม

```bash
kob ask "ข้อความที่ต้องการถาม"
```

**ตัวอย่าง:**
```bash
kob ask "อธิบาย closure ใน JavaScript"
kob ask "What is a binary tree?" --provider DeepSeek --model deepseek-chat
```

---

## Code — เขียนโค้ด

```bash
kob code "คำอธิบายโค้ดที่ต้องการ"
```

**ตัวอย่าง:**
```bash
kob code "Write a REST API in Python using FastAPI" --lang python
kob code "สร้าง todo list app ด้วย React" --temperature 0.3
```

ถ้า AI ตอบกลับด้วย code block ที่มี filename comment จะสร้างไฟล์ให้อัตโนมัติ

รัน `kob code` โดยไม่มี prompt เพื่อเปิด TUI ใน Code mode

---

## ใช้งาน AI Chat

### 1. แชทธรรมดา (ส่งข้อความเดียว)

```bash
kob chat "ข้อความที่ต้องการถาม"
```

**ตัวอย่าง:**
```bash
kob chat "เขียนฟังก์ชัน Python สำหรับหาค่าเฉลี่ย"
```

**ตัวเลือกเพิ่มเติม:**
```bash
kob chat "Explain quantum computing" \
  --provider DeepSeek \
  --model deepseek-chat \
  --temperature 0.7 \
  --max-tokens 4096
```

**Provider ที่ใช้ได้:**
- `DeepSeek` (แนะนำ - เร็วและถูก)
- `OpenRouter` (มีหลายโมเดล)
- `DeepInfra` (Llama, Qwen)

**โมเดลยอดนิยม:**
- DeepSeek: `deepseek-chat`, `deepseek-reasoner`, `deepseek-v4-flash`
- OpenRouter: `openai/gpt-4o`, `anthropic/claude-3.5-sonnet`, `google/gemini-1.5-pro`

### 2. แชทแบบ Interactive (คุยต่อเนื่อง)

```bash
kob chat:interactive
```

**คำสั่งในโหมด Interactive:**
- พิมพ์ข้อความแล้วกด Enter - ส่งข้อความ
- `/clear` - ล้างประวัติการคุย
- `/stats` - ดูสถิติการคุย (tokens, credits)
- `/help` - ดูคำสั่ง
- `/exit` หรือ `/quit` - ออกจากโหมด

**ตัวอย่างการใช้งาน:**
```bash
$ kob chat:interactive

🤖 KOB AI Interactive Chat
Type your message and press Enter
Commands: /clear, /stats, /help, /exit

You: สวัสดีครับ
AI: สวัสดีครับ มีอะไรให้ฉันช่วยไหมครับ?

You: เขียนโค้ด Python หน่อย
AI: ได้ครับ นี่คือตัวอย่าง...

You: /stats
📊 Conversation Statistics:
  Messages: 4
  Total Tokens: 245
  Total Credits Used: 2

You: /exit
Goodbye!
```

### 3. แชทแบบ Streaming (เห็นทีละตัวอักษร)

```bash
kob stream "ข้อความที่ต้องการ"
```

**ตัวอย่าง:**
```bash
kob stream "เขียนบทความยาวๆ เกี่ยวกับ AI" \
  --provider OpenRouter \
  --model openai/gpt-4o
```

**เหมาะสำหรับ:**
- ข้อความยาวๆ
- ดู AI ตอบแบบ real-time
- ไม่ต้องรอจนจบ

---

## เทคนิคขั้นสูง

### 1. ใช้ System Prompt

กำหนดบุคลิก AI:
```bash
kob chat "สวัสดี" \
  --system-prompt "คุณเป็นผู้ช่วยเขียนโปรแกรม เชี่ยวชาญ Python"
```

### 2. ปรับ Temperature

- `0.0-0.3` = ตอบแน่นอน, เหมาะกับโค้ด
- `0.5-0.7` = ปกติ (default: 0.7)
- `1.0-2.0` = สร้างสรรค์, เหมาะกับเรื่องราว

```bash
# เขียนโค้ด - ใช้ temperature ต่ำ
kob chat "เขียนฟังก์ชัน sort" \
  --temperature 0.3

# เขียนเรื่องสั้น - ใช้ temperature สูง
kob stream "เขียนนิยาย sci-fi" \
  --temperature 1.5
```

### 3. จำกัดจำนวน Tokens

```bash
kob chat "อธิบายสั้นๆ" \
  --max-tokens 500
```

### 4. Workflow ครบวงจร

```bash
# 1. เชื่อมต่อ
kob auth:verify

# 2. ดูโมเดล
kob models --provider DeepSeek

# 3. ถามคำถามเร็วๆ
kob ask "อธิบาย design pattern Observer"

# 4. สร้างโค้ด
kob code "Write a Python FastAPI CRUD app" --lang python

# 5. แชทแบบต่อเนื่อง
kob chat:interactive --provider DeepSeek --model deepseek-chat

# 6. หรือเปิด TUI ทำทุกอย่างในที่เดียว
kob

# 7. เช็คเครดิต
kob balance
```

### 5. JSON Output

ดูโมเดลแบบ JSON:
```bash
kob models --format json
```

เหมาะสำหรับเขียน script ต่อ!

---

## แก้ปัญหา

### ❌ Error: KOB_API_KEY environment variable is required

**สาเหตุ:** ยังไม่ได้ตั้งค่า credentials

**วิธีแก้:**
1. สร้างไฟล์ `.env` ในโฟลเดอร์ `kob-cli`
2. ใส่ API Key
3. ลองใหม่อีกครั้ง

### ❌ Authentication failed

**สาเหตุ:** API Key ผิด

**วิธีแก้:**
1. ตรวจสอบว่าคัดลอกมาถูกต้อง
2. เข้า https://www.kob-ai.dev
3. ถ้าไม่แน่ใจ ให้สร้าง Key ใหม่

### ❌ Insufficient credits

**สาเหตุ:** เครดิตหมด

**วิธีแก้:**
1. เช็คยอดคงเหลือ: `kob balance`
2. เติมเครดิตที่ https://www.kob-ai.dev
3. รอ 1-2 นาที แล้วลองใหม่

### ❌ AI provider error

**สาเหตุ:** AI Provider มีปัญหา หรือโมเดลถูกถอน

**วิธีแก้:**
1. ลองใช้โมเดลอื่น
2. ดูโมเดลที่ใช้ได้: `kob models`
3. ลองใหม่อีกครั้ง

### ❌ เครดิตถูกหักเยอะผิดปกติ

**สาเหตุ:** ข้อความยาว หรือใช้โมเดลราคาแพง

**วิธีแก้:**
1. ใช้โมเดลที่ถูกกว่า (DeepSeek V4 Flash ถูกสุด)
2. จำกัด max-tokens: `--max-tokens 2000`
3. ดูราคาโมเดล: `kob models`

---

## 💡 เคล็ดลับ

### ประหยัดเครดิต
1. ใช้ `deepseek-v4-flash` สำหรับงานทั่วไป (ถูกสุด)
2. ตั้ง `--max-tokens` ให้เหมาะสม
3. ใช้ Interactive mode หรือ TUI แทนการส่ง chat หลายครั้ง
4. ตรวจสอบเครดิตบ่อยๆ ด้วย `kob balance`

### ได้คำตอบที่ดี
1. ตั้ง System Prompt ให้ชัดเจน (`--system-prompt`)
2. ปรับ temperature ให้เหมาะกับงาน
3. ให้ context เพียงพอในข้อความ
4. ใช้ TUI ใน Plan mode ก่อน แล้วค่อยสลับไป Code mode

### ใช้งาน efficient
1. เปิด TUI (`kob`) สำหรับงาน coding ทั่วไป
2. ใช้ `kob ask` สำหรับคำถามเร็วๆ
3. ใช้ `kob chat:interactive` สำหรับคุยยาวๆ
4. ใช้ `kob stream` สำหรับข้อความยาวที่อยากเห็น real-time

---

## 📞 ต้องการความช่วยเหลือ?

- **เอกสารครบถ้วน:** อ่าน [README.md](README.md)
- **ข้อมูลเทคนิค:** อ่าน [SPECTS.md](SPECTS.md)
- **เริ่มต้นเร็ว:** อ่าน [QUICKSTART.md](QUICKSTART.md)
- **สถาปัตยกรรม:** อ่าน [PROJECT.md](PROJECT.md)
- **เติมเครดิต / ดู API Keys:** https://www.kob-ai.dev

---

## 🎓 สรุปคำสั่งทั้งหมด

| คำสั่ง | หน้าที่ | ตัวอย่าง |
|--------|---------|----------|
| *(ไม่มี args)* | เปิด TUI mode | `kob` |
| `auth:verify` | เช็คการเชื่อมต่อ | `kob auth:verify` |
| `balance` | ดูยอดเงิน | `kob balance` |
| `ask` | ถามคำถาม one-shot | `kob ask "What is Go?"` |
| `code` | สร้างโค้ด | `kob code "Write a REST API"` |
| `chat` | ส่งข้อความ | `kob chat "Hello"` |
| `chat:interactive` | คุยต่อเนื่อง | `kob chat:interactive` |
| `stream` | ตอบแบบ real-time | `kob stream "Write..."` |
| `models` | ดูโมเดล | `kob models` |
| `skills` | ดู skills ที่มี | `kob skills` |

---

**Happy Coding! 🚀**
