import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { KobApiClient } from '../utils/api.js';
import { getConfig } from '../utils/config.js';
import { handleApiError } from '../utils/errors.js';
import { formatCreditHistory } from '../utils/format.js';
import type { CreditHistoryResponse } from '../types/index.js';

export const creditsCommand = new Command('credits')
    .description('View credit history');

creditsCommand
    .command('history')
    .description('View your credit top-up history')
    .option('-l, --limit <limit>', 'Number of items to retrieve', '20')
    .option('-o, --offset <offset>', 'Number of items to skip', '0')
    .action(async (opts) => {
        const spinner = ora('Fetching credit history...').start();

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            const data = await client.post<CreditHistoryResponse>('/api/credits/history', {
                limit: parseInt(opts.limit),
                offset: parseInt(opts.offset),
            });

            spinner.succeed(`Found ${data.data.total_items} transactions`);

            if (data.data.items && data.data.items.length > 0) {
                console.log(
                    formatCreditHistory(
                        data.data.items,
                        data.data.total_items,
                        data.data.total_credits_added
                    )
                );

                // Show pagination info
                const shown = data.data.items.length;
                const total = data.data.total_items;
                if (shown < total) {
                    console.log(chalk.dim(`\nShowing ${shown} of ${total} items. Use --offset to view more.`));
                }
            } else {
                console.log(chalk.yellow('\nNo credit history found.'));
            }
            console.log('');
        } catch (error) {
            spinner.fail('Failed to fetch credit history');
            handleApiError(error);
        }
    });
