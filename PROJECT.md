# KOB CLI - Project Documentation

## 📋 ภาพรวมโปรเจกต์

**KOB CLI** คือ AI coding agent สำหรับ terminal ที่พัฒนาโดย **Kob AI** (www.kob-ai.dev) จากประเทศไทย 🇹🇭

โปรเจกต์นี้ให้ประสบการณ์ 2 แบบใน package เดียว:

1. **Classic CLI** - คำสั่งแบบ one-shot สำหรับ scripting และ CI
2. **Full-screen TUI** - โหมดเริ่มต้นเมื่อรัน `kob` โดยไม่มี arguments

### จุดเด่น

- 🚀 **Terminal-first** - ทุกการทำงานใช้ keyboard ไม่ต้องใช้ mouse
- 🤖 **3 Modes** - Ask (ถามคำถาม) · Plan (ออกแบบก่อน) · Code (เขียนโค้ด + รันคำสั่งอัตโนมัติ)
- 🌊 **Streaming** - แสดงผล token-by-token แบบ real-time
- 🖼️ **Image paste** - รองรับ Ctrl+V วางรูปภาพ (path-only ในปัจจุบัน)
- ⚡ **Auto-execute** - ใน Code mode จะรัน shell commands ที่ AI สร้างให้อัตโนมัติ
- 📦 **128k context** - รองรับ context window ขนาดใหญ่

---

## 🏗️ สถาปัตยกรรม (Architecture)

### Runtime Stack

| Layer         | Technology                   | เหตุผลที่เลือก                              |
| ------------- | ---------------------------- | ------------------------------------------- |
| Runtime       | **Bun ≥ 1.3**                | เร็ว, native binary compile, auto-load .env |
| Language      | **TypeScript** (strict, ESM) | Type safety + Node ecosystem                |
| TUI Framework | **Ink 7.0.5** + **React 19** | React components สำหรับ terminal            |
| CLI Parser    | **Commander 15**             | มาตรฐานสำหรับ subcommand registration       |
| Streams       | **Native Web Streams**       | ใช้โดย KobApiClient.chatStream              |
| Styling       | **Chalk** + color tokens     | สีที่ share ระหว่าง TUI files               |

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  User Input                                                  │
│  (keyboard)                                                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  bin/cli.cjs                                                 │
│  └─► spawn bun src/index.ts                                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  src/index.ts (Entry Point)                                  │
│  • อ่าน package.json เพื่อเอา version                        │
│  • ลงทะเบียน subcommands ทั้งหมด                             │
│  • ถ้าไม่มี subcommand → runCodeTui()                        │
└────────┬─────────────────────────────────┬──────────────────┘
         │                                 │
         │ (มี subcommand)                 │ (ไม่มี subcommand)
         ▼                                 ▼
┌──────────────────────┐      ┌──────────────────────────────┐
│  src/commands/*.ts   │      │  src/ui/code-tui.tsx         │
│  (One-shot CLI)      │      │  (TUI Mode - Default)        │
│  • auth.ts           │      │  • CodeEngine component      │
│  • chat.ts           │      │  • BrandHeader               │
│  • stream.ts         │      │  • ConversationPanel         │
│  • models.ts         │      │  • InputBox                  │
│  • code.ts           │      │  • ModelPicker               │
│  • ask.ts            │      │  • ConfigForm                │
│  • skills.ts         │      │                              │
└────────┬─────────────┘      └──────────────┬───────────────┘
         │                                   │
         └──────────────┬────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │  src/utils/api.ts            │
         │  (KobApiClient)              │
         │  • get(), post()             │
         │  • chatStream() - async gen  │
         └──────────────┬───────────────┘
                        │
                        │ HTTPS
                        ▼
         ┌──────────────────────────────┐
         │  KOB AI API Server           │
         │  https://www.kob-ai.dev      │
         │  • /api/v2/chat/completions  │
         │  • /api/models               │
         │  • /api/tokens/verify        │
         └──────────────────────────────┘
```

---

## 📁 โครงสร้างไฟล์ (File Structure)

### Root Files

| ไฟล์            | หน้าที่                                                          |
| --------------- | ---------------------------------------------------------------- |
| `package.json`  | name: `kob-cli`, scripts, dependencies, `bin: kob → bin/cli.cjs` |
| `tsconfig.json` | Strict TypeScript, ESM, JSX (react-jsx)                          |
| `bin/cli.cjs`   | CJS shim ที่ spawn `bun src/index.ts`                            |
| `src/index.ts`  | **Entry point จริง** - ลงทะเบียน commands, เปิด TUI              |
| `.env.example`  | Template สำหรับ .env file                                        |

### `src/commands/` - One-shot CLI Mode

| ไฟล์        | Command                    | รายละเอียด                          |
| ----------- | -------------------------- | ----------------------------------- |
| `auth.ts`   | `auth:verify`, `balance`   | ตรวจสอบ API key, ดู credit balance  |
| `chat.ts`   | `chat`, `chat:interactive` | ส่งข้อความเดียว หรือแชทแบบต่อเนื่อง |
| `stream.ts` | `stream`                   | Streaming chat (แสดงทีละ token)     |
| `models.ts` | `models`                   | แสดงรายการ AI models ทั้งหมด        |
| `code.ts`   | `code`                     | Code generation แบบ one-shot        |
| `ask.ts`    | `ask`                      | ถามคำถามแบบ one-shot                |
| `skills.ts` | `skills`                   | แสดง skills ที่มีอยู่               |

### `src/ui/` - TUI Mode

| ไฟล์               | Exports                    | รายละเอียด                               |
| ------------------ | -------------------------- | ---------------------------------------- |
| `code-tui.tsx`     | `runCodeTui`, `CodeEngine` | **ไฟล์ใหญ่สุด** (~1800 lines) - TUI หลัก |
| `colors.ts`        | `c`                        | Color tokens ที่ share กัน               |
| `model-picker.tsx` | `ModelPicker`              | Overlay สำหรับเลือก model                |
| `config-form.tsx`  | `ConfigForm`               | Overlay สำหรับแก้ไข .env                 |

### `src/utils/` - Utilities

| ไฟล์          | Public API                        | หน้าที่                       |
| ------------- | --------------------------------- | ----------------------------- |
| `api.ts`      | `KobApiClient`                    | HTTP client สำหรับ KOB AI API |
| `config.ts`   | `getConfig()`                     | อ่าน config จาก process.env   |
| `env-file.ts` | `readEnvFile()`, `writeEnvFile()` | อ่าน/เขียน .env file โดยตรง   |
| `format.ts`   | `formatDate`, `formatUsage`       | Pretty-print helpers          |
| `errors.ts`   | `ApiError`, `handleApiError`      | Error handling                |

### `src/types/index.ts` - Type Definitions

Interfaces สำคัญ:

- `CliConfig` - `{ baseUrl, apiKey, apiToken?, bearerToken?, modelId? }`
- `ModelsResponse`, `ProviderModels`, `AIModel` - API response สำหรับ models
- `ChatResponse`, `ChatUsage` - Chat response
- `StreamEvent` - Streaming events
- `UserToken` - Auth response

---

## 🎯 การทำงานหลัก (Core Functionality)

### 1. Entry Point (`src/index.ts`)

```typescript
// อ่าน version จาก package.json
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);
const VERSION: string = pkg.version;

// ลงทะเบียน commands
program.addCommand(authVerifyCommand);
program.addCommand(chatCommand);
// ... อื่นๆ

// ถ้าไม่มี subcommand → เปิด TUI
if (process.argv.length <= 2) {
  await runCodeTui();
  process.exit(0);
}
```

### 2. API Client (`src/utils/api.ts`)

**KobApiClient** มี 3 methods หลัก:

#### `post<T>(endpoint, body)` - สำหรับ one-shot CLI

```typescript
const data = await client.post<UserToken>("/api/tokens/verify");
```

#### `chatStream(model, messages, options)` - สำหรับ streaming

```typescript
for await (const chunk of client.chatStream(model, messages, options)) {
  const delta = chunk.choices?.[0]?.delta?.content;
  if (delta) process.stdout.write(delta);
}
```

#### `chatComplete(model, messages, options)` - Accumulate stream

```typescript
const result = await client.chatComplete(model, messages);
// result = { content, model, usage }
```

**Authentication:**

- ใช้ Bearer token ใน header สำหรับ v2 API
- รองรับ format: `kob_xxx:token` หรือ `kob_xxx`

### 3. Configuration (`src/utils/config.ts`)

```typescript
export function getConfig(): CliConfig {
  let baseUrl = process.env.KOB_API_BASE_URL || "https://www.kob-ai.dev";
  const rawKey = process.env.KOB_API_KEY || "";
  const modelId = process.env.KOB_MODEL_ID;

  // แยก api_key:token
  const colonIndex = rawKey.indexOf(":");
  const apiKey = colonIndex !== -1 ? rawKey.substring(0, colonIndex) : rawKey;
  const apiToken =
    colonIndex !== -1 ? rawKey.substring(colonIndex + 1) : undefined;

  return { baseUrl, apiKey, apiToken, bearerToken: rawKey, modelId };
}
```

**Bun auto-loads** `.env.local` และ `.env` ที่ process start ไม่ต้องใช้ dotenv library

### 4. TUI Mode (`src/ui/code-tui.tsx`)

#### Components หลัก

**CodeEngine** - Main component ที่จัดการ state ทั้งหมด:

```typescript
const [exchanges, setExchanges] = useState<Exchange[]>([]);  // ประวัติการคุย
const [phase, setPhase] = useState<Phase>('input');          // 'input' | 'generating'
const [mode, setMode] = useState<Mode>('code');              // 'ask' | 'plan' | 'code'
const [model, setModel] = useState<string>(...);             // current model
const [scrollOffset, setScrollOffset] = useState<number>(0); // scroll position
const [palette, setPalette] = useState<null | 'models'>(null);
const [configOpen, setConfigOpen] = useState<boolean>(false);
const messagesRef = useRef<Message[]>([]);                   // conversation history
```

**BrandHeader** - แสดง logo + info:

- ASCII logo (KOB CLI)
- Model info (name, provider, vision support)
- Session stats (rounds, files, commands, elapsed time, context usage)

**ConversationPanel** - แสดงประวัติการคุย:

- ใช้ **line-based scrolling** (Ink ไม่มี native scroll)
- Auto-scroll to bottom เมื่อมี round ใหม่
- รองรับ PgUp/PgDn/g/G สำหรับ navigation

**InputBox** - รับ input จาก user:

- รองรับ slash commands (`/ask`, `/plan`, `/code`, `/clear`, `/models`, `/config`, `/help`, `/exit`)
- Autocomplete popup เมื่อพิมพ์ `/`
- Image paste (Ctrl+V)
- Mode switching (Tab หรือ 1/2/3)
- **Cursor movement** — ←/→ เพื่อเลื่อน cursor, Home/End เพื่อ jump ตำแหน่ง
- **Cursor-aware insertion** — ตัวอักษร, paste, และ backspace ทำงาน ณ ตำแหน่ง cursor
- **Blinking cursor** — `▌` กะพริบทุก 500ms ที่ตำแหน่ง `cursorPos`

**GeneratingPanel** - แสดงขณะ AI กำลังตอบ:

- Spinner animation
- Status messages ("Analyzing request", "Writing code", ...)

**ModelPicker** - Overlay สำหรับเลือก model:

- ค้นหาจาก API (`POST /api/models`)
- Filter แบบ real-time
- แสดงราคา (input/output per 1M tokens)

**ConfigForm** - Overlay สำหรับแก้ไข .env:

- 3 fields: Base URL, API Key, Default Model
- เขียนลง .env.local (หรือ .env)
- Preserve comments และ key ordering

#### 3 Modes

| Mode     | Icon | System Prompt                            | Writes Files |
| -------- | ---- | ---------------------------------------- | ------------ |
| **Ask**  | 💡   | "Answer questions concisely"             | ❌           |
| **Plan** | ◐    | "Present implementation plan first"      | ❌           |
| **Code** | ◉    | "Write code + bash blocks, auto-execute" | ✅           |

#### Slash Commands

| Command   | Group   | Action                      |
| --------- | ------- | --------------------------- |
| `/ask`    | mode    | Switch to Ask mode          |
| `/plan`   | mode    | Switch to Plan mode         |
| `/code`   | mode    | Switch to Code mode         |
| `/clear`  | session | Clear conversation history  |
| `/reset`  | session | Reset model to .env default |
| `/models` | session | Open model picker           |
| `/config` | meta    | Open config form            |
| `/help`   | meta    | Show help screen            |
| `/exit`   | meta    | Quit KOB CLI                |

#### Auto-Execute Shell Commands

ใน **Code mode**, AI สามารถสร้าง bash code blocks และ CLI จะรันให้อัตโนมัติ:

````typescript
export function parseShellCommands(content: string): string[] {
  // หา ```bash ... ``` blocks
  const commands: string[] = [];
  // ...
  return commands;
}

export function runShellCommand(cmd: string): CommandResult {
  const stdout = execSync(cleaned, {
    encoding: "utf-8",
    timeout: 60_000, // 60 วินาที
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { cmd, ok: true, stdout, stderr: "", durationMs, exitCode: 0 };
}
````

#### File Writing

ใน **Code mode**, AI สามารถสร้างไฟล์ได้:

````typescript
export function parseFileChanges(content: string): FileChange[] {
  // หา code blocks ที่มี filename comment
  // ตัวอย่าง: ```ts\n// filename: src/server.ts\n<code>\n```
  const files: FileChange[] = [];
  // ...
  return files;
}

export function writeFiles(files: FileChange[]): string[] {
  const created: string[] = [];
  for (const f of files) {
    const filePath = resolve(process.cwd(), f.filename);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, f.content, "utf-8");
    created.push(f.filename);
  }
  return created;
}
````

### 5. Image & Vision Support

**Vision Detection:**

```typescript
export function modelSupportsVision(model: string): boolean {
  const visionTokens = [
    "vision",
    "vl",
    "gpt-4o",
    "claude-3",
    "gemini",
    "flash",
    "pixtral",
    "llava",
    "qwen-vl", // ...
  ];
  return visionTokens.some((t) => model.toLowerCase().includes(t));
}
```

**Image Paste (Ctrl+V):**

- Windows: PowerShell + System.Windows.Forms.Clipboard
- macOS: osascript
- Linux: xclip หรือ wl-paste

**ข้อจำกัด:** ปัจจุบันส่งแค่ **path** ของรูป ไม่ส่ง bytes (ดู Known Limitations)

---

## 🔗 ความสัมพันธ์ระหว่าง Components

### Data Flow ใน TUI

```
User Input
    ↓
InputBox (รับ text + attachments)
    ↓
handleSubmit(input, attachments)
    ↓
├─ ถ้าขึ้นต้นด้วย "/" → handleSlashCommand()
│   ├─ /models → setPalette('models') → ModelPicker
│   ├─ /config → setConfigOpen(true) → ConfigForm
│   ├─ /clear → setExchanges([])
│   └─ /exit → process.exit(0)
│
└─ ถ้าไม่ใช่ slash → API Call
    ↓
KobApiClient.chatStream(model, messages, options)
    ↓
for await (const chunk of stream)
    ↓
fullContent += delta
    ↓
├─ parseFileChanges(fullContent) → writeFiles()
├─ parseShellCommands(fullContent) → runShellCommand()
└─ setExchanges([...prev, newExchange])
    ↓
ConversationPanel re-renders
    ↓
Auto-scroll to bottom (setScrollOffset(0))
```

### State Management

**ไม่มี global state library** - ทุกอย่างอยู่ใน `CodeEngine`:

| State          | Type                        | Purpose                                        |
| -------------- | --------------------------- | ---------------------------------------------- |
| `exchanges`    | `Exchange[]`                | ประวัติการคุย (input, output, files, commands) |
| `phase`        | `'input' \| 'generating'`   | ควบคุม InputBox vs GeneratingPanel             |
| `mode`         | `'ask' \| 'plan' \| 'code'` | กำหนด system prompt + behavior                 |
| `model`        | `string`                    | Current model ID                               |
| `scrollOffset` | `number`                    | Scroll position ใน conversation                |
| `palette`      | `null \| 'models'`          | แสดง ModelPicker                               |
| `configOpen`   | `boolean`                   | แสดง ConfigForm                                |
| `messagesRef`  | `useRef<Message[]>`         | Conversation history (multi-turn)              |
| `configRef`    | `useRef<CliConfig>`         | Mutable config snapshot                        |

### Overlay Focus Management

เมื่อ overlay เปิดอยู่ (`palette !== null || configOpen`), `InputBox` จะได้รับ `isActive: false`:

```typescript
<InputBox
  onSubmit={handleSubmit}
  mode={mode}
  isActive={palette === null && !configOpen && !helpOpen && phase === 'input'}
/>
```

ทำให้ overlay ควบคุม keyboard แทน InputBox (แก้ bug ที่ Enter ใน ModelPicker จะ submit ข้อความพร้อมกัน)

---

## ⚙️ Configuration

### Environment Variables

| Variable           | Required | Default                  | Description                                      |
| ------------------ | -------- | ------------------------ | ------------------------------------------------ |
| `KOB_API_BASE_URL` | No       | `https://www.kob-ai.dev` | API base URL                                     |
| `KOB_API_KEY`      | **Yes**  | -                        | API key (format: `kob_xxx` หรือ `kob_xxx:token`) |
| `KOB_MODEL_ID`     | No       | -                        | Default model ID                                 |

### .env File Priority

`getEnvPath()` จะหาไฟล์ตามลำดับ:

1. `.env.local` (preferred - Bun treats as local secrets)
2. `.env`
3. `.env.local` (สร้างใหม่ถ้าไม่มีเลย)

### Config Form (`/config`)

แก้ไข 3 fields:

- **Base URL** - API endpoint (auto-strip `/v1`, `/v2`)
- **API Key** - rendered as `•••` (secret)
- **Default Model** - optional

เขียนลง .env file โดย preserve comments และ key ordering

---

## 🚀 Build & Release

### Development

```bash
bun dev <command>        # รัน CLI command
bun dev                  # เปิด TUI
```

### Build Native Binary

```bash
bun run build
# หรือ
bun build src/index.ts --compile --outfile kob-cli
```

สร้าง standalone binary (~70 MB) ที่ bundle ทุก dependencies

### Release Flow

```bash
npm run publish
```

`src/scripts/release.ts` จะ:

1. อ่าน `package.json`
2. Bump version (patch)
3. เขียนกลับ `package.json`
4. รัน `bun run build`
5. รัน `npm publish --ignore-scripts`
6. Git commit + tag + push

### Installation

```bash
# จาก npm
npm install -g kob-cli

# จาก source
cd kob-cli
bun install
bun link  # สร้าง symlink ให้ใช้ kob ได้ทุกที่
```

---

## 📊 API Endpoints

### Authentication

**POST /api/tokens/verify**

```json
{
  "api_key": "kob_xxx"
}
```

Response:

```json
{
  "success": true,
  "user_email": "user@example.com",
  "user_name": "John Doe",
  "credit_balance": 250,
  "package_name": "Premium Monthly"
}
```

### Chat (Streaming)

**POST /api/v2/chat/completions** (OpenAI-compatible)

Request:

```json
{
  "model": "deepseek/deepseek-chat",
  "messages": [{ "role": "user", "content": "Hello" }],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 4096
}
```

Response: Server-Sent Events (SSE)

```
data: {"id":"...","choices":[{"delta":{"content":"Hi"}}]}
data: {"id":"...","choices":[{"delta":{"content":"!"}}]}
data: [DONE]
```

### Models

**POST /api/models**

Response:

```json
{
  "success": true,
  "provider_count": 2,
  "model_count": 302,
  "providers": [
    {
      "provider": "DeepSeek",
      "models": [
        {
          "modelId": "deepseek-chat",
          "displayName": "DeepSeek V3",
          "inputPricePer1M": 0.27,
          "outputPricePer1M": 1.1
        }
      ]
    }
  ]
}
```

---

## 🎨 Color System

Color tokens ทั้งหมดอยู่ใน `src/ui/colors.ts`:

```typescript
export const c = {
  bg: "#0b0e14",
  panel: "#11151c",
  border: "#1f2937",
  borderDim: "#374151",
  borderAccent: "#38bdf8",
  text: "#e5e7eb",
  textDim: "#6b7280",
  textMuted: "#9ca3af",
  brand: "#38bdf8", // cyan - primary accent
  accent: "#a78bfa", // purple - secondary
  green: "#34d399", // success
  yellow: "#fbbf24", // warnings
  orange: "#fb923c",
  red: "#ef4444", // errors
  pink: "#f472b6", // branding
  blue: "#60a5fa",
};
```

**กฎ:** ห้าม hardcode hex ใน TUI ให้ใช้ `c.*` tokens เสมอ

---

## 🐛 Known Limitations

### 1. Image Upload เป็น Path-Only

**ปัจจุบัน:** Ctrl+V บันทึกรูปที่ `~/.kob-cli/images/` และส่งแค่ path ใน message

**เหตุผล:** API client ยังไม่รองรับ multimodal content

**วิธีแก้ในอนาคต:**

```typescript
type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
type Message = { role: string; content: string | ContentPart[] };
```

### 2. Command Output จำกัด 8 บรรทัด

`runShellCommand` เก็บแค่ 8 บรรทัดแรกเพื่อควบคุม height ของ round

### 3. Timeout 60 วินาที

คำสั่งที่รันนานกว่า 60 วินาทีจะถูก kill

### 4. Conversation History ถูกบันทึกในเครื่องแล้ว

Chat history ถูกบันทึกไว้ที่ `~/.kob-cli/history/<dir>.json` โดยอัตโนมัติ
(load/save via `loadChatHistory` / `saveChatHistory`)

เปิด TUI ใหม่จะเห็นประวัติครั้งก่อนกลับมา

### 5. Native Binary ขนาดใหญ่

`bun build --compile` สร้าง binary ~70 MB (ส่วนใหญ่เป็น V8 runtime)

### 6. ไม่มี Test Framework

ยังไม่มี automated tests - ใช้ manual smoke test ใน `docs/10-build-and-release.md`

---

## 🔧 การเพิ่มฟีเจอร์ใหม่

### เพิ่ม Slash Command

1. เพิ่มใน `SLASH_COMMANDS` array (`src/ui/code-tui.tsx`)
2. เพิ่ม `case` ใน `handleSlashCommand`
3. ถ้าเปิด overlay → เพิ่ม state ใน `CodeEngine`
4. อัพเดท `isActive` บน `InputBox`

### เพิ่ม Mode ใหม่

1. Extend `Mode` type
2. เพิ่มใน `MODES` array พร้อม `systemPrompt`
3. อัพเดท `ModeSelector` component

### เพิ่ม Overlay

1. สร้าง `src/ui/<name>.tsx`
2. เพิ่ม boolean state ใน `CodeEngine`
3. Mount conditionally ใน render tree
4. Gate `InputBox.isActive` เพื่อป้องกัน key conflicts

### เพิ่ม Env Key

1. Extend `CliConfig` ใน `src/types/index.ts`
2. อ่านใน `getConfig()` พร้อม default
3. เพิ่มใน `FIELDS` array ของ `ConfigForm`

---

## 📚 เอกสารเพิ่มเติม

- `docs/00-overview.md` - ภาพรวมและปรัชญา
- `docs/01-architecture.md` - สถาปัตยกรรมโดยละเอียด
- `docs/02-source-map.md` - File-by-file walkthrough
- `docs/03-cli-commands.md` - CLI commands reference
- `docs/04-tui-layout.md` - TUI components
- `docs/05-conversation-scrolling.md` - Scrolling mechanism
- `docs/06-images-vision.md` - Image support
- `docs/07-slash-system.md` - Slash commands
- `docs/08-config-and-env.md` - Configuration
- `docs/09-models-picker.md` - Model picker
- `docs/10-build-and-release.md` - Build & release process
- `docs/11-conventions.md` - Coding conventions
- `docs/12-known-limitations.md` - Limitations & roadmap

---

## 👨‍💻 Developer

**Kob AI** - Made in Thailand 🇹🇭

- Website: https://www.kob-ai.dev
- GitHub: https://github.com/thekaroe-thailand/kobcli
- npm: https://www.npmjs.com/package/kob-cli

---

**เอกสารนี้สร้างเมื่อ:** 2026-06-06
**Version:** 1.0.31
