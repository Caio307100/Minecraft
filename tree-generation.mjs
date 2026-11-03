import { JavaRandom } from './java-random.mjs';

const SIZE = 16;
const HEIGHT = 128;
const AIR = 0;
const GRASS = 2;
const DIRT = 3;
const LOG = 17;
const LEAVES = 18;

const indexOf = (x, z, y) => x * 2048 + z * HEIGHT + y;

function setMetadata(metadata, index, value) {
    const byteIndex = index >> 1;
    if (index & 1) metadata[byteIndex] = (metadata[byteIndex] & 15) | ((value & 15) << 4);
    else metadata[byteIndex] = (metadata[byteIndex] & 240) | (value & 15);
}

function makeTree(blocks, metadata, random, x, y, z, birch) {
    // gq (oak) and jp (birch), transcribed from the Minecraft 1.0 JAR.
    const height = random.nextInt(3) + (birch ? 5 : 4);
    if (y < 1 || y + height + 1 > HEIGHT) return false;

    const at = (wx, wy, wz) => {
        if (wx < 0 || wx >= SIZE || wz < 0 || wz >= SIZE || wy < 0 || wy >= HEIGHT) return null;
        return blocks[indexOf(wx, wz, wy)];
    };

    let clear = true;
    for (let yy = y; yy <= y + 1 + height; yy++) {
        let radius = 1;
        if (yy === y) radius = 0;
        if (yy >= y + 1 + height - 2) radius = 2;
        for (let xx = x - radius; xx <= x + radius && clear; xx++) {
            for (let zz = z - radius; zz <= z + radius && clear; zz++) {
                const block = at(xx, yy, zz);
                if (block !== AIR && block !== LEAVES) clear = false;
            }
        }
    }
    if (!clear) return false;
    const ground = at(x, y - 1, z);
    if ((ground !== GRASS && ground !== DIRT) || y >= HEIGHT - height - 1) return false;

    blocks[indexOf(x, z, y - 1)] = DIRT;
    for (let yy = y - 3 + height; yy <= y + height; yy++) {
        const layer = yy - (y + height);
        const radius = 1 - Math.trunc(layer / 2);
        for (let xx = x - radius; xx <= x + radius; xx++) {
            const dx = xx - x;
            for (let zz = z - radius; zz <= z + radius; zz++) {
                const dz = zz - z;
                if ((Math.abs(dx) === radius && Math.abs(dz) === radius) &&
                    (random.nextInt(2) === 0 || layer === 0)) continue;
                const old = at(xx, yy, zz);
                if (old === null || old !== AIR && old !== LEAVES) continue;
                const index = indexOf(xx, zz, yy);
                blocks[index] = LEAVES;
                setMetadata(metadata, index, birch ? 2 : 0);
            }
        }
    }
    for (let yy = 0; yy < height; yy++) {
        const old = at(x, y + yy, z);
        if (old !== AIR && old !== LEAVES) continue;
        const index = indexOf(x, z, y + yy);
        blocks[index] = LOG;
        setMetadata(metadata, index, birch ? 2 : 0);
    }
    return true;
}

export function generateForestTrees({ blocks, biomeIds, chunkX, chunkZ, seed }) {
    if (!(blocks instanceof Uint8Array) || blocks.length !== SIZE * SIZE * HEIGHT) {
        throw new TypeError('Blocos do chunk inválidos para geração de árvores.');
    }
    if (!biomeIds || biomeIds.length !== SIZE * SIZE) {
        throw new TypeError('IDs de bioma inválidos para geração de árvores.');
    }
    const metadata = new Uint8Array(blocks.length >> 1);
    // Forest biome (id 4) uses 10 tree attempts per chunk in 1.0.
    // Seeded independently per chunk so streaming order does not affect results.
    const chunkSeed = BigInt(seed) ^ (BigInt(chunkX) * 341873128712n) ^ (BigInt(chunkZ) * 132897987541n);
    const random = new JavaRandom(chunkSeed);
    for (let attempt = 0; attempt < 10; attempt++) {
        const x = random.nextInt(16);
        const z = random.nextInt(16);
        if (biomeIds[x + z * 16] !== 4) continue;
        const y = (() => {
            for (let yy = HEIGHT - 1; yy >= 0; yy--) {
                const block = blocks[indexOf(x, z, yy)];
                if (block !== AIR && block !== 8 && block !== 9) return yy + 1;
            }
            return 0;
        })();
        const birch = random.nextInt(5) === 0;
        makeTree(blocks, metadata, random, x, y, z, birch);
    }
    return metadata;
}
