// GRADIENT — dependency-free hex gradient for terminal text.
//
//   const fn = gradient(['#22d3ee', '#a78bfa', '#f472b6']);
//   console.log(fn('KOB CLI'));   // cyan → violet → pink

function hexToRgb(hex: string): [number, number, number] {
    const m = (hex ?? '').replace('#', '');
    const full = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
    return [
        parseInt((full ?? '00').slice(0, 2), 16),
        parseInt((full ?? '00').slice(2, 4), 16),
        parseInt((full ?? '00').slice(4, 6), 16),
    ];
}

function rgbToAnsi(r: number, g: number, b: number): string {
    return `\x1b[38;2;${r};${g};${b}m`;
}

const ESC_RESET = '\x1b[0m';

export function gradient(stops: string[]): (text: string) => string {
    if (stops.length === 0) return (s) => s;
    if (stops.length === 1) {
        const [r, g, b] = hexToRgb(stops[0]!);
        const open = rgbToAnsi(r, g, b);
        return (text) => open + text + ESC_RESET;
    }

    const rgbs = stops.map(hexToRgb);

    return (text: string) => {
        // Walk a continuous parameter t∈[0,1] across all characters and
        // sample the colour at the corresponding point in the stop array.
        const n = text.length;
        if (n === 0) return '';
        let out = '';
        for (let i = 0; i < n; i++) {
            const t = n === 1 ? 0 : i / (n - 1);
            const seg = t * (rgbs.length - 1);
            const lo = Math.floor(seg);
            const hi = Math.min(rgbs.length - 1, lo + 1);
            const k = seg - lo;
            const a = rgbs[lo]!;
            const b = rgbs[hi]!;
            const r = Math.round(a[0] + (b[0] - a[0]) * k);
            const g = Math.round(a[1] + (b[1] - a[1]) * k);
            const bl = Math.round(a[2] + (b[2] - a[2]) * k);
            out += rgbToAnsi(r, g, bl) + text[i];
        }
        return out + ESC_RESET;
    };
}
