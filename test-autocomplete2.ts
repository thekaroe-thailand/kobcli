import { autocomplete } from '@clack/prompts';

async function main() {
    const res = await autocomplete({
        message: 'Pick a file',
        options: [
            { value: 'package.json', label: 'package.json' },
            { value: 'src/index.ts', label: 'src/index.ts' },
            { value: 'src/repl.ts', label: 'src/repl.ts' }
        ]
    });
    console.log(res);
}
main();