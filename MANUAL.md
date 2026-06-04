# 📘 KOB CLI User Manual

คู่มือการใช้งาน KOB AI CLI — พัฒนาโดย Kob AI (www.kob-ai.dev) Developer in Thailand 🇹🇭

---

## 🚀 Quick Start (ใช้งานเลย!)

**หลังติดตั้งแล้ว ใช้คำสั่ง `kob` ได้เลย:**

```bash
# เช็คการเชื่อมต่อ
kob auth:verify

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
3. [ใช้งาน AI Chat](#ใช้งาน-ai-chat)
4. [จัดการโปรเจค](#จัดการโปรเจค)
5. [ตั้งกฏให้ AI](#ตั้งกฏให้-ai)
6. [ดูเครดิต](#ดูเครดิต)
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

## จัดการโปรเจค

โปรเจคใช้สำหรับเก็บงานและกฏของ AI

### 1. ดูโปรเจคทั้งหมด
```bash
kob projects:list
```

### 2. สร้างโปรเจคใหม่
```bash
kob projects:create "ชื่อโปรเจค" --description "รายละเอียด"
```

**ตัวอย่าง:**
```bash
kob projects:create "แชทบอทขายของ" \
  --description "AI chatbot สำหรับร้านค้าออนไลน์"
```

### 3. แก้ไขโปรเจค
```bash
kob projects:update PROJECT_ID \
  --name "ชื่อใหม่" \
  --description "รายละเอียดใหม่"
```

**ตัวอย่าง:**
```bash
kob projects:update abc-123-def \
  --name "แชทบอท V2"
```

### 4. ลบโปรเจค
```bash
kob projects:delete PROJECT_ID
```

**ตัวอย่าง:**
```bash
kob projects:delete abc-123-def
```

⚠️ **คำเตือน:** การลบโปรเจคจะลบกฏทั้งหมดของโปรเจคนั้นด้วย!

---

## ตั้งกฏให้ AI

กฏใช้ควบคุมพฤติกรรม AI ในแต่ละโปรเจค

### ประเภทของกฏ:
- `forbidden` (🚫) - สิ่งที่ AI **ห้ามทำ**
- `required` (✅) - สิ่งที่ AI **ต้องทำ**
- `custom` (📌) - กฏทั่วไป

### 1. ดูกฏของโปรเจค
```bash
kob rules:list --project-id PROJECT_ID
```

### 2. สร้างกฏใหม่

**กฏแบบ Forbidden (ห้ามทำ):**
```bash
kob rules:create \
  --project-id PROJECT_ID \
  --text "ห้ามตอบเกี่ยวกับการเมือง" \
  --type forbidden
```

**กฏแบบ Required (ต้องทำ):**
```bash
kob rules:create \
  --project-id PROJECT_ID \
  --text "ต้องตอบเป็นภาษาไทยเท่านั้น" \
  --type required
```

**กฏแบบ Custom (ทั่วไป):**
```bash
kob rules:create \
  --project-id PROJECT_ID \
  --text "ตอบสั้นๆ ไม่เกิน 3 ประโยค" \
  --type custom
```

### 3. แก้ไขกฏ
```bash
kob rules:update RULE_ID \
  --project-id PROJECT_ID \
  --text "ข้อความใหม่" \
  --type required \
  --active true
```

**ปิดใช้งานกฏชั่วคราว:**
```bash
kob rules:update RULE_ID \
  --project-id PROJECT_ID \
  --active false
```

### 4. ลบกฏ
```bash
kob rules:delete RULE_ID \
  --project-id PROJECT_ID
```

### 5. ใช้โปรเจคพร้อมกฏตอนแชท

```bash
kob chat "สวัสดี" \
  --project-id PROJECT_ID
```

AI จะทำตามกฏที่ตั้งไว้ทั้งหมด!

---

## ดูเครดิต

### 1. เช็คยอดเงินคงเหลือ
```bash
kob balance
```

**ตัวอย่าง output:**
```
💰 Your Credit Balance:
────────────────────────────────────────────────────────────
Balance: 250 credits
1 credit = $0.01 USD
Approximate USD value: $2.50
```

### 2. ดูประวัติเติมเครดิต
```bash
kob credits:history
```

**แสดง 20 รายการล่าสุด:**
```bash
kob credits:history --limit 20 --offset 0
```

**แสดง 50 รายการ:**
```bash
kob credits:history --limit 50
```

**ดูหน้าถัดไป (ข้าม 50 รายการแรก):**
```bash
kob credits:history --offset 50
```

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

# 3. สร้างโปรเจค
kob projects:create "ผู้ช่วยเขียนโค้ด"

# 4. ตั้งกฏ
kob rules:create \
  --project-id YOUR_ID \
  --text "ตอบเป็นภาษาไทย" \
  --type required

kob rules:create \
  --project-id YOUR_ID \
  --text "ห้ามตอบเกี่ยวกับการเมือง" \
  --type forbidden

# 5. เริ่มใช้งาน
kob chat:interactive \
  --project-id YOUR_ID \
  --provider DeepSeek \
  --model deepseek-chat

# 6. เช็คเครดิต
kob balance
kob credits:history
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

### ❌ Resource not found

**สาเหตุ:** PROJECT_ID หรือ RULE_ID ไม่ถูกต้อง

**วิธีแก้:**
1. ดูโปรเจคทั้งหมด: `kob projects:list`
2. คัดลอก ID ที่ถูกต้อง
3. ลองใหม่อีกครั้ง

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
3. ใช้ Interactive mode แทนการส่ง chat หลายครั้ง
4. ตรวจสอบเครดิตบ่อยๆ ด้วย `balance`

### ได้คำตอบที่ดี
1. ตั้ง System Prompt ให้ชัดเจน
2. ใช้ Project Rules ควบคุม AI
3. ปรับ temperature ให้เหมาะกับงาน
4. ให้ context เพียงพอในข้อความ

### ใช้งาน efisien
1. ใช้ chat:interactive สำหรับคุยยาวๆ
2. ใช้ stream สำหรับข้อความยาว
3. สร้าง project แยกตามการใช้งาน
4. ตั้ง rules ไว้ล่วงหน้า

---

## 📞 ต้องการความช่วยเหลือ?

- **เอกสารครบถ้วน:** อ่าน [README.md](README.md)
- **ข้อมูลเทคนิค:** อ่าน [SPECTS.md](SPECTS.md)
- **เริ่มต้นเร็ว:** อ่าน [QUICKSTART.md](QUICKSTART.md)
- **เติมเครดิต:** https://www.kob-ai.dev
- **ดู API Keys:** https://www.kob-ai.dev

---

## 🎓 สรุปคำสั่งทั้งหมด

| คำสั่ง | หน้าที่ | ตัวอย่าง |
|--------|---------|----------|
| `auth:verify` | เช็คการเชื่อมต่อ | `kob auth:verify` |
| `balance` | ดูยอดเงิน | `kob balance` |
| `chat` | ส่งข้อความ | `kob chat "Hello"` |
| `chat:interactive` | คุยต่อเนื่อง | `kob chat:interactive` |
| `stream` | ตอบแบบ real-time | `kob stream "Write..."` |
| `models` | ดูโมเดล | `kob models` |
| `projects:list` | ดูโปรเจค | `kob projects:list` |
| `projects:create` | สร้างโปรเจค | `kob projects:create "Name"` |
| `projects:update` | แก้ไขโปรเจค | `kob projects:update ID --name "New"` |
| `projects:delete` | ลบโปรเจค | `kob projects:delete ID` |
| `rules:list` | ดูกฏ | `kob rules:list --project-id ID` |
| `rules:create` | สร้างกฏ | `kob rules:create --project-id ID --text "..." --type required` |
| `rules:update` | แก้ไขกฏ | `kob rules:update ID --project-id ID --text "..."` |
| `rules:delete` | ลบกฏ | `kob rules:delete ID --project-id ID` |
| `credits:history` | ดูประวัติเครดิต | `kob credits:history` |

---

**Happy Coding! 🚀**
