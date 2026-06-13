#!/usr/bin/env bun
// ════════════════════════════════════════════════════════════
//  KOB CLI v2 — entry point
//  Made in Thailand · www.kob-ai.dev
// ════════════════════════════════════════════════════════════

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runRepl } from './repl.js';
import { loadEnv, getConfig } from './core/config.js';
import { KobApiClient } from './core/api.js';
import { handleSubmit, createInitialState, formatModel } from './core/engine.js';
import { editConfig } from './ui/prompts.js';
import { renderMarkdown } from './ui/markdown.js';
import { errorBox, banner } from './ui/render.js';
import { runUpgrade } from './core/upgrade.js';
import { C } from './ui/theme.js';
import chalk from 'chalk';

function readVersion(): string {
    try {
        const dir = dirname(fileURLToPath(import.meta.url));
        for (const p of [join(dir, '..', 'package.json'), join(dir, 'package.json'), join(process.cwd(), 'package.json')]) {
            try { const v = JSON.parse(readFileSync(p, 'utf-8')).version; if (v) return v; } catch { /* next */ }
        }
    } catch { /* */ }
    return '2.0.0';
}

const VERSION = readVersion();

process.on('uncaughtException', (e) => { console.error('\n  fatal:', e.message); process.exit(1); });
process.on('unhandledRejection', (e: any) => { console.error('\n  fatal:', e?.message || String(e)); process.exit(1); });

const program = new Command();
program
    .name('kob')
    .description('KOB CLI v2 — a beautiful, fully agentic AI coding assistant. Made in Thailand.')
    .version(VERSION, '-v, --version', 'show version');

program
    .command('models')
    .description('List available AI models')
    .action(async () => {
        loadEnv();
        const cfg = getConfig();
        if (!cfg) process.exit(1);
        try {
            const models = await new KobApiClient(cfg).listModels();
            console.log('');
            console.log('  ' + chalk.bold(`${models.length} models available`));
            for (const m of models) {
                const price = m.inputPricePer1M != null ? chalk.dim(`  $${m.inputPricePer1M}/$${m.outputPricePer1M ?? '?'} per 1M`) : '';
                console.log('    ' + chalk.hex(C.green)(m.id) + (m.display_name || m.displayName ? chalk.dim('  ' + (m.display_name || m.displayName)) : '') + price);
            }
            console.log('');
        } catch (e) { errorBox((e as Error).message); process.exit(1); }
    });

program
    .command('ask <prompt...>')
    .description('Ask a one-off question (non-interactive)')
    .option('-m, --model <model>', 'model id')
    .action(async (promptParts: string[], opts: { model?: string }) => {
        loadEnv();
        const cfg = getConfig();
        if (!cfg) process.exit(1);
        const state = createInitialState(cfg);
        state.mode = 'ask';
        if (opts.model) state.model = formatModel(opts.model);
        const res = await handleSubmit(state, promptParts.join(' '), {});
        if (res.error && res.state === state) { errorBox(res.error); process.exit(1); }
        const last = res.state.exchanges[res.state.exchanges.length - 1];
        if (last) console.log('\n' + renderMarkdown(last.output) + '\n');
    });

program
    .command('config')
    .description('Edit global configuration (~/.kob-cli/config.env)')
    .action(async () => {
        loadEnv();
        banner('KOB CLI configuration', C.cyan);
        await editConfig();
        banner('Saved', C.green);
    });

program
    .command('upgrade')
    .description('Update KOB CLI to the latest version')
    .action(async () => {
        const r = await runUpgrade();
        if (r.visibleOutput.length > 0) {
            console.log(r.visibleOutput.map((line) => '  ' + line).join('\n'));
        }
        if (r.ok) {
            const ver = r.fromVersion && r.fromVersion !== '?' ? ` (v${r.fromVersion} → v${r.toVersion})` : '';
            console.log(chalk.hex(C.green)(`\n  Successfully upgraded!${ver}`));
        } else {
            console.log(chalk.hex(C.red)('\n  Upgrade failed.'));
            process.exitCode = r.exitCode || 1;
        }
    });

program
    .command('chat', { isDefault: true })
    .description('Launch the interactive TUI (default)')
    .action(async () => { await runRepl(VERSION); });

program.parseAsync(process.argv);
