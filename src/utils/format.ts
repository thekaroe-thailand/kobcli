import chalk from 'chalk';
import type { Project, ProjectRule, CreditHistoryItem, CreditStatus } from '../types/index.js';

// Format date to readable string
export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// Format credit status with color
export function formatCreditStatus(status: CreditStatus): string {
    const statusMap: Record<CreditStatus, { icon: string; color: string }> = {
        completed: { icon: '✓', color: 'green' },
        pending: { icon: '⏳', color: 'yellow' },
        failed: { icon: '✗', color: 'red' },
        refunded: { icon: '↩', color: 'gray' },
    };

    const { icon, color } = statusMap[status];
    return (chalk as any)[color](`${icon} ${status}`);
}

// Format project list as table
export function formatProjects(projects: Project[]): string {
    if (projects.length === 0) {
        return chalk.yellow('No projects found');
    }

    const lines: string[] = [];
    lines.push(chalk.bold.cyan('\n📁 Your Projects:'));
    lines.push(chalk.dim('─'.repeat(80)));

    projects.forEach((project, index) => {
        lines.push(chalk.bold(`${index + 1}. ${project.project_name}`));
        lines.push(`   ID: ${chalk.dim(project.id)}`);
        if (project.description) {
            lines.push(`   Description: ${project.description}`);
        }
        lines.push(`   Created: ${formatDate(project.created_at)}`);
        lines.push('');
    });

    return lines.join('\n');
}

// Format rules list
export function formatRules(rules: ProjectRule[]): string {
    if (rules.length === 0) {
        return chalk.yellow('No rules found');
    }

    const lines: string[] = [];
    lines.push(chalk.bold.cyan('\n📜 Project Rules:'));
    lines.push(chalk.dim('─'.repeat(80)));

    const typeIcons: Record<string, string> = {
        forbidden: '🚫',
        required: '✅',
        custom: '📌',
    };

    rules.forEach((rule, index) => {
        const icon = typeIcons[rule.rule_type] || '📌';
        const status = rule.is_active ? chalk.green('Active') : chalk.red('Inactive');
        lines.push(chalk.bold(`${index + 1}. ${icon} ${rule.rule_type.toUpperCase()}`));
        lines.push(`   ${rule.rule_text}`);
        lines.push(`   Status: ${status}`);
        lines.push(`   Created: ${formatDate(rule.created_at)}`);
        lines.push('');
    });

    return lines.join('\n');
}

// Format credit history
export function formatCreditHistory(items: CreditHistoryItem[], totalItems: number, totalCredits: number): string {
    if (items.length === 0) {
        return chalk.yellow('No credit history found');
    }

    const lines: string[] = [];
    lines.push(chalk.bold.cyan('\n💰 Credit History:'));
    lines.push(chalk.bold(`Total Credits Added: ${chalk.green(totalCredits.toString())}`));
    lines.push(chalk.bold(`Total Transactions: ${totalItems.toString()}`));
    lines.push(chalk.dim('─'.repeat(80)));

    items.forEach((item, index) => {
        lines.push(chalk.bold(`${index + 1}. ${item.amount} credits`));
        lines.push(`   Status: ${formatCreditStatus(item.status)}`);
        lines.push(`   Method: ${item.payment_method} (${item.payment_channel})`);
        if (item.note) {
            lines.push(`   Note: ${item.note}`);
        }
        lines.push(`   Date: ${formatDate(item.created_at)}`);
        lines.push('');
    });

    return lines.join('\n');
}

// Format usage statistics
export function formatUsage(usage: any, creditBalance: number): string {
    const lines: string[] = [];
    lines.push(chalk.dim('─'.repeat(80)));
    lines.push(chalk.bold.cyan('📊 Usage Statistics:'));
    lines.push(`   Input Tokens: ${chalk.yellow(usage.input_tokens?.toString() || '0')}`);
    lines.push(`   Output Tokens: ${chalk.yellow(usage.output_tokens?.toString() || '0')}`);
    lines.push(`   Total Tokens: ${chalk.yellow(usage.total_tokens?.toString() || '0')}`);
    lines.push(`   Cost: $${chalk.yellow((usage.cost_usd || 0).toFixed(6))}`);
    lines.push(`   Credits Used: ${chalk.red(usage.credits_used?.toString() || '0')}`);
    lines.push(`   Credits Remaining: ${chalk.green(creditBalance.toString())}`);
    return lines.join('\n');
}
