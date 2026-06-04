#!/usr/bin/env bun

import { Command } from 'commander';
import chalk from 'chalk';
import { authCommand, balanceCommand } from './commands/auth.js';
import { modelsCommand } from './commands/models.js';
import { chatCommand, chatInteractiveCommand } from './commands/chat.js';
import { streamCommand } from './commands/stream.js';
import { projectsCommand } from './commands/projects.js';
import { rulesCommand } from './commands/rules.js';
import { creditsCommand } from './commands/credits.js';

const program = new Command();

program
    .name('kob')
    .description(chalk.bold('🤖 KOB AI CLI - Command-line interface for KOB AI API'))
    .version('1.0.0')
    .addHelpText('before', chalk.bold.cyan(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🤖  KOB AI CLI v1.0.0                                 ║
║   Command-line interface for KOB AI API                  ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`));

// Authentication commands
program.addCommand(authCommand);
program.addCommand(balanceCommand);

// AI Chat commands
program.addCommand(chatCommand);
program.addCommand(chatInteractiveCommand);
program.addCommand(streamCommand);

// Models
program.addCommand(modelsCommand);

// Project management
program.addCommand(projectsCommand);
program.addCommand(rulesCommand);

// Credits
program.addCommand(creditsCommand);

// Display help if no command provided
if (process.argv.length <= 2) {
    program.outputHelp();
    process.exit(0);
}

program.parse(process.argv);
