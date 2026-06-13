// SPINNER - single-line dot animation during streaming

import chalk from 'chalk';
import { C, dim } from './theme.js';

const CLEAR_LINE = '\r\x1b[2K';

export class Spinner {
    private timer: ReturnType<typeof setInterval> | null = null;
    private frame = 0;
    private text = '';
    private active = false;
    private t0 = Date.now();
    private lastRender = 0;
    private lastText = '';
    private readonly minInterval = 80; // ms — throttle rapid setText calls

    start(text: string): void {
        this.text = text;
        this.lastText = text;
        if (!this.active) this.t0 = Date.now();
        this.active = true;
        if (this.timer) return;
        this.timer = setInterval(() => this.render(), 120);
        this.render();
    }

    setText(text: string): void {
        if (this.text === text) return; // no change
        this.text = text;
        this.render();
    }

    private render(): void {
        if (!this.active || !process.stdout.isTTY) return;
        const now = Date.now();
        // Throttle: only render if enough time has passed since last render
        if (now - this.lastRender < this.minInterval && this.text === this.lastText) return;
        this.lastRender = now;
        this.lastText = this.text;
        this.frame = (this.frame + 1) % 4;
        const dots = '.'.repeat(this.frame + 1).padEnd(4, ' ');
        const elapsed = ((Date.now() - this.t0) / 1000).toFixed(1);
        const line = `${chalk.hex(C.cyan)('  ⠂')} ${this.text}${chalk.hex(C.cyan)(dots)}${dim(` · ${elapsed}s · esc to stop`)}`;
        process.stdout.write(CLEAR_LINE + line);
    }

    /** Print a permanent line above the spinner without flicker. */
    log(line: string): void {
        if (process.stdout.isTTY) {
            process.stdout.write(CLEAR_LINE);
        }
        console.log(line);
        if (this.active) this.render();
    }

    stop(finalLine?: string): void {
        this.active = false;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (process.stdout.isTTY) {
            process.stdout.write(CLEAR_LINE);
        }
        if (finalLine) console.log(finalLine);
    }
}
