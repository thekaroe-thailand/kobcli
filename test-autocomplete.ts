import { autocomplete } from '@clack/prompts';

async function main() {
    const res = await autocomplete({
        message: 'Pick a file',
        options: async (query) => {
            return [
                { value: 'package.json', label: 'package.json' },
                { value: 'src/index.ts', label: 'src/index.ts' }
            ].filter(o => o.label.includes(query));
        }
    });
    console.log(res);
}
main();