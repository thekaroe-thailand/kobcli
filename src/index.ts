#!/usr/bin/env bun

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { authVerifyCommand, balanceCommand } from './commands/auth.js';
import { modelsCommand } from './commands/models.js';
import { chatCommand, chatInteractiveCommand } from './commands/chat.js';
import { streamCommand } from './commands/stream.js';
import { askCommand } from './commands/ask.js';
import { codeCommand } from './commands/code.js';
import { skillsCommand } from './commands/skills.js';
import { runCodeTui } from './ui/code-tui.js';

// Read version from package.json so it stays in sync with releases
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);
const VERSION: string = pkg.version;

const program = new Command();

program
  .name('kob')
  .description('KOB CLI - Command-line interface for Kob AI')
  .version(VERSION);

program.addCommand(authVerifyCommand);
program.addCommand(balanceCommand);
program.addCommand(chatCommand);
program.addCommand(chatInteractiveCommand);
program.addCommand(streamCommand);
program.addCommand(askCommand);
program.addCommand(codeCommand);
program.addCommand(skillsCommand);
program.addCommand(modelsCommand);

// Launch the Code TUI when no subcommand is given — `kob` becomes the entry point
if (process.argv.length <= 2) {
  await runCodeTui();
  process.exit(0);
}

program.parse(process.argv);
