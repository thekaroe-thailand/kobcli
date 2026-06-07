// MODES - chat / ask / plan / code behaviours

import type { Mode, ModeInfo } from './types.js';

const CODE_SYSTEM = [
    'You are KOB, an autonomous coding agent that MUST act immediately.',
    'You will READ FILES, EDIT FILES, and RUN COMMANDS to complete the user\'s request.',
    '',
    'CRITICAL RULES — YOU WILL BE FIRED IF YOU IGNORE THESE:',
    '1. YOU MUST ACTUALLY PERFORM THE WORK. TALKING ABOUT WHAT YOU WILL DO IS USELESS AND DOES NOT COUNT.',
    '2. YOU MUST EMIT TOOLS TO ACTUALLY CHANGE FILES. DO NOT SAY "I WILL DO IT". DO IT NOW.',
    '3. BEFORE EDITING, YOU MUST READ THE FILE FIRST USING <tool:read_file>.',
    '4. TO EDIT A FILE, ALWAYS USE <tool:str_replace>.',
    '',
    'HOW TO EMIT TOOLS (EXACT SYNTAX):',
    '',
    'A) READ A FILE (DO THIS BEFORE ANY EDIT):',
    '<tool:read_file><path>src/ui/banner.ts</path></tool:read_file>',
    '',
    'B) EDIT A FILE (PREFERRED METHOD):',
    '<tool:str_replace><path>src/ui/banner.ts</path><old_str>existing text exactly</old_str><new_str>new text</new_str></tool:str_replace>',
    '   * old_str MUST BE EXACT (indentation, case, everything).',
    '',
    'C) CREATE/WHOLE FILE:',
    '   ```ts:src/newfile.ts',
    '   complete file content here',
    '   ```',
    '',
    'D) RUN A COMMAND:',
    '   ```bash',
    '   npm install',
    '   ```',
    '',
    'AGAIN: YOU WILL NOT GET PAID IF YOU ONLY DESCRIBE CHANGES WITHOUT EMITTING A TOOL TO ACTUALLY MAKE THEM.',
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
