import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { c } from './colors.js';
import { readEnvFile, writeEnvFile, describeEnvPath } from '../utils/env-file.js';

type Field = 'baseUrl' | 'apiKey' | 'modelId';

const FIELDS: { key: Field; label: string; placeholder: string; help: string; secret?: boolean }[] = [
    {
        key: 'baseUrl',
        label: 'Base URL',
        placeholder: 'https://www.kob-ai.dev',
        help: 'Endpoint root — /v1, /v2 suffixes will be stripped automatically.',
    },
    {
        key: 'apiKey',
        label: 'API Key',
        placeholder: 'kob_xxx:your_token  (or just kob_xxx)',
        help: 'Format: kob_xxx:your_token, or just kob_xxx.',
        secret: true,
    },
    {
        key: 'modelId',
        label: 'Default Model',
        placeholder: 'deepseek/deepseek-v4-flash',
        help: 'Optional. Used as the fallback model when none is specified.',
    },
];

interface Props {
    onDone: (saved: boolean) => void;
}

export function ConfigForm({ onDone }: Props) {
    const envPath = describeEnvPath();
    const initial = readEnvFile();
    const [values, setValues] = useState<Record<Field, string>>({
        baseUrl: initial.KOB_API_BASE_URL || 'https://www.kob-ai.dev',
        apiKey: initial.KOB_API_KEY || '',
        modelId: initial.KOB_MODEL_ID || '',
    });
    const [idx, setIdx] = useState<number>(0);
    const [draft, setDraft] = useState<string>('');
    const [editing, setEditing] = useState<boolean>(true);
    const [saved, setSaved] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // When field changes, seed draft with the current value
        const f = FIELDS[idx]!;
        setDraft(values[f.key]);
    }, [idx]);

    useInput((input, key) => {
        if (!editing) return;
        if (key.escape) {
            onDone(false);
            return;
        }
        if (key.return) {
            // Commit draft, advance or save
            const f = FIELDS[idx]!;
            const next = { ...values, [f.key]: draft };
            setValues(next);
            if (idx < FIELDS.length - 1) {
                setIdx(idx + 1);
            } else {
                // Save and exit
                try {
                    const updates: Record<string, string> = {};
                    const comments: Record<string, string> = {};
                    if (next.baseUrl && next.baseUrl !== initial.KOB_API_BASE_URL) {
                        updates.KOB_API_BASE_URL = next.baseUrl;
                        comments.KOB_API_BASE_URL = 'Base URL for KOB AI API';
                    }
                    if (next.apiKey && next.apiKey !== initial.KOB_API_KEY) {
                        updates.KOB_API_KEY = next.apiKey;
                        comments.KOB_API_KEY = 'Your API Key (format: kob_xxx:your_token or just kob_xxx)';
                    }
                    if (next.modelId && next.modelId !== initial.KOB_MODEL_ID) {
                        updates.KOB_MODEL_ID = next.modelId;
                        comments.KOB_MODEL_ID = 'Default AI Model ID (optional)';
                    }
                    if (Object.keys(updates).length > 0) {
                        writeEnvFile(updates, comments);
                    }
                    setSaved(true);
                    setEditing(false);
                } catch (e: any) {
                    setError(e?.message || String(e));
                }
            }
            return;
        }
        if (key.backspace || key.delete) {
            setDraft((d) => d.slice(0, -1));
            return;
        }
        if (key.tab) {
            // Optional: skip optional empty fields
            const f = FIELDS[idx]!;
            const next = { ...values, [f.key]: draft };
            setValues(next);
            setIdx((idx + 1) % FIELDS.length);
            return;
        }
        if (input && !key.ctrl && !key.meta) {
            setDraft((d) => d + input);
        }
    });

    if (saved) {
        return (
            <Box flexDirection="column" borderStyle="round" borderColor={c.green} paddingX={1} marginTop={1}>
                <Box>
                    <Text color={c.green} bold>✓ Configuration saved</Text>
                </Box>
                <Box>
                    <Text color={c.textDim}>File: </Text>
                    <Text color={c.text}>{envPath}</Text>
                </Box>
                <Box marginTop={1}>
                    <Text color={c.yellow}>↻ Restart KOB CLI to apply the new settings (env vars are loaded at startup).</Text>
                </Box>
                <Box marginTop={1}>
                    <Text color={c.textDim}>Press any key to return to the chat…</Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={c.brand}
            paddingX={1}
            marginTop={1}
        >
            <Box>
                <Text color={c.brand} bold>◆ /config</Text>
                <Text color={c.textDim}>  </Text>
                <Text color={c.text}>edit </Text>
                <Text color={c.pink} bold>{FIELDS[idx]!.label}</Text>
                <Text color={c.textDim}>  ({idx + 1}/{FIELDS.length})</Text>
                <Box flexGrow={1} />
                <Text color={c.textDim}>↵ next/save · esc cancel</Text>
            </Box>

            <Box flexDirection="column" marginTop={1}>
                {FIELDS.map((f, i) => {
                    const isActive = i === idx;
                    const showDraft = isActive ? draft : values[f.key];
                    const display = f.secret && showDraft ? '•'.repeat(Math.max(0, showDraft.length)) : (showDraft || f.placeholder);
                    const displayColor = isActive
                        ? (showDraft ? c.text : c.textDim)
                        : (values[f.key] ? c.text : c.textDim);
                    return (
                        <Box key={f.key}>
                            <Text color={isActive ? c.brand : c.textDim}>
                                {isActive ? '▶ ' : '  '}
                            </Text>
                            <Text color={isActive ? c.text : c.textMuted}>{f.label.padEnd(14)}</Text>
                            <Text color={isActive ? c.text : c.textMuted}>: </Text>
                            <Text color={displayColor} bold={isActive}>{display}</Text>
                            {isActive && <Text color={c.pink}>▌</Text>}
                        </Box>
                    );
                })}
            </Box>

            <Box marginTop={1}>
                <Text color={c.textDim}>↳ {FIELDS[idx]!.help}</Text>
            </Box>

            <Box marginTop={1}>
                <Text color={c.textDim}>File: {envPath}</Text>
            </Box>

            {error && (
                <Box marginTop={1}>
                    <Text color={c.red}>✗ {error}</Text>
                </Box>
            )}
        </Box>
    );
}
