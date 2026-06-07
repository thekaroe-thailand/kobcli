#!/usr/bin/env node
const { spawnSync } = require('child_process');
const { resolve, dirname } = require('path');
const { existsSync } = require('fs');

// Try compiled binary first (faster, no Bun dependency)
 const exeName = process.platform === 'win32' ? 'kob-cli.exe' : 'kob-cli';
const exePath = resolve(__dirname, '..', exeName);

let r;
if (existsSync(exePath)) {
  r = spawnSync(exePath, process.argv.slice(2), { stdio: 'inherit', shell: false });
} else {
  // Fall back to bun
  const entry = resolve(__dirname, '..', 'src', 'index.ts');
  r = spawnSync('bun', [entry, ...process.argv.slice(2)], { stdio: 'inherit', shell: true });

  if (r.error) {
    console.error('');
    console.error('  ╔═══════════════════════════════════════════════╗');
    console.error('  ║                                               ║');
    console.error('  ║   KOB CLI requires Bun to be installed!      ║');
    console.error('  ║   Or build with:  bun run build              ║');
    console.error('  ║                                               ║');
    console.error('  ╚═══════════════════════════════════════════════╝');
    console.error('');
    process.exit(1);
  }
}

process.exit(r.status ?? 0);
