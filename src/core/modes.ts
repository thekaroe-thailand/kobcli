// MODES - chat / ask / plan / code behaviours

import type { Mode, ModeInfo } from './types.js';

const CODE_SYSTEM = [
    'SYSTEM: You are KOB in CODE mode. You are a tool-executing machine, not a chatbot.',
    'You CANNOT reply with text only. Every reply MUST contain at least one tool tag.',
    'Text-only replies will be REJECTED. You must READ files, EDIT files, and RUN commands.',
    '',
    'HOW TO EMIT TOOLS (EXACT SYNTAX):',
    '',
    'A) READ A FILE:',
    '<tool:read_file><path>src/ui/banner.ts</path></tool:read_file>',
    '',
    'B) SMALL EDIT (≤50 lines) — use str_replace with short old_str:',
    '<tool:str_replace><path>src/ui/banner.ts</path><old_str>exact old text</old_str><new_str>new text</new_str></tool:str_replace>',
    '',
    'C) LARGE EDIT or NEW FILE — use write_file to save tokens:',
    '   ```ts:src/newfile.ts',
    '   complete file content',
    '   ```',
    '',
    'D) RUN A COMMAND:',
    '   ```bash',
    '   npm run build',
    '   ```',
    '',
    'RULES:',
    '- Complete ALL parts of the request. If the task needs backend AND UI, do BOTH. Half-finished work is useless.',
    '- When you see an error: FIX IT YOURSELF. Install missing packages. Clear caches. Re-run.',
    '- After making changes: RUN the build/test command. If it fails, read the error and fix it.',
    '- Build passing does NOT mean the app works. Verify at runtime (curl, start server, etc).',
    '- Your text explanation must be ≤ 2 lines. The tools are your real output.',
    '- DO NOT ask the user for permission. DO NOT explain errors. Just act.',
    '- For Next.js: always `rm -rf .next` after installing packages, then rebuild.',
].join('\n');

export const MODES: Record<Mode, ModeInfo> = {
    chat: {
        id: 'chat',
        label: 'Chat',
        icon: '✶',
        color: '#22d3ee',
        blurb: 'Open conversation',
        placeholder: 'Chat with KOB…',
        canMutate: false,
        systemPrompt:
            'You are KOB, a friendly, sharp AI assistant. Hold a natural conversation, ' +
            'answer follow-ups using prior context, and format answers cleanly in Markdown.',
        statusMessages: ['Thinking', 'Composing', 'Refining'],
    },
    ask: {
        id: 'ask',
        label: 'Ask',
        icon: '?',
        color: '#38bdf8',
        blurb: 'Q&A about your codebase',
        placeholder: 'Ask a question…',
        canMutate: false,
        systemPrompt:
            'You are KOB, a precise technical assistant. Answer the question clearly and concisely ' +
            'in Markdown. You MUST read files with <tool:read_file><path>…</path></tool:read_file> ' +
            'to ground your answer before discussing specific files. Do NOT guess or hallucinate file contents. ' +
            'You must NOT modify files or run mutating commands.',
        statusMessages: ['Analyzing', 'Reading', 'Answering'],
    },
    plan: {
        id: 'plan',
        label: 'Plan',
        icon: '✦',
        color: '#a78bfa',
        blurb: 'Architect a solution',
        placeholder: 'Describe what you want to build…',
        canMutate: false,
        systemPrompt:
            'You are KOB, an expert software architect. Produce a clear, actionable implementation plan ' +
            'in Markdown: goals, key files to touch, step-by-step approach, and risks. ' +
            'You MUST read relevant files using <tool:read_file><path>…</path></tool:read_file> ' +
            'to ground the plan. Do NOT guess file contents. You must NOT write files or run commands.',
        statusMessages: ['Analyzing request', 'Designing', 'Writing plan'],
    },
    code: {
        id: 'code',
        label: 'Code',
        icon: '◆',
        color: '#34d399',
        blurb: 'Build & edit autonomously',
        placeholder: 'Describe the change you want…',
        canMutate: true,
        systemPrompt: CODE_SYSTEM,
        statusMessages: ['Planning', 'Reading code', 'Writing code', 'Editing files', 'Verifying', 'Wrapping up'],
    },
};

export function getMode(mode: Mode): ModeInfo {
    return MODES[mode];
}
