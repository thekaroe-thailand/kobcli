import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { KobApiClient } from '../utils/api.js';
import { getConfig } from '../utils/config.js';
import type { ModelsResponse, ProviderModels, AIModel } from '../types/index.js';
import { c } from './colors.js';

interface FlatModel extends AIModel {
    provider: string;
}

interface Props {
    onSelect: (modelId: string, displayName: string) => void;
    onClose: () => void;
    currentModel?: string;
}

export function ModelPicker({ onSelect, onClose, currentModel }: Props) {
    const [providers, setProviders] = useState<ProviderModels[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(0);
    const listAreaHeight = 12;
    const { exit } = useApp();

    useEffect(() => {
        let alive = true;
        const client = new KobApiClient(getConfig());
        client
            .post<ModelsResponse>('/api/models')
            .then((data) => {
                if (!alive) return;
                setProviders(data.providers || []);
                setLoading(false);
            })
            .catch((e) => {
                if (!alive) return;
                setError(e?.message || 'Failed to load models');
                setLoading(false);
            });
        return () => {
            alive = false;
        };
    }, []);

    const flat: FlatModel[] = useMemo(() => {
        const out: FlatModel[] = [];
        for (const p of providers) {
            for (const m of p.models) {
                out.push({ ...m, provider: p.provider });
            }
        }
        return out;
    }, [providers]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return flat;
        return flat.filter(
            (m) =>
                m.displayName.toLowerCase().includes(q) ||
                m.modelId.toLowerCase().includes(q) ||
                m.provider.toLowerCase().includes(q)
        );
    }, [flat, query]);

    // Keep selection in bounds
    useEffect(() => {
        if (selected >= filtered.length) setSelected(Math.max(0, filtered.length - 1));
    }, [filtered.length, selected]);

    useInput((input, key) => {
        if (key.escape) {
            onClose();
            return;
        }
        if (loading || error) return;
        if (key.return) {
            const m = filtered[selected];
            if (m) {
                onSelect(m.modelId, m.displayName);
            }
            return;
        }
        if (key.downArrow) {
            setSelected((s) => Math.min(filtered.length - 1, s + 1));
            return;
        }
        if (key.upArrow) {
            setSelected((s) => Math.max(0, s - 1));
            return;
        }
        if (key.pageDown) {
            setSelected((s) => Math.min(filtered.length - 1, s + listAreaHeight));
            return;
        }
        if (key.pageUp) {
            setSelected((s) => Math.max(0, s - listAreaHeight));
            return;
        }
        if (key.backspace || key.delete) {
            setQuery((q) => q.slice(0, -1));
            setSelected(0);
            return;
        }
        // Plain character → append to query
        if (input && !key.ctrl && !key.meta && !key.tab) {
            setQuery((q) => q + input);
            setSelected(0);
        }
    });

    const total = filtered.length;
    const start = Math.max(0, Math.min(selected - Math.floor(listAreaHeight / 2), Math.max(0, total - listAreaHeight)));
    const end = Math.min(total, start + listAreaHeight);
    const visible = filtered.slice(start, end);

    return (
        <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={c.brand}
            paddingX={1}
            marginTop={1}
        >
            <Box>
                <Text color={c.brand} bold>◆ /models</Text>
                <Text color={c.textDim}>  </Text>
                <Text color={c.text}>search: </Text>
                <Text color={c.text} bold>{query || '​'}</Text>
                <Text color={c.pink}>{loading ? '  ⋯ loading' : `  ${total} match${total === 1 ? '' : 'es'}`}</Text>
                <Box flexGrow={1} />
                <Text color={c.textDim}>↑↓ move · type to search · ↵ pick · esc close</Text>
            </Box>

            <Box flexDirection="column" marginTop={1}>
                {error && (
                    <Text color={c.red}>✗ {error}</Text>
                )}
                {!error && loading && (
                    <Text color={c.textDim}>Fetching model catalog…</Text>
                )}
                {!error && !loading && total === 0 && (
                    <Text color={c.yellow}>No models match "{query}".</Text>
                )}
                {!error && !loading && total > 0 && (
                    <>
                        {visible.map((m, i) => {
                            const absoluteIdx = start + i;
                            const isSel = absoluteIdx === selected;
                            const isCurrent = currentModel && m.modelId === currentModel;
                            const provider = m.provider.padEnd(10).slice(0, 10);
                            const price = `$${m.inputPricePer1M.toFixed(2)}/$${m.outputPricePer1M.toFixed(2)}/M`;
                            return (
                                <Box key={`${m.provider}-${m.modelId}`}>
                                    <Text color={isSel ? c.brand : c.textDim}>{isSel ? '▶ ' : '  '}</Text>
                                    <Text color={isSel ? c.text : c.text} bold={isSel}>
                                        {m.displayName}
                                    </Text>
                                    {isCurrent && <Text color={c.green}>  ●current</Text>}
                                    <Text color={c.textDim}>  </Text>
                                    <Text color={c.textMuted}>{provider}</Text>
                                    <Text color={c.textDim}>  </Text>
                                    <Text color={c.yellow}>{price}</Text>
                                    <Text color={c.textDim}>  </Text>
                                    <Text color={c.textMuted}>{m.modelId}</Text>
                                </Box>
                            );
                        })}
                        {total > listAreaHeight && (
                            <Box marginTop={1}>
                                <Text color={c.textDim}>
                                    {start + 1}–{end} of {total}
                                </Text>
                            </Box>
                        )}
                    </>
                )}
            </Box>
        </Box>
    );
}
