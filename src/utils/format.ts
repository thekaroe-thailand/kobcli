import chalk from 'chalk';

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
