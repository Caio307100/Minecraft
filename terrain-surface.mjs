import { JavaRandom } from './java-random.mjs';

const HEIGHT = 128;
const SEA_LEVEL = 63;

const BLOCK = {
    AIR: 0,
    STONE: 1,
    BEDROCK: 7,
    WATER: 9,
    SAND: 12,
    ICE: 79,
    SANDSTONE: 24
};

const BIOME_TOP = [
    2, 2, 12, 2,
    2, 2, 2, 2,
    2, 3, 2, 2,
    2, 2, 110, 110
];

const BIOME_FILLER = [
    3, 3, 12, 3,
    3, 3, 3, 3,
    3, 3, 3, 3,
    3, 3, 3, 3
];

const CHUNK_SEED_X = 341873128712n;
const CHUNK_SEED_Z = 132897987541n;

export function applyTerrainSurface({
    blocks,
    chunkX,
    chunkZ,
    noiseGenerator,
    biomeIds,
    temperatures,
    seed = 0n,
    seaLevel = SEA_LEVEL
}) {
    if (!(blocks instanceof Uint8Array) || blocks.length !== 32768) {
        throw new TypeError('Chunk inválido: esperado Uint8Array de 32768 bytes.');
    }

    if (biomeIds.length !== 256 || temperatures.length !== 256) {
        throw new RangeError('Biomas e temperaturas precisam conter 256 valores.');
    }

    if (!noiseGenerator?.generateNoise) {
        throw new TypeError('Gerador de ruído inválido.');
    }

    const noise = noiseGenerator.generateNoise(
        null,
        chunkX * 16,
        chunkZ * 16,
        0,
        16,
        16,
        1,
        0.0625,
        0.0625,
        0.0625
    );

    const worldSeed = BigInt(seed);
    const random = new JavaRandom(worldSeed);
    random.setSeed(
        worldSeed +
        BigInt(chunkX) * CHUNK_SEED_X +
        BigInt(chunkZ) * CHUNK_SEED_Z
    );

    for (let z = 0; z < 16; z++) {
        for (let x = 0; x < 16; x++) {
            const climateIndex = x + z * 16;
            const noiseIndex = z + x * 16;

            const biomeId = biomeIds[climateIndex];

            if (biomeId < 0 || biomeId >= 16) {
                throw new RangeError(`Bioma inválido: ${biomeId}`);
            }

            const temperature = temperatures[climateIndex];

            const thickness = Math.trunc(
                noise[noiseIndex] / 3.0 +
                3.0 +
                random.nextDouble() * 0.25
            );

            let remaining = -1;
            let top = BIOME_TOP[biomeId];
            let filler = BIOME_FILLER[biomeId];

            for (let y = HEIGHT - 1; y >= 0; y--) {
                const index = (x * 16 + z) * HEIGHT + y;

                // O Java sorteia a resistência da bedrock em cada altura.
                if (y <= random.nextInt(5)) {
                    blocks[index] = BLOCK.BEDROCK;
                    continue;
                }

                const currentBlock = blocks[index];

                if (currentBlock === BLOCK.AIR) {
                    remaining = -1;
                    continue;
                }

                if (currentBlock !== BLOCK.STONE) {
                    continue;
                }

                if (remaining === -1) {
                    if (thickness <= 0) {
                        top = BLOCK.AIR;
                        filler = BLOCK.STONE;
                    } else if (
                        y >= seaLevel - 4 &&
                        y <= seaLevel + 1
                    ) {
                        top = BIOME_TOP[biomeId];
                        filler = BIOME_FILLER[biomeId];
                    }

                    if (y < seaLevel && top === BLOCK.AIR) {
                        top = temperature < 0.15
                            ? BLOCK.ICE
                            : BLOCK.WATER;
                    }

                    remaining = thickness;

                    blocks[index] = y >= seaLevel - 1
                        ? top
                        : filler;
                } else if (remaining > 0) {
                    remaining--;
                    blocks[index] = filler;

                    if (
                        remaining === 0 &&
                        filler === BLOCK.SAND
                    ) {
                        remaining = random.nextInt(4);
                        filler = BLOCK.SANDSTONE;
                    }
                }
            }
        }
    }

    return blocks;
}
