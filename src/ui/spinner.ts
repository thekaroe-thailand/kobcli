// SPINNER - single-line spinner that can interleave log lines

import chalk from 'chalk';
import { C, dim } from './theme.js';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

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
        this.timer = setInterval(() => this.render(), 90);
        this.render();
    }

    setText(text: string): void {
        this.text = text;
        this.render();
    }

    private clearLine(): void {
        if (process.stdout.isTTY) process.stdout.write('\r' + ' '.repeat(100) + '\r');
    }

    private render(): void {
        if (!this.active || !process.stdout.isTTY) return;
        this.frame = (this.frame + 1) % FRAMES.length;
        const f = chalk.hex(C.cyan)(FRAMES[this.frame]!);
        const elapsed = ((Date.now() - this.t0) / 1000).toFixed(1);
        
        // Add dot animation to the end of the text
        const baseText = this.text.replace(/\.+$/, '');
        const dots = ['.', '..', '...'][Math.floor(this.frame / 3) % 3];
        const displayText = `${baseText}${dots}`;

        const plain = `  ${FRAMES[this.frame]} ${displayText} · ${elapsed}s · esc to stop`;
        // Overwrite with spaces first (works on Windows consoles without ANSI ESC[K)
        process.stdout.write('\r' + ' '.repeat(plain.length + 4) + '\r' + `  ${f} ${displayText}${dim(' · ' + elapsed + 's · esc to stop')}`);
    }

    /** Print a permanent line above the spinner without flicker. */
    log(line: string): void {
        this.clearLine();
        console.log(line);
        if (this.active) this.render();
    }

    stop(finalLine?: string): void {
        this.active = false;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        this.clearLine();
        if (finalLine) console.log(finalLine);
    }
}
