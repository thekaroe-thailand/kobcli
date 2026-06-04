import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { KobApiClient } from '../utils/api.js';
import { getConfig } from '../utils/config.js';
import { handleApiError, validateRequired } from '../utils/errors.js';
import { formatUsage } from '../utils/format.js';
import type { ChatResponse, ChatMessage } from '../types/index.js';

export const chatCommand = new Command('chat')
    .description('Send a message to AI')
    .argument('<message>', 'Message to send to AI')
    .option('-p, --provider <provider>', 'AI provider (DeepSeek, OpenRouter, DeepInfra)', 'DeepSeek')
    .option('-m, --model <model>', 'Model ID', 'deepseek-chat')
    .option('-t, --temperature <temperature>', 'Temperature (0.0-2.0)', '0.7')
    .option('--max-tokens <maxTokens>', 'Maximum tokens', '4096')
    .option('--project-id <projectId>', 'Project ID for rules')
    .option('--system-prompt <systemPrompt>', 'System prompt')
    .action(async (message, opts) => {
        const spinner = ora('Sending message to AI...').start();

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
                max_tokens: parseInt(opts.maxTokens),
            };

            if (opts.projectId) {
                body.project_id = opts.projectId;
            }

            if (opts.systemPrompt) {
                body.system_prompt = opts.systemPrompt;
            }

            const data = await client.post<ChatResponse>('/api/ai/chat', body);

            spinner.succeed('AI response received!');

            console.log(chalk.bold.cyan('\n💬 AI Response:'));
            console.log(chalk.dim('─'.repeat(80)));
            console.log(data.content);
            console.log('');

            console.log(formatUsage(data.usage, data.credit_balance));
            console.log('');
        } catch (error) {
            spinner.fail('Failed to get AI response');
            handleApiError(error);
        }
    });

export const chatInteractiveCommand = new Command('chat:interactive')
    .description('Interactive chat mode with AI')
    .option('-p, --provider <provider>', 'AI provider (DeepSeek, OpenRouter, DeepInfra)', 'DeepSeek')
    .option('-m, --model <model>', 'Model ID', 'deepseek-chat')
    .option('-t, --temperature <temperature>', 'Temperature (0.0-2.0)', '0.7')
    .option('--project-id <projectId>', 'Project ID for rules')
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

            const messages: ChatMessage[] = [];
            let totalTokens = 0;
            let totalCredits = 0;

            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            const askQuestion = () => {
                rl.question(chalk.green('\nYou: '), async (userInput: string) => {
                    const input = userInput.trim();

                    if (!input) {
                        askQuestion();
                        return;
                    }

                    // Handle commands
                    if (input === '/exit' || input === '/quit') {
                        console.log(chalk.yellow('\nGoodbye!'));
                        rl.close();
                        process.exit(0);
                    }

                    if (input === '/help') {
                        console.log(chalk.cyan('\n📖 Commands:'));
                        console.log('  /clear - Clear conversation history');
                        console.log('  /stats - Show conversation statistics');
                        console.log('  /exit - Exit chat mode');
                        console.log('');
                        askQuestion();
                        return;
                    }

                    if (input === '/clear') {
                        messages.length = 0;
                        totalTokens = 0;
                        totalCredits = 0;
                        console.log(chalk.green('\n✓ Conversation cleared'));
                        askQuestion();
                        return;
                    }

                    if (input === '/stats') {
                        console.log(chalk.cyan('\n📊 Conversation Statistics:'));
                        console.log(`  Messages: ${messages.length}`);
                        console.log(`  Total Tokens: ${totalTokens}`);
                        console.log(`  Total Credits Used: ${totalCredits}`);
                        console.log('');
                        askQuestion();
                        return;
                    }

                    // Add user message
                    messages.push({ role: 'user', content: input });

                    const spinner = ora('AI is thinking...').start();

                    try {
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

                        const data = await client.post<ChatResponse>('/api/ai/chat', body);

                        spinner.stop();

                        // Add assistant message
                        messages.push({ role: 'assistant', content: data.content });
                        totalTokens += data.usage.total_tokens;
                        totalCredits += data.usage.credits_used;

                        console.log(chalk.bold.cyan('\nAI:'));
                        console.log(data.content);
                        console.log(chalk.dim(`\n[Used ${data.usage.credits_used} credits, ${data.credit_balance} remaining]`));

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
