#!/usr/bin/env bun

import { Command } from 'commander';
import chalk from 'chalk';
import { authVerifyCommand, balanceCommand } from './commands/auth.js';
import { modelsCommand } from './commands/models.js';
import { chatCommand, chatInteractiveCommand } from './commands/chat.js';
import { streamCommand } from './commands/stream.js';
import { askCommand } from './commands/ask.js';
import { codeCommand } from './commands/code.js';
import { skillsCommand } from './commands/skills.js';

const program = new Command();

program
    .name('kob')
    .description('KOB CLI - Command-line interface for Kob AI')
    .version('1.0.0');

program.addCommand(authVerifyCommand);
program.addCommand(balanceCommand);
program.addCommand(chatCommand);
program.addCommand(chatInteractiveCommand);
program.addCommand(streamCommand);
program.addCommand(askCommand);
program.addCommand(codeCommand);
program.addCommand(skillsCommand);
program.addCommand(modelsCommand);

function showWelcome(): void {
    const line = chalk.dim('─'.repeat(58));
    const accent = chalk.hex('#a78bfa');
    const subtle = chalk.dim;
    const label = chalk.hex('#fbbf24');
    const green = chalk.hex('#34d399');
    const blue = chalk.hex('#38bdf8');
    const pink = chalk.hex('#f472b6');

    console.log(`

${blue.bold('  ██╗  ██╗ ██████╗ ██████╗ ')}${pink.bold('   ██████╗██╗     ██╗')}
${green.bold('  ██║ ██╔╝██╔═══██╗██╔══██╗')}${pink.bold('  ██╔════╝██║     ██║')}
${blue.bold('  █████╔╝ ██║   ██║██████╔╝')}${pink.bold('  ██║     ██║     ██║')}
${accent.bold('  ██╔═██╗ ██║   ██║██╔══██╗')}${pink.bold('  ██║     ██║     ██║')}
${pink.bold('  ██║  ██╗╚██████╔╝██████╔╝')}${pink.bold('  ╚██████╗███████╗██║')}
${subtle('  ╚═╝  ╚═╝ ╚═════╝ ╚═════╝')}${subtle('   ╚═════╝╚══════╝╚═╝')}

${subtle('╭' + '─'.repeat(56) + '╮')}
${subtle('│')}  ${chalk.bold('KOB CLI')}  ${subtle('·')}  ${blue.bold('powered by')}  ${green.bold('Kob AI')}  ${subtle('·')}  ${pink.bold('made in Thailand')}  ${chalk.bold('🇹🇭')}  ${subtle('│')}
${subtle('│')}  ${subtle.italic('v1.0.0')}  ${subtle('·')}  ${subtle('www.kob-ai.dev')}  ${subtle('·')}  ${subtle('AI Command-Line Interface')}  ${subtle('│')}
${subtle('╰' + '─'.repeat(56) + '╯')}

${line}
${label.bold('  🚀  QUICK START')}
${line}

  ${accent('kob ask "What is AI?"')}     ${subtle('Ask anything to AI')}
  ${accent('kob code "REST API"')}        ${subtle('Generate code')}
  ${accent('kob skills')}                 ${subtle('List all available skills')}

${line}
${label.bold('  📋  COMMANDS')}
${line}

  ${chalk.hex('#f97316')('🔐')}  ${accent.bold('auth:verify')}    ${accent('balance')}                    ${subtle('Authentication')}
  ${chalk.hex('#22d3ee')('💡')}  ${accent.bold('ask')}                                                 ${subtle('Ask questions')}
  ${chalk.hex('#34d399')('💻')}  ${accent.bold('code')}          ${accent('--lang python')}             ${subtle('Generate code')}
  ${chalk.hex('#38bdf8')('💬')}  ${accent.bold('chat')}          ${accent('chat:interactive')} ${accent('stream')}  ${subtle('AI Chat')}
  ${chalk.hex('#a78bfa')('🤖')}  ${accent.bold('models')}        ${accent('--provider DeepSeek')}       ${subtle('AI Models')}
  ${chalk.hex('#f472b6')('🧠')}  ${accent.bold('skills')}                                              ${subtle('All skills')}

${line}
  ${subtle('💡')}  ${subtle.italic('kob <command> --help  for detailed options')}
${chalk.dim('─').repeat(58)}
`);
}

// Display welcome if no command provided
if (process.argv.length <= 2) {
    showWelcome();
    process.exit(0);
}

program.parse(process.argv);
