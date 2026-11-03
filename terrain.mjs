import { JavaRandom } from './java-random.mjs';
import { NoiseOctaves } from './noise.mjs';

const f = Math.fround;

const WORLD_HEIGHT = 128;
const SEA_LEVEL = 63;

const BIOME_SHAPE = [
    [-1.0, 0.4],  // 0 Ocean
    [ 0.1, 0.3],  // 1 Plains
    [ 0.1, 0.2],  // 2 Desert
    [ 0.2, 1.8],  // 3 Extreme Hills
    [ 0.1, 0.3],  // 4 Forest
    [ 0.1, 0.4],  // 5 Taiga
    [-0.2, 0.1],  // 6 Swampland
    [-0.5, 0.0],  // 7 River
    [ 0.1, 0.3],  // 8 Hell
    [ 0.1, 0.3],  // 9 Sky
    [-1.0, 0.5],  // 10 Frozen Ocean
    [-0.5, 0.0],  // 11 Frozen River
    [ 0.1, 0.3],  // 12 Ice Plains
    [ 0.2, 1.8],  // 13 Ice Mountains
    [ 0.2, 1.0],  // 14 Mushroom Island
    [-1.0, 0.1]   // 15 Mushroom Shore
].map(([height, variation]) => ({
    height: f(height),
    variation: f(variation)
}));

function createBiomeWeights() {
    const weights = new Float32Array(25);

    for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
            const distance = f(
                f(dx * dx + dz * dz) + f(0.2)
            );

            const root = f(Math.sqrt(distance));
            weights[(dx + 2) + (dz + 2) * 5] = f(10 / root);
        }
    }

    return weights;
}

function validateBiomeGrid(biomeIds) {
    if (!biomeIds || biomeIds.length !== 100) {
        throw new RangeError(
            'A grade de biomas precisa conter exatamente 10x10 IDs.'
        );
    }

    for (let i = 0; i < 100; i++) {
        const id = biomeIds[i];

        if (!Number.isInteger(id) || !BIOME_SHAPE[id]) {
            throw new RangeError(`ID de bioma inválido na posição ${i}: ${id}`);
        }
    }
}

function getBiomeAverage(biomeIds, weights, x, z) {
    const centerId = biomeIds[(x + 2) + (z + 2) * 10];
    const center = BIOME_SHAPE[centerId];

    let weightedVariation = f(0);
    let weightedHeight = f(0);
    let totalWeight = f(0);

    for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
            const id = biomeIds[
                (x + dx + 2) + (z + dz + 2) * 10
            ];

            const neighbor = BIOME_SHAPE[id];
            const weightIndex = (dx + 2) + (dz + 2) * 5;

            let weight = f(
                weights[weightIndex] / f(neighbor.height + f(2))
            );

            if (neighbor.height > center.height) {
                weight = f(weight / f(2));
            }

            weightedVariation = f(
                weightedVariation + f(neighbor.variation * weight)
            );

            weightedHeight = f(
                weightedHeight + f(neighbor.height * weight)
            );

            totalWeight = f(totalWeight + weight);
        }
    }

    let averageVariation = f(weightedVariation / totalWeight);
    let averageHeight = f(weightedHeight / totalWeight);

    averageVariation = f(
        f(averageVariation * f(0.9)) + f(0.1)
    );

    averageHeight = f(
        f(f(averageHeight * f(4)) - f(1)) / f(8)
    );

    return {
        height: averageHeight,
        variation: averageVariation
    };
}

export class TerrainDensityGenerator {
    constructor(worldSeed) {
        const random = new JavaRandom(BigInt(worldSeed));

        // Ordem original do construtor xj.
        this.noiseO = new NoiseOctaves(random, 16);
        this.noiseP = new NoiseOctaves(random, 16);
        this.noiseQ = new NoiseOctaves(random, 8);
        this.noiseR = new NoiseOctaves(random, 4);
        this.noiseA = new NoiseOctaves(random, 10);
        this.noiseB = new NoiseOctaves(random, 16);
        this.noiseC = new NoiseOctaves(random, 8);

        this.biomeWeights = createBiomeWeights();
    }

    generateDensity(chunkX, chunkZ, biomeIds) {
        if (!Number.isInteger(chunkX) || !Number.isInteger(chunkZ)) {
            throw new TypeError('As coordenadas do chunk precisam ser inteiras.');
        }

        validateBiomeGrid(biomeIds);

        const sizeX = 5;
        const sizeY = 17;
        const sizeZ = 5;

        const originX = chunkX * 4;
        const originZ = chunkZ * 4;

        const noiseLength = sizeX * sizeY * sizeZ;

        // Ruídos 2D.
        // O primeiro é calculado pelo bytecode, embora não participe
        // diretamente da fórmula final de densidade.
        this.noiseA.generateNoise2D(
            null, originX, originZ,
            sizeX, sizeZ, 1.121, 1.121
        );

        const variationNoise = this.noiseB.generateNoise2D(
            null, originX, originZ,
            sizeX, sizeZ, 200.0, 200.0
        );

        // Ruído de densidade e dois ruídos de interpolação.
        const densityNoise = this.noiseQ.generateNoise(
            null,
            originX, 0, originZ,
            sizeX, sizeY, sizeZ,
            684.412 / 80,
            684.412 / 160,
            684.412 / 80
        );

        const lowerNoise = this.noiseO.generateNoise(
            null,
            originX, 0, originZ,
            sizeX, sizeY, sizeZ,
            684.412, 684.412, 684.412
        );

        const upperNoise = this.noiseP.generateNoise(
            null,
            originX, 0, originZ,
            sizeX, sizeY, sizeZ,
            684.412, 684.412, 684.412
        );

        const densities = new Float64Array(noiseLength);

        for (let x = 0; x < sizeX; x++) {
            for (let z = 0; z < sizeZ; z++) {
                const biome = getBiomeAverage(
                    biomeIds,
                    this.biomeWeights,
                    x,
                    z
                );

                let variation = variationNoise[x * sizeZ + z] / 8000.0;

                if (variation < 0) {
                    variation = -variation * 0.3;
                }

                variation = variation * 3.0 - 2.0;

                if (variation < 0) {
                    variation /= 2.0;

                    if (variation < -1.0) {
                        variation = -1.0;
                    }

                    variation /= 1.4;
                    variation /= 2.0;
                } else {
                    if (variation > 1.0) {
                        variation = 1.0;
                    }

                    variation /= 8.0;
                }

                let adjustedVariation =
                    (biome.height + variation * 0.2) *
                    sizeY / 16.0;

                const baseHeight =
                    sizeY / 2.0 + adjustedVariation * 4.0;

                for (let y = 0; y < sizeY; y++) {
                    const index = (x * sizeZ + z) * sizeY + y;

                    let vertical =
                        ((y - baseHeight) * 12.0 * WORLD_HEIGHT) /
                        WORLD_HEIGHT /
                        biome.variation;

                    if (vertical < 0) {
                        vertical *= 4.0;
                    }

                    const lower = lowerNoise[index] / 512.0;
                    const upper = upperNoise[index] / 512.0;

                    const blend =
                        (densityNoise[index] / 10.0 + 1.0) / 2.0;

                    let interpolated;

                    if (blend < 0) {
                        interpolated = lower;
                    } else if (blend > 1) {
                        interpolated = upper;
                    } else {
                        interpolated = lower +
                            (upper - lower) * blend;
                    }

                    let density = interpolated - vertical;

                    // Redução de densidade perto do teto do mundo.
                    if (y > sizeY - 4) {
                        const fade = Math.fround((y - (sizeY - 4)) / 3.0);

                        density =
                            density * (1.0 - fade) + (-10.0 * fade);
                    }

                    densities[index] = density;
                }
            }
        }

        return {
            chunkX,
            chunkZ,
            originX,
            originZ,
            sizeX,
            sizeY,
            sizeZ,
            densities
        };
    }
}

export function createTerrainDensityGenerator(seed) {
    return new TerrainDensityGenerator(seed);
}

export { BIOME_SHAPE, SEA_LEVEL, WORLD_HEIGHT };
