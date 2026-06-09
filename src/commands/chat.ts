import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { KobApiClient } from '../utils/api.js';
import { getConfig } from '../utils/config.js';
import { handleApiError, validateRequired } from '../utils/errors.js';

function formatV2Model(provider: string, model: string): string {
    const m = model || 'deepseek-chat';
    return m.includes('/') ? m : `${provider.toLowerCase()}/${m}`;
}

export const chatCommand = new Command('chat')
    .description('Send a message to AI')
    .argument('<message>', 'Message to send to AI')
    .option('-p, --provider <provider>', 'AI provider (DeepSeek, OpenRouter, DeepInfra)', 'DeepSeek')
    .option('-m, --model <model>', 'Model ID')
    .option('-t, --temperature <temperature>', 'Temperature (0.0-2.0)', '0.7')
    .option('--max-tokens <maxTokens>', 'Maximum tokens', '4096')
    .option('--system-prompt <systemPrompt>', 'System prompt')
    .action(async (message, opts) => {
        const spinner = ora('Thinking...').start();

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
                    max_tokens: parseInt(opts.maxTokens),
                    system_prompt: opts.systemPrompt,
                }
            )) {
                const delta = chunk.choices?.[0]?.delta?.content;
                if (delta) fullContent += delta;
            }

            spinner.succeed('Response received!');

            console.log(chalk.bold.cyan('\n💬 AI Response:'));
            console.log(chalk.dim('─'.repeat(80)));
            console.log(fullContent);
            console.log('');
        } catch (error) {
            spinner.fail('Failed to get response');
            handleApiError(error);
        }
    });

export const chatInteractiveCommand = new Command('chat:interactive')
    .description('Interactive chat mode with AI')
    .option('-p, --provider <provider>', 'AI provider (DeepSeek, OpenRouter, DeepInfra)', 'DeepSeek')
    .option('-m, --model <model>', 'Model ID')
    .option('-t, --temperature <temperature>', 'Temperature (0.0-2.0)', '0.7')
    .option('--system-prompt <systemPrompt>', 'System prompt')
    .action(async (opts) => {
        console.log(chalk.bold.cyan('\n🤖 KOB AI Interactive Chat'));
        console.log(chalk.dim('─'.repeat(60)));
        console.log(chalk.yellow('Type your message and press Enter'));
        console.log(chalk.yellow('Commands: /clear, /stats, /help, /exit'));
        console.log(chalk.dim('─'.repeat(60)));
        console.log('');

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            const model = formatV2Model(opts.provider, opts.model || config.modelId);
            const messages: { role: string; content: string }[] = [];
            let totalTokens = 0;
            let totalCredits = 0;

            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            rl.on('SIGINT', () => {
                console.log(chalk.yellow('\nGoodbye!'));
                rl.close();
                process.exit(0);
            });

            const askQuestion = () => {
                rl.question(chalk.green('\nYou: '), async (userInput: string) => {
                    const input = userInput.trim();

                    if (!input) { askQuestion(); return; }

                    if (input === '/exit' || input === '/quit') {
                        console.log(chalk.yellow('\nGoodbye!')); rl.close(); process.exit(0);
                    }
                    if (input === '/help') {
                        console.log(chalk.cyan('\n📖 Commands:\n  /clear - Clear history\n  /stats - Show statistics\n  /exit - Exit\n'));
                        askQuestion(); return;
                    }
                    if (input === '/clear') {
                        messages.length = 0; totalTokens = 0; totalCredits = 0;
                        console.log(chalk.green('\n✓ Conversation cleared'));
                        askQuestion(); return;
                    }
                    if (input === '/stats') {
                        console.log(chalk.cyan(`\n📊 Stats: ${messages.length} msgs, ${totalTokens} tokens, ${totalCredits} credits\n`));
                        askQuestion(); return;
                    }

                    messages.push({ role: 'user', content: input });
                    const spinner = ora('Thinking...').start();

                    try {
                        let fullContent = '';
                        for await (const chunk of client.chatStream(model, messages, {
                            temperature: parseFloat(opts.temperature),
                            system_prompt: opts.systemPrompt,
                        })) {
                            const delta = chunk.choices?.[0]?.delta?.content;
                            if (delta) fullContent += delta;
                        }

                        spinner.stop();
                        messages.push({ role: 'assistant', content: fullContent });
                        console.log(chalk.bold.cyan('\nAI:'));
                        console.log(fullContent);
                        console.log('');
                        askQuestion();
                    } catch (error) {
                        spinner.fail('Failed to get response');
                        handleApiError(error);
                        askQuestion();
                    }
                });
            };

            askQuestion();
        } catch (error) {
            handleApiError(error);
        }
    });
