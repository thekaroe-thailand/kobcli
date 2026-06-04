import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

const pkgPath = resolve(import.meta.dir, '../../package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

const parts = pkg.version.split('.').map(Number);
parts[2] += 1;
pkg.version = parts.join('.');

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`\n  📦  ${pkg.name}@${pkg.version}\n`);

execSync('bun run build', { stdio: 'inherit', cwd: resolve(import.meta.dir, '../..') });
execSync('npm publish --ignore-scripts', { stdio: 'inherit', cwd: resolve(import.meta.dir, '../..') });
