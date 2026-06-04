#!/usr/bin/env node
const { spawnSync } = require('child_process');
const { resolve } = require('path');

const entry = resolve(__dirname, '..', 'src', 'index.ts');
const bun = spawnSync('bun', [entry], { stdio: 'inherit', shell: true });

if (bun.error) {
  console.error('');
  console.error('  ╔═══════════════════════════════════════════════╗');
  console.error('  ║                                               ║');
  console.error('  ║   KOB CLI requires Bun to be installed!      ║');
  console.error('  ║                                               ║');
  console.error('  ║   Install Bun:  https://bun.sh               ║');
  console.error('  ║                                               ║');
  console.error('  ╚═══════════════════════════════════════════════╝');
  console.error('');
  process.exit(1);
}

process.exit(bun.status ?? 0);
