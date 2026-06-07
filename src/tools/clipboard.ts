// CLIPBOARD - cross-platform copy (best effort)

import { spawnSync } from 'node:child_process';

export function copyToClipboard(text: string): boolean {
    try {
        if (process.platform === 'win32') {
            return spawnSync('clip', [], { input: text, timeout: 3000 }).status === 0;
        }
        if (process.platform === 'darwin') {
            return spawnSync('pbcopy', [], { input: text, timeout: 3000 }).status === 0;
        }
        const linux: Array<[string, string[]]> = [
            ['xclip', ['-selection', 'clipboard']],
            ['xsel', ['--clipboard', '--input']],
            ['wl-copy', []],
        ];
        for (const entry of linux) {
            if (spawnSync(entry[0], entry[1], { input: text, timeout: 3000 }).status === 0) {
                return true;
            }
        }
        return false;
    } catch {
        return false;
    }
}
