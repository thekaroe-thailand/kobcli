---
title: "code-tui"
type: stub
source: src/ui/code-tui.tsx
status: active
created: 2026-06-05
updated: 2026-06-05
tags:
  - stub
  - source
  - tui
aliases:
  - code-tui
  - code-tui.tsx
  - BrandHeader
  - WelcomeHero
  - ConversationView
  - ConversationPanel
  - ResponseBox
  - CommandResultBox
  - InputBox
  - GeneratingPanel
  - BottomBar
  - CodeEngine
  - runCodeTui
---

# code-tui

> **Source file:** `src/ui/code-tui.tsx`

The single biggest file in the project. Defines the entire TUI mode (the default when you run `kob` with no arguments).

- Top-level: `runCodeTui()` (mounts the Ink tree) and `CodeEngine` (the React root that holds all state).
- Components: `BrandHeader`, `WelcomeHero`, `ConversationView`, `ConversationPanel`, `ResponseBox`, `CommandResultBox`, `InputBox`, `GeneratingPanel`, `BottomBar`.
- Helpers: `formatNum`, `formatDuration`, `formatV2Model`, `modelSupportsVision`, `isImagePath`, `kobImagesDir`, `attachImagePath`, `pasteImageFromClipboard`, `parseFileChanges`, `parseShellCommands`, `runShellCommand`, `readVersion`.
- Constants: `MODES`, `SLASH_COMMANDS`.

Detailed walkthroughs live in [[04-tui-layout]], [[05-conversation-scrolling]], [[07-slash-system]] and [[06-images-vision]].

## See also

- [[04-tui-layout]] — every component
- [[07-slash-system]] — `SLASH_COMMANDS` + `handleSlashCommand`
- [[01-architecture]] — where it sits in the runtime stack
