import { spawn } from 'node:child_process';
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

function renderProgress(startMs: number, tick: number): void {
    if (!process.stdout.isTTY) return;
    const width = 20;
    const head = tick % (width + 5);
    let bar = '';
    for (let i = 0; i < width; i += 1) {
        if (i >= head - 4 && i <= head) bar += '=';
        else bar += ' ';
    }
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    const line = `\r  ${chalk.hex(C.cyan)('[' + bar + ']')} ${chalk.hex(C.cyan)('Upgrading KOB CLI')}${chalk.dim(` · ${elapsed}s`)}`;
    process.stdout.write(line + '\x1b[K');
}

function clearProgress(): void {
    if (process.stdout.isTTY) process.stdout.write('\r\x1b[K');
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
}

export async function runUpgrade(): Promise<UpgradeResult> {
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
    const startMs = Date.now();
    let tick = 0;
    const timer = setInterval(() => {
        tick += 1;
        renderProgress(startMs, tick);
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
            resolve({ ok: false, exitCode: -1, visibleOutput: [error.message] });
        });

        child.on('close', (code) => {
            clearInterval(timer);
            if (stdoutBuffer && !shouldHideLine(stdoutBuffer)) visibleOutput.push(stdoutBuffer);
            if (stderrBuffer && !shouldHideLine(stderrBuffer)) visibleOutput.push(stderrBuffer);
            clearProgress();
            resolve({ ok: code === 0, exitCode: code ?? -1, visibleOutput });
        });
    });
}
