import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { KobApiClient } from '../utils/api.js';
import { getConfig } from '../utils/config.js';
import { handleApiError } from '../utils/errors.js';
import type { UserToken } from '../types/index.js';

export const authCommand = new Command('auth')
    .description('Authentication commands');

authCommand
    .command('verify')
    .description('Verify API credentials and show user info')
    .action(async () => {
        const spinner = ora('Verifying credentials...').start();

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            const data = await client.post<UserToken>('/api/tokens/verify');

            spinner.succeed('Authentication successful!');

            console.log(chalk.bold.cyan('\n👤 User Information:'));
            console.log(chalk.dim('─'.repeat(60)));
            console.log(`Name: ${chalk.bold(data.user_name)}`);
            console.log(`Email: ${chalk.bold(data.user_email)}`);
            console.log(`Key Name: ${chalk.bold(data.key_name)}`);

            console.log(chalk.bold.cyan('\n💳 Package Information:'));
            console.log(chalk.dim('─'.repeat(60)));
            console.log(`Package: ${chalk.bold(data.package_name)}`);
            console.log(`Started: ${chalk.bold(new Date(data.package_started_at).toLocaleDateString())}`);
            console.log(`Expires: ${chalk.bold(new Date(data.package_expires_at).toLocaleDateString())}`);

            console.log(chalk.bold.cyan('\n💰 Credit Balance:'));
            console.log(chalk.dim('─'.repeat(60)));
            console.log(`Balance: ${chalk.green.bold(data.credit_balance.toString())} credits`);

            console.log(chalk.bold.cyan('\n🔗 Connection Info:'));
            console.log(chalk.dim('─'.repeat(60)));
            console.log(`IP: ${chalk.bold(data.ip)}`);
            console.log(`Connected: ${chalk.bold(new Date(data.timestamp).toLocaleString())}`);

            console.log(chalk.green('\n✅ Status: Connected and ready to use!\n'));
        } catch (error) {
            spinner.fail('Authentication failed');
            handleApiError(error);
        }
    });

export const balanceCommand = new Command('balance')
    .description('Check your credit balance')
    .action(async () => {
        const spinner = ora('Fetching balance...').start();

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            const data = await client.post<UserToken>('/api/tokens/verify');

            spinner.succeed('Balance retrieved!');

            console.log(chalk.bold.cyan('\n💰 Your Credit Balance:'));
            console.log(chalk.dim('─'.repeat(60)));
            console.log(`Balance: ${chalk.green.bold(data.credit_balance.toString())} credits`);
            console.log(`1 credit = $0.01 USD`);
            console.log(`Approximate USD value: ${chalk.bold('$' + (data.credit_balance * 0.01).toFixed(2))}`);
            console.log('');
        } catch (error) {
            spinner.fail('Failed to fetch balance');
            handleApiError(error);
        }
    });
