import {
    createTerrainDensityGenerator,
    SEA_LEVEL,
    WORLD_HEIGHT
} from './terrain.mjs';

import { createClimateQuery } from './climate.mjs';
import { applyTerrainSurface } from './terrain-surface.mjs';
import { generateForestTrees } from './tree-generation.mjs';

const CHUNK_SIZE = 16;

const BLOCK = {
    AIR: 0,
    STONE: 1,
    WATER: 9
};

export function interpolateDensityToBlocks(
    densityResult,
    {
        seaLevel = SEA_LEVEL,
        stoneId = BLOCK.STONE,
        waterId = BLOCK.WATER,
        airId = BLOCK.AIR
    } = {}
) {
    const { densities, sizeX, sizeY, sizeZ } = densityResult;

    if (sizeX !== 5 || sizeY !== 17 || sizeZ !== 5) {
        throw new Error('Grade de densidade incompatível.');
    }

    if (densities.length !== 425) {
        throw new Error(`Esperados 425 valores, recebidos ${densities.length}.`);
    }

    const blocks = new Uint8Array(
        CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT
    );

    const densityIndex = (x, z, y) =>
        (x * sizeZ + z) * sizeY + y;

    for (let cellX = 0; cellX < 4; cellX++) {
        for (let cellZ = 0; cellZ < 4; cellZ++) {
            for (let cellY = 0; cellY < 16; cellY++) {
                let d00 = densities[densityIndex(cellX, cellZ, cellY)];
                let d01 = densities[densityIndex(cellX, cellZ + 1, cellY)];
                let d10 = densities[densityIndex(cellX + 1, cellZ, cellY)];
                let d11 = densities[densityIndex(cellX + 1, cellZ + 1, cellY)];

                const dy00 = (densities[densityIndex(cellX, cellZ, cellY + 1)] - d00) * 0.125;
                const dy01 = (densities[densityIndex(cellX, cellZ + 1, cellY + 1)] - d01) * 0.125;
                const dy10 = (densities[densityIndex(cellX + 1, cellZ, cellY + 1)] - d10) * 0.125;
                const dy11 = (densities[densityIndex(cellX + 1, cellZ + 1, cellY + 1)] - d11) * 0.125;

                for (let subY = 0; subY < 8; subY++) {
                    let current0 = d00;
                    let current1 = d01;

                    const stepX0 = (d10 - d00) * 0.25;
                    const stepX1 = (d11 - d01) * 0.25;

                    for (let subX = 0; subX < 4; subX++) {
                        const stepZ = (current1 - current0) * 0.25;
                        let density = current0 - stepZ;

                        const worldX = cellX * 4 + subX;
                        const worldY = cellY * 8 + subY;

                        for (let subZ = 0; subZ < 4; subZ++) {
                            density += stepZ;

                            const worldZ = cellZ * 4 + subZ;
                            const index =
                                worldX * 2048 +
                                worldZ * 128 +
                                worldY;

                            if (density > 0) {
                                blocks[index] = stoneId;
                            } else if (worldY < seaLevel) {
                                blocks[index] = waterId;
                            } else {
                                blocks[index] = airId;
                            }
                        }

                        current0 += stepX0;
                        current1 += stepX1;
                    }

                    d00 += dy00;
                    d01 += dy01;
                    d10 += dy10;
                    d11 += dy11;
                }
            }
        }
    }

    return blocks;
}

export function createTerrainChunkGenerator(seed, { grassPixels } = {}) {
    const densityGenerator = createTerrainDensityGenerator(seed);
    const climateQuery = createClimateQuery(seed, { grassPixels });

    return {
        generateChunk(chunkX, chunkZ, biomeIds = null) {
            const densityBiomes = biomeIds ?? climateQuery.region(
                chunkX * 4 - 2,
                chunkZ * 4 - 2,
                10,
                10
            ).biomeIds;

            const density = densityGenerator.generateDensity(
                chunkX,
                chunkZ,
                densityBiomes
            );

            const blocks = interpolateDensityToBlocks(density);

            const climate = climateQuery.region(
                chunkX * 16,
                chunkZ * 16,
                16,
                16
            );

            applyTerrainSurface({
                blocks,
                chunkX,
                chunkZ,
                noiseGenerator: densityGenerator.noiseR,
                biomeIds: climate.biomeIds,
                temperatures: climate.temperature,
                seed
            });

            const metadata = generateForestTrees({
                blocks,
                biomeIds: climate.biomeIds,
                chunkX,
                chunkZ,
                seed
            });

            return {
                chunkX,
                chunkZ,
                originX: chunkX * 16,
                originZ: chunkZ * 16,
                width: CHUNK_SIZE,
                depth: CHUNK_SIZE,
                height: WORLD_HEIGHT,
                blocks,
                metadata,
                biomeIds: climate.biomeIds,
                grassColors: climate.grass
            };
        }
    };
}
