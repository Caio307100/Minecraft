import { createTerrainDensityGenerator } from './terrain.mjs';

const seed = BigInt(process.argv[2] ?? '12345');
const biomeId = Number(process.argv[3] ?? '1');

const generator = createTerrainDensityGenerator(seed);
const result = generator.generateDensity(
    0, 0, new Array(100).fill(biomeId)
);

for (const value of result.densities) {
    console.log(value.toPrecision(17));
}
