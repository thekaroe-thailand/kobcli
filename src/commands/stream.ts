import { Command } from 'commander';
import chalk from 'chalk';
import { KobApiClient } from '../utils/api.js';
import { getConfig } from '../utils/config.js';
import { handleApiError, validateRequired } from '../utils/errors.js';
import type { StreamEvent, ChatMessage } from '../types/index.js';

export const streamCommand = new Command('stream')
    .description('Stream AI response in real-time')
    .argument('<message>', 'Message to send to AI')
    .option('-p, --provider <provider>', 'AI provider', 'DeepSeek')
    .option('-m, --model <model>', 'Model ID', 'deepseek-chat')
    .option('-t, --temperature <temperature>', 'Temperature (0.0-2.0)', '0.7')
    .option('--project-id <projectId>', 'Project ID for rules')
    .option('--system-prompt <systemPrompt>', 'System prompt')
    .action(async (message, opts) => {
        console.log(chalk.bold.cyan('\n🌊 Streaming AI Response...'));
        console.log(chalk.dim('─'.repeat(80)));

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            validateRequired(opts.provider, 'Provider');
            validateRequired(opts.model, 'Model');

            const messages: ChatMessage[] = [
                { role: 'user', content: message }
            ];

            const body: any = {
                provider: opts.provider,
                model: opts.model,
                messages,
                temperature: parseFloat(opts.temperature),
            };

            if (opts.projectId) {
                body.project_id = opts.projectId;
            }

            if (opts.systemPrompt) {
                body.system_prompt = opts.systemPrompt;
            }

            let fullContent = '';

            for await (const event of client.stream('/api/ai/stream', body)) {
                if (event.type === 'chunk') {
                    if (event.content) {
                        process.stdout.write(event.content);
                        fullContent += event.content;
                    }
                } else if (event.type === 'done') {
                    console.log('');
                    console.log(chalk.dim('─'.repeat(80)));
                    console.log(chalk.bold.green('\n✓ Stream complete!'));
                    console.log(chalk.bold.cyan('\n📊 Usage Statistics:'));
                    console.log(`  Credits Charged: ${chalk.red(event.credits_charged?.toString() || '0')}`);
                    console.log(`  Credits Remaining: ${chalk.green(event.credits_remaining?.toString() || '0')}`);
                    if (event.usage) {
                        console.log(`  Input Tokens: ${chalk.yellow(event.usage.input_tokens.toString())}`);
                        console.log(`  Output Tokens: ${chalk.yellow(event.usage.output_tokens.toString())}`);
                        console.log(`  Total Tokens: ${chalk.yellow(event.usage.total_tokens.toString())}`);
                    }
                    console.log('');
                } else if (event.type === 'error') {
                    console.log('');
                    console.error(chalk.red(`\n❌ Error: ${event.message}`));
                    process.exit(1);
                }
            }
        } catch (error) {
            handleApiError(error);
        }
    });
