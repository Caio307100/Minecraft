import { JavaRandom } from './java-random.mjs';
import { NoiseOctaves } from './noise.mjs';

const [seed, octaves, mode] = process.argv.slice(2);
const noise = new NoiseOctaves(new JavaRandom(BigInt(seed)), Number(octaves));

const values = mode === '2d'
    ? noise.generateNoise2D(null, -3, 7, 4, 3, 0.0625, 0.0625)
    : noise.generateNoise(null, -3, 5, 7, 3, 2, 3, 0.0625, 0.125, 0.0625);

for (const value of values) console.log(value.toPrecision(17));
