import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { KobApiClient } from '../utils/api.js';
import { getConfig } from '../utils/config.js';
import { handleApiError } from '../utils/errors.js';
import type { ModelsResponse, ProviderModels, AIModel } from '../types/index.js';

export const modelsCommand = new Command('models')
    .description('List available AI models')
    .option('-p, --provider <provider>', 'Filter by provider name')
    .option('-f, --format <format>', 'Output format (table|json)', 'table')
    .action(async (opts) => {
        const spinner = ora('Fetching available models...').start();

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            const data = await client.post<ModelsResponse>('/api/models');

            spinner.succeed(`Found ${data.model_count} models across ${data.provider_count} providers`);

            let providers = data.providers;

            // Filter by provider if specified
            if (opts.provider) {
                providers = providers.filter(p =>
                    p.provider.toLowerCase().includes(opts.provider.toLowerCase())
                );

                if (providers.length === 0) {
                    console.log(chalk.yellow(`\nNo providers found matching "${opts.provider}"`));
                    return;
                }
            }

            if (opts.format === 'json') {
                console.log(JSON.stringify(providers, null, 2));
                return;
            }

            // Display as formatted table
            console.log(chalk.bold.cyan(`\n🤖 Available AI Models (${data.model_count} total)`));
            console.log('');

            providers.forEach((provider: ProviderModels) => {
                console.log(chalk.bold.blue(`\n📦 ${provider.provider} (${provider.models.length} models)`));
                console.log(chalk.dim('─'.repeat(100)));

                provider.models.forEach((model: AIModel, index: number) => {
                    console.log(chalk.bold(`  ${index + 1}. ${model.displayName}`));
                    console.log(`     Model ID: ${chalk.cyan(model.modelId)}`);
                    console.log(`     Input: ${chalk.yellow('$' + model.inputPricePer1M.toFixed(2))}/1M tokens`);
                    console.log(`     Output: ${chalk.yellow('$' + model.outputPricePer1M.toFixed(2))}/1M tokens`);
                    console.log('');
                });
            });

            console.log(chalk.dim('\n💡 Use --provider to filter by specific provider'));
            console.log(chalk.dim('💡 Use --format json for JSON output\n'));
        } catch (error) {
            spinner.fail('Failed to fetch models');
            handleApiError(error);
        }
    });
