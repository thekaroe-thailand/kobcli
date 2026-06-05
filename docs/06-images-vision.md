---
title: "06 — Images & Vision"
type: reference
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - kob-cli
  - images
  - vision
  - clipboard
---

# 06 — Images & Vision

`InputBox` supports two ways to attach images:

1. **Paste a file path** (text) — if the path ends in `.png/.jpg/.jpeg/.gif/.webp/.bmp` and the file exists, it's copied into the local image cache and shown as a chip.
2. **`Ctrl+V` paste from the OS clipboard** — the platform's clipboard reader extracts the image and saves it.

The user is always told whether the **current model** can actually see the image, via the `👁 vision` / `◌ text-only` badge in the header.

## Vision detection

`modelSupportsVision(model: string): boolean` in `[[code-tui]]`:

```ts
const visionTokens = [
    'vision', 'vl',
    'gpt-4o', 'gpt-4-vision', 'claude-3', 'gemini',
    'flash', 'pixtral', 'llava', 'minicpm-v', 'qwen-vl',
    'mimo-v', 'kob-vision', 'molmo',
];
return visionTokens.some(t => model.toLowerCase().includes(t));
```

The badge in the header is:
- `👁 vision` (purple, bold) — model *can* see images.
- `◌ text-only` (dim) — model cannot. `Ctrl+V` shows a toast `⚠ model does not support images`.

If you add a new model that supports images but isn't caught, add its token to this list.

## File-path detection

`isImagePath(text: string): boolean` checks for `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp` (case-insensitive). It's used by both `usePaste` (when the user pastes a path) and by `Ctrl+V` (the clipboard reader returns a saved file path on success).

## Where images are stored

`kobImagesDir()` → `~/.kob-cli/images/` (created on first use with `mkdirSync({ recursive: true })`).

`attachImagePath(src: string)`:
- If `src` is already inside `~/.kob-cli/images/`, returns it as-is.
- Otherwise, copies the file in with a timestamped name: `~/.kob-cli/images/pasted-<timestamp><.ext>`.
- Returns the destination path.

The destination is what gets added to `attachments` state and what is shown as a chip in the input.

## OS clipboard readers (`pasteImageFromClipboard`)

| OS | Command |
|----|---------|
| **Windows** | `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::GetImage() \| …"` (encodes as PNG via `System.Drawing`) |
| **macOS** | `osascript -e 'the clipboard as «class PNGf»'`, fallback to `pngpaste` if available |
| **Linux** | `wl-paste --type image` (Wayland) or `xclip -selection clipboard -t image/png -o` (X11) |

All three are wrapped in a 10-second timeout. The function returns either:
- a file path inside `~/.kob-cli/images/pasted-<ts>.png` (success), or
- `null` (no image in clipboard, or reader failed).

The `InputBox` shows a transient toast on success/failure: `📎 pasted <name>` or `⚠ no image in clipboard`.

## How the API sees the image (today)

`KobApiClient.chatStream` accepts `messages: { role, content: string }[]` — **text only**. So when you submit with attachments, `CodeEngine.handleSubmit` rewrites the user message to:

```
<your prompt>

[Attached images — paths saved for reference:]
  - C:\Users\…/pasted-1717600001.png
  - C:\Users\…/pasted-1717600002.jpg
```

The path is visible to the model so it can read the file with its own tools (if it has any), but the image bytes are **not** sent in the request body. This is intentional for now — see [[12-known-limitations]] for the path to true multimodal.

## What the user sees

- While typing/pasting, chips appear above the input line: `📎 pasted-1717600001.png` etc.
- `Backspace` first deletes the right-most chip, then text — same as the existing delete logic.
- `Esc` clears both text and chips.
- The submit handler ignores empty text if chips are present, so you can submit "just the image" by clearing the prompt.

## Adding a new clipboard backend

1. Extend `pasteImageFromClipboard` with a new `if (process.platform === '…')` branch.
2. The contract is: write the image to a file under `~/.kob-cli/images/` and return the path, or return `null`.
3. Keep the timeout (10s) and try not to spawn interactive shells.
