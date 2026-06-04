import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { KobApiClient } from '../utils/api.js';
import { getConfig } from '../utils/config.js';
import { handleApiError, validateRequired } from '../utils/errors.js';
import { formatRules } from '../utils/format.js';
import type { RulesResponse, ProjectRule, RuleType } from '../types/index.js';

export const rulesCommand = new Command('rules')
    .description('Manage project rules');

// List rules
rulesCommand
    .command('list')
    .description('List all rules for a project')
    .requiredOption('--project-id <projectId>', 'Project ID')
    .action(async (opts) => {
        const spinner = ora('Fetching rules...').start();

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            validateRequired(opts.projectId, 'Project ID');

            const data = await client.get<RulesResponse>('/api/projects/rules', {
                project_id: opts.projectId,
            });

            spinner.succeed(`Found ${data.rules?.length || 0} rules`);

            if (data.rules && data.rules.length > 0) {
                console.log(formatRules(data.rules));
            } else {
                console.log(chalk.yellow('\nNo rules found for this project.'));
            }
            console.log('');
        } catch (error) {
            spinner.fail('Failed to fetch rules');
            handleApiError(error);
        }
    });

// Create rule
rulesCommand
    .command('create')
    .description('Create a new rule')
    .requiredOption('--project-id <projectId>', 'Project ID')
    .requiredOption('--text <text>', 'Rule text')
    .option('-t, --type <type>', 'Rule type (forbidden, required, custom)', 'custom')
    .action(async (opts) => {
        const spinner = ora('Creating rule...').start();

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            validateRequired(opts.projectId, 'Project ID');
            validateRequired(opts.text, 'Rule text');

            const data = await client.post<RulesResponse>('/api/projects/rules', {
                project_id: opts.projectId,
                rule_text: opts.text,
                rule_type: opts.type as RuleType,
            });

            spinner.succeed('Rule created successfully!');

            console.log(chalk.bold.cyan('\n📜 Rule Created:'));
            console.log(chalk.dim('─'.repeat(60)));
            console.log(`Type: ${chalk.bold(data.rule?.rule_type)}`);
            console.log(`Text: ${data.rule?.rule_text}`);
            console.log(`Status: ${chalk.green('Active')}`);
            console.log(`Created: ${chalk.bold(new Date(data.rule?.created_at || '').toLocaleString())}`);
            console.log('');
        } catch (error) {
            spinner.fail('Failed to create rule');
            handleApiError(error);
        }
    });

// Update rule
rulesCommand
    .command('update')
    .description('Update an existing rule')
    .argument('<ruleId>', 'Rule ID')
    .requiredOption('--project-id <projectId>', 'Project ID')
    .option('--text <text>', 'New rule text')
    .option('--type <type>', 'New rule type (forbidden, required, custom)')
    .option('--active <active>', 'Set active status (true/false)')
    .action(async (ruleId, opts) => {
        const spinner = ora('Updating rule...').start();

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            validateRequired(ruleId, 'Rule ID');
            validateRequired(opts.projectId, 'Project ID');

            const updates: any = {
                project_id: opts.projectId,
                rule_id: ruleId,
            };

            if (opts.text) updates.rule_text = opts.text;
            if (opts.type) updates.rule_type = opts.type;
            if (opts.active !== undefined) updates.is_active = opts.active === 'true';

            if (!opts.text && !opts.type && opts.active === undefined) {
                console.error(chalk.yellow('\n⚠️  Please provide at least --text, --type, or --active'));
                process.exit(1);
            }

            const data = await client.patch<RulesResponse>('/api/projects/rules', updates);

            spinner.succeed('Rule updated successfully!');

            console.log(chalk.bold.cyan('\n📜 Rule Updated:'));
            console.log(chalk.dim('─'.repeat(60)));
            console.log(`Type: ${chalk.bold(data.rule?.rule_type)}`);
            console.log(`Text: ${data.rule?.rule_text}`);
            console.log(`Status: ${data.rule?.is_active ? chalk.green('Active') : chalk.red('Inactive')}`);
            console.log(`Updated: ${chalk.bold(new Date(data.rule?.updated_at || '').toLocaleString())}`);
            console.log('');
        } catch (error) {
            spinner.fail('Failed to update rule');
            handleApiError(error);
        }
    });

// Delete rule
rulesCommand
    .command('delete')
    .description('Delete a rule')
    .argument('<ruleId>', 'Rule ID')
    .requiredOption('--project-id <projectId>', 'Project ID')
    .action(async (ruleId, opts) => {
        const spinner = ora('Deleting rule...').start();

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            validateRequired(ruleId, 'Rule ID');
            validateRequired(opts.projectId, 'Project ID');

            await client.delete<RulesResponse>('/api/projects/rules', {
                project_id: opts.projectId,
                rule_id: ruleId,
            });

            spinner.succeed('Rule deleted successfully!');
            console.log(chalk.green('\n✓ Rule has been deleted\n'));
        } catch (error) {
            spinner.fail('Failed to delete rule');
            handleApiError(error);
        }
    });
