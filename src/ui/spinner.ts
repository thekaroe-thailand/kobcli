// SPINNER - minimal status indicator (no ANSI animation to avoid Windows flicker)

import chalk from 'chalk';
import { C, dim } from './theme.js';

export class Spinner {
    private text = '';
    private active = false;

    start(text: string): void {
        this.text = text;
        this.active = true;
    }

    setText(text: string): void {
        this.text = text;
    }

    /** Print a permanent line (replaces the spinner's own line concept). */
    log(line: string): void {
        console.log(line);
    }

    stop(finalLine?: string): void {
        this.active = false;
        if (finalLine) console.log(finalLine);
    }
}
