import { spawn, spawnSync } from 'node:child_process';
import chalk from 'chalk';
import { C } from '../ui/theme.js';

const HIDDEN_LINE_PATTERNS = [
    /^npm warn cleanup/i,
    /^npm warn allow-scripts/i,
    /^\d+ packages are looking for funding/i,
    /^run `npm fund`/i,
    /^changed \d+ packages in /i,
];

function shouldHideLine(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed) return true;
    return HIDDEN_LINE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerFrame = 0;

function renderProgress(fromVersion: string, toVersion: string): void {
    if (!process.stdout.isTTY) return;
    spinnerFrame = (spinnerFrame + 1) % SPINNER_FRAMES.length;
    const s = chalk.hex(C.cyan)(SPINNER_FRAMES[spinnerFrame]!);
    const label = fromVersion && fromVersion !== '?' && toVersion && toVersion !== fromVersion
        ? `Upgrading KOB CLI ${chalk.dim('v' + fromVersion)} ${chalk.dim('→')} ${chalk.hex(C.green)('v' + toVersion)}`
        : 'Upgrading KOB CLI';
    const line = `  ${s} ${label}`;
    process.stdout.write('\r' + ' '.repeat(80) + '\r' + line);
}

function clearProgress(): void {
    if (process.stdout.isTTY) process.stdout.write('\r' + ' '.repeat(80) + '\r');
}

function flushBuffer(buffer: string, lines: string[]): string {
    const parts = buffer.split(/\r?\n/);
    const rest = parts.pop() ?? '';
    for (const part of parts) {
        if (!shouldHideLine(part)) lines.push(part);
    }
    return rest;
}

export interface UpgradeResult {
    ok: boolean;
    exitCode: number;
    visibleOutput: string[];
    fromVersion: string;
    toVersion: string;
}

function getLatestVersion(): string {
    try {
        const c = spawnSync('npm', ['view', 'kob-cli', 'version', '--json'], {
            shell: process.platform === 'win32',
            encoding: 'utf8',
            timeout: 5000,
        });
        if (c.status === 0 && c.stdout) return (JSON.parse(c.stdout.trim()) as string);
    } catch { /* offline */ }
    return 'latest';
}

function getCurrentVersion(): string {
    try {
        const c = spawnSync('npm', ['ls', '-g', 'kob-cli', '--depth=0', '--json'], {
            shell: process.platform === 'win32',
            encoding: 'utf8',
            timeout: 5000,
        });
        if (c.status === 0 && c.stdout) {
            const d = JSON.parse(c.stdout);
            const v = d?.dependencies?.['kob-cli']?.version;
            if (v) return v;
        }
    } catch { /* not global */ }
    return '?';
}

export async function runUpgrade(): Promise<UpgradeResult> {
    const fromVersion = getCurrentVersion();
    const toVersion = getLatestVersion();

    const child = spawn(
        'npm',
        ['i', '-g', 'kob-cli@latest', '--no-fund', '--no-audit', '--loglevel=error', '--progress=false'],
        {
            shell: process.platform === 'win32',
            stdio: ['ignore', 'pipe', 'pipe'],
        }
    );

    const visibleOutput: string[] = [];
    let stdoutBuffer = '';
    let stderrBuffer = '';
    const timer = setInterval(() => {
        renderProgress(fromVersion, toVersion);
    }, 90);

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');

    child.stdout?.on('data', (chunk: string) => {
        stdoutBuffer += chunk;
        stdoutBuffer = flushBuffer(stdoutBuffer, visibleOutput);
    });

    child.stderr?.on('data', (chunk: string) => {
        stderrBuffer += chunk;
        stderrBuffer = flushBuffer(stderrBuffer, visibleOutput);
    });

    return await new Promise<UpgradeResult>((resolve) => {
        child.on('error', (error) => {
            clearInterval(timer);
            clearProgress();
            resolve({ ok: false, exitCode: -1, visibleOutput: [error.message], fromVersion, toVersion });
        });

        child.on('close', (code) => {
            clearInterval(timer);
            if (stdoutBuffer && !shouldHideLine(stdoutBuffer)) visibleOutput.push(stdoutBuffer);
            if (stderrBuffer && !shouldHideLine(stderrBuffer)) visibleOutput.push(stderrBuffer);
            clearProgress();
            resolve({ ok: code === 0, exitCode: code ?? -1, visibleOutput, fromVersion, toVersion });
        });
    });
}
