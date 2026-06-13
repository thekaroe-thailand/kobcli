// SPINNER - single-line dot animation during streaming

import readline from 'node:readline';
import chalk from 'chalk';
import { C, dim } from './theme.js';

export class Spinner {
    private timer: ReturnType<typeof setInterval> | null = null;
    private frame = 0;
    private text = '';
    private active = false;
    private t0 = Date.now();

    start(text: string): void {
        this.text = text;
        if (!this.active) this.t0 = Date.now();
        this.active = true;
        if (this.timer) return;
        this.timer = setInterval(() => this.render(), 120);
        this.render();
    }

    setText(text: string): void {
        this.text = text;
        this.render();
    }

    private render(): void {
        if (!this.active || !process.stdout.isTTY) return;
        this.frame = (this.frame + 1) % 4;
        const dots = '.'.repeat(this.frame + 1).padEnd(4, ' ');
        const elapsed = ((Date.now() - this.t0) / 1000).toFixed(1);
        const line = `${chalk.hex(C.cyan)('  ⠂')} ${this.text}${chalk.hex(C.cyan)(dots)}${dim(` · ${elapsed}s · esc to stop`)}`;
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
        process.stdout.write(line);
    }

    /** Print a permanent line above the spinner without flicker. */
    log(line: string): void {
        if (process.stdout.isTTY) {
            readline.cursorTo(process.stdout, 0);
            readline.clearLine(process.stdout, 0);
        }
        console.log(line);
        if (this.active) this.render();
    }

    stop(finalLine?: string): void {
        this.active = false;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (process.stdout.isTTY) {
            readline.cursorTo(process.stdout, 0);
            readline.clearLine(process.stdout, 0);
        }
        if (finalLine) console.log(finalLine);
    }
}
