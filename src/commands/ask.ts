import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { KobApiClient } from '../utils/api.js';
import { getConfig } from '../utils/config.js';
import { handleApiError, validateRequired } from '../utils/errors.js';

function formatV2Model(provider: string, model?: string): string {
    const m = model || 'deepseek-chat';
    return m.includes('/') ? m : `${provider.toLowerCase()}/${m}`;
}

export const askCommand = new Command('ask')
    .description('Ask a question to AI')
    .argument('<question>', 'Your question')
    .option('-p, --provider <provider>', 'AI provider (DeepSeek, OpenRouter, DeepInfra)', 'DeepSeek')
    .option('-m, --model <model>', 'Model ID')
    .option('-t, --temperature <temperature>', 'Temperature (0.0-2.0)', '0.7')
    .option('--max-tokens <maxTokens>', 'Maximum tokens', '4096')
    .option('--system-prompt <systemPrompt>', 'System prompt')
    .action(async (question, opts) => {
        const spinner = ora('Thinking...').start();

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            validateRequired(opts.provider, 'Provider');
            const model = formatV2Model(opts.provider, opts.model || config.modelId);

            let fullContent = '';
            for await (const chunk of client.chatStream(
                model,
                [{ role: 'user', content: question }],
                {
                    temperature: parseFloat(opts.temperature),
                    max_tokens: parseInt(opts.maxTokens),
                    system_prompt: opts.systemPrompt,
                }
            )) {
                const delta = chunk.choices?.[0]?.delta?.content;
                if (delta) fullContent += delta;
            }

            spinner.succeed('Answer received!');

            console.log(chalk.bold.cyan('\n💡 Answer:'));
            console.log(chalk.dim('─'.repeat(80)));
            console.log(fullContent);
            console.log('');
        } catch (error) {
            spinner.fail('Failed to get answer');
            handleApiError(error);
        }
    });
