import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { KobApiClient } from '../utils/api.js';
import { getConfig } from '../utils/config.js';
import { handleApiError } from '../utils/errors.js';
import type { UserToken } from '../types/index.js';

const brand = chalk.hex('#38bdf8');
const green = chalk.hex('#34d399');
const dim = chalk.dim;
const accent = chalk.hex('#a78bfa');

export const authVerifyCommand = new Command('auth:verify')
    .description('Verify API connection')
    .action(async () => {
        const spinner = ora({
            text: `${accent('Authenticating')}  ${dim('·')}  ${dim('connecting to API')}`,
            color: 'cyan',
            spinner: 'dots12',
        }).start();

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            const data = await client.post<UserToken>('/api/tokens/verify');

            spinner.stop();
            process.stdout.write('\x1B[?25l');

            console.log(`  ${green('✔')}  ${green.bold('Connected')}  ${dim('·')}  ${brand(config.baseUrl)}${' '.repeat(20)}\n`);
            console.log(`  ${dim('┌─ Connection ' + '─'.repeat(38) + '┐')}`);
            console.log(`  ${dim('│')}  ${dim('User')}  ${chalk.bold(data.user_name)}  ${dim('·')}  ${dim(data.key_name)}`);
            console.log(`  ${dim('│')}  ${dim('API')}   ${brand(config.baseUrl)}`);
            console.log(`  ${dim('└' + '─'.repeat(48) + '┘')}\n`);
            process.stdout.write('\x1B[?25h');
        } catch (error) {
            process.stdout.write('\x1B[?25h');
            spinner.fail('Connection failed');
            handleApiError(error);
        }
    });

export const balanceCommand = new Command('balance')
    .description('Check your credit balance')
    .action(async () => {
        const spinner = ora({
            text: `${accent('Fetching balance')}  ${dim('·')}  ${dim('checking credits')}`,
            color: 'cyan',
            spinner: 'dots12',
        }).start();

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            const data = await client.post<UserToken>('/api/tokens/verify');

            spinner.stop();
            process.stdout.write('\x1B[?25l');

            console.log(`  ${green('✔')}  ${green.bold('Balance')}  ${dim('·')}  ${brand('credits available')}${' '.repeat(20)}\n`);
            console.log(`  ${green.bold(data.credit_balance.toFixed(1))}  ${dim('credits')}`);
            console.log(`  ${dim('≈ $' + (data.credit_balance * 0.01).toFixed(2) + ' USD')}\n`);
            process.stdout.write('\x1B[?25h');
        } catch (error) {
            process.stdout.write('\x1B[?25h');
            spinner.fail('Failed to fetch balance');
            handleApiError(error);
        }
    });
