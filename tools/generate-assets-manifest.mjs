import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('public/assets');
const files = [];

async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) await walk(absolute);
        else if (entry.isFile()) files.push(path.relative(root, absolute).split(path.sep).join('/'));
    }
}

await walk(root);
files.sort();
await writeFile('public/assets-manifest.json', `${JSON.stringify({ files }, null, 2)}\n`);
console.log(`Manifesto atualizado: ${files.length} assets.`);
