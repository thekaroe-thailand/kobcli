import { Command } from 'commander';
import chalk from 'chalk';
import { KobApiClient } from '../utils/api.js';
import { getConfig } from '../utils/config.js';
import { handleApiError, validateRequired } from '../utils/errors.js';

function formatV2Model(provider: string, model?: string): string {
    const m = model || 'deepseek-chat';
    return m.includes('/') ? m : `${provider.toLowerCase()}/${m}`;
}

export const streamCommand = new Command('stream')
    .description('Stream AI response in real-time')
    .argument('<message>', 'Message to send to AI')
    .option('-p, --provider <provider>', 'AI provider', 'DeepSeek')
    .option('-m, --model <model>', 'Model ID')
    .option('-t, --temperature <temperature>', 'Temperature (0.0-2.0)', '0.7')
    .option('--system-prompt <systemPrompt>', 'System prompt')
    .action(async (message, opts) => {
        console.log(chalk.bold.cyan('\n🌊 Streaming AI Response...'));
        console.log(chalk.dim('─'.repeat(80)));

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            validateRequired(opts.provider, 'Provider');
            const model = formatV2Model(opts.provider, opts.model || config.modelId);

            let fullContent = '';
            for await (const chunk of client.chatStream(
                model,
                [{ role: 'user', content: message }],
                {
                    temperature: parseFloat(opts.temperature),
                    system_prompt: opts.systemPrompt,
                }
            )) {
                const delta = chunk.choices?.[0]?.delta?.content;
                if (delta) {
                    process.stdout.write(delta);
                    fullContent += delta;
                }
            }

            console.log('');
            console.log(chalk.dim('─'.repeat(80)));
            console.log(chalk.bold.green('\n✓ Stream complete!'));
            console.log('');
        } catch (error) {
            handleApiError(error);
        }
    });
