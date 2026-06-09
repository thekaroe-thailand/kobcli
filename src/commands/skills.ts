import { Command } from 'commander';
import chalk from 'chalk';

interface Skill {
    name: string;
    icon: string;
    description: string;
    example: string;
}

const skills: Skill[] = [
    { name: 'ask', icon: '💡', description: 'Ask questions and get answers from AI', example: 'kob ask "What is TypeScript?"' },
    { name: 'code', icon: '💻', description: 'Generate code in any language', example: 'kob code "Write a REST API in Python" --lang python' },
    { name: 'chat', icon: '💬', description: 'Send messages to AI', example: 'kob chat "Hello"' },
    { name: 'chat:interactive', icon: '🔄', description: 'Interactive conversation mode', example: 'kob chat:interactive' },
    { name: 'stream', icon: '🌊', description: 'Real-time streaming AI responses', example: 'kob stream "Tell me a story"' },
    { name: 'auth:verify', icon: '🔐', description: 'Verify API connection and credentials', example: 'kob auth:verify' },
    { name: 'balance', icon: '💰', description: 'Check credit balance', example: 'kob balance' },
    { name: 'models', icon: '🤖', description: 'Browse available AI models', example: 'kob models --provider DeepSeek' },
];

export const skillsCommand = new Command('skills')
    .description('List all available KOB CLI skills')
    .action(() => {
        console.log(chalk.bold.cyan('\n🧠 KOB CLI Skills'));
        console.log(chalk.dim('─'.repeat(60)));

        skills.forEach((skill) => {
            console.log(`\n  ${skill.icon}  ${chalk.bold(skill.name)}`);
            console.log(`     ${skill.description}`);
            console.log(`     ${chalk.dim(skill.example)}`);
        });

        console.log(chalk.dim('\n💡 Use: kob <skill> --help  for detailed options'));
        console.log('');
    });
