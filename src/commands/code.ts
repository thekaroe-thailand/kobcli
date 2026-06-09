import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { KobApiClient } from '../utils/api.js';
import { getConfig } from '../utils/config.js';
import { handleApiError, validateRequired } from '../utils/errors.js';
import { runCodeTui, writeFiles, parseFileChanges } from '../ui/code-tui.js';

function formatV2Model(provider: string, model?: string): string {
    const m = model || 'deepseek-chat';
    return m.includes('/') ? m : `${provider.toLowerCase()}/${m}`;
}

export const codeCommand = new Command('code')
    .description('Generate code with AI (TUI mode if no args)')
    .argument('[prompt]', 'Code description or request')
    .option('-p, --provider <provider>', 'AI provider (DeepSeek, OpenRouter, DeepInfra)', 'DeepSeek')
    .option('-m, --model <model>', 'Model ID')
    .option('-t, --temperature <temperature>', 'Temperature (0.0-1.0)', '0.3')
    .option('--max-tokens <maxTokens>', 'Maximum tokens', '8192')
    .option('--lang <language>', 'Programming language')
    .option('--system-prompt <systemPrompt>', 'Additional system prompt')
    .action(async (prompt, opts) => {
        if (!prompt) {
            await runCodeTui();
            return;
        }

        const spinner = ora('Generating code...').start();

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            validateRequired(opts.provider, 'Provider');
            const model = formatV2Model(opts.provider, opts.model || config.modelId);

            const langHint = opts.lang ? ` in ${opts.lang}` : '';
            const systemPrompt = opts.systemPrompt
                ? opts.systemPrompt
                : `You are an expert programmer. Generate clean, production-ready code${langHint}. Provide code with brief explanations. Use proper syntax, error handling, and comments where needed.`;

            let fullContent = '';
            for await (const chunk of client.chatStream(
                model,
                [{ role: 'user', content: prompt }],
                {
                    temperature: parseFloat(opts.temperature),
                    max_tokens: parseInt(opts.maxTokens),
                    system_prompt: systemPrompt,
                }
            )) {
                const delta = chunk.choices?.[0]?.delta?.content;
                if (delta) fullContent += delta;
            }

            spinner.succeed('Code generated!');

            const files = parseFileChanges(fullContent);
            const created = writeFiles(files);

            if (created.length > 0) {
                console.log(chalk.bold.green('\n✅ Files created:'));
                for (const f of created) {
                    console.log(`  ${chalk.green('✓')} ${chalk.bold(f)}`);
                }
                console.log('');
            }

            console.log(chalk.bold.green('\n💻 Generated Code:'));
            console.log(chalk.dim('─'.repeat(80)));
            console.log(fullContent);
            console.log('');
        } catch (error) {
            spinner.fail('Failed to generate code');
            handleApiError(error);
        }
    });
