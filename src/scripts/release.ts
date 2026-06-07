import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

// @ts-expect-error import.meta.dir is Bun-specific
const root = resolve(import.meta.dir, '../..');
const pkgPath = resolve(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

const bumpType = (process.argv[2] as 'patch' | 'minor' | 'major') || 'patch';
const idx = { patch: 2, minor: 1, major: 0 }[bumpType];
const parts = pkg.version.split('.').map(Number);
parts[idx] += 1;
if (bumpType === 'major') parts[1] = 0;
if (bumpType !== 'patch') parts[2] = 0;
pkg.version = parts.join('.');

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`\n  📦  ${pkg.name}@${pkg.version} (${bumpType})\n`);

try {
  execSync('bun run build:only', { stdio: 'inherit', cwd: root });
} catch (e) {
  console.error('❌ build failed — skipping publish & push');
  process.exit(1);
}

try {
  execSync('npm publish --ignore-scripts', { stdio: 'inherit', cwd: root });
} catch (e) {
  console.error('❌ publish failed — version bumped, please check npm');
  process.exit(1);
}

try {
  execSync('git add package.json', { stdio: 'inherit', cwd: root });
  execSync(`git commit -m "release: v${pkg.version}"`, { stdio: 'inherit', cwd: root });
  execSync('git push', { stdio: 'inherit', cwd: root });
  execSync('git tag v' + pkg.version, { stdio: 'inherit', cwd: root });
  execSync('git push --tags', { stdio: 'inherit', cwd: root });
  console.log(`\n  ✅  released v${pkg.version}\n`);
} catch (e) {
  console.error('⚠️  git push failed (published ok) — please push manually');
}
