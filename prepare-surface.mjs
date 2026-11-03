import { writeFileSync } from 'node:fs';
import { createTerrainDensityGenerator } from './terrain.mjs';
import { createClimateQuery } from './climate.mjs';
import { interpolateDensityToBlocks } from './terrain-chunk.mjs';
import { applyTerrainSurface } from './terrain-surface.mjs';

const seed = 12345;
const cx = 0;
const cz = 0;

const densityGen = createTerrainDensityGenerator(seed);
const density = densityGen.generateDensity(
    cx, cz, new Uint8Array(100).fill(1)
);

const blocks = interpolateDensityToBlocks(density);
const climate = createClimateQuery(seed).region(
    cx * 16, cz * 16, 16, 16
);

writeFileSync('/tmp/opencode/surface-base-js.bin', blocks);
writeFileSync(
    '/tmp/opencode/surface-biomes.bin',
    Uint8Array.from(climate.biomeIds)
);

const temperatureBytes = Buffer.alloc(256 * 4);
for (let i = 0; i < 256; i++) {
    temperatureBytes.writeFloatLE(climate.temperature[i], i * 4);
}
writeFileSync('/tmp/opencode/surface-temperatures.bin', temperatureBytes);

applyTerrainSurface({
    blocks,
    chunkX: cx,
    chunkZ: cz,
    noiseGenerator: densityGen.noiseR,
    biomeIds: climate.biomeIds,
    temperatures: climate.temperature
});

writeFileSync('/tmp/opencode/surface-js.bin', blocks);
console.log('Preparação JS concluída.');
