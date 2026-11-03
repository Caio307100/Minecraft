import { JavaRandom } from './java-random.mjs';

const PERMUTATION_SIZE = 256;
const COORDINATE_WRAP = 16777216;

function fade(t) {
    const t3 = t * t * t;
    return t3 * (t * (t * 6 - 15) + 10);
}

function lerp(t, a, b) {
    return a + t * (b - a);
}

function grad2(hash, x, z) {
    const h = hash & 15;
    const u = (1 - ((h & 8) >> 3)) * x;
    const v = h < 4 ? 0 : (h === 12 || h === 14 ? x : z);

    return ((h & 1) === 0 ? u : -u) +
           ((h & 2) === 0 ? v : -v);
}

function grad3(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);

    return ((h & 1) === 0 ? u : -u) +
           ((h & 2) === 0 ? v : -v);
}

export class PerlinNoise {
    constructor(random) {
        if (!(random instanceof JavaRandom)) {
            throw new TypeError('Esperado uma instância de JavaRandom.');
        }

        this.xOffset = random.nextDouble() * 256;
        this.yOffset = random.nextDouble() * 256;
        this.zOffset = random.nextDouble() * 256;

        this.permutation = new Int32Array(512);

        for (let i = 0; i < PERMUTATION_SIZE; i++) {
            this.permutation[i] = i;
        }

        for (let i = 0; i < PERMUTATION_SIZE; i++) {
            const j = i + random.nextInt(PERMUTATION_SIZE - i);

            const temporary = this.permutation[i];
            this.permutation[i] = this.permutation[j];
            this.permutation[j] = temporary;

            this.permutation[i + PERMUTATION_SIZE] = this.permutation[i];
        }
    }

    generateNoise(
        output,
        x, y, z,
        sizeX, sizeY, sizeZ,
        scaleX, scaleY, scaleZ,
        amplitude
    ) {
        if (!(output instanceof Float64Array)) {
            throw new TypeError('output deve ser Float64Array.');
        }

        const expectedLength = sizeX * sizeY * sizeZ;

        if (output.length < expectedLength) {
            throw new RangeError('Array de saída pequeno demais.');
        }

        const inverseAmplitude = 1 / amplitude;
        const p = this.permutation;
        let index = 0;

        // Caminho 2D original: sizeY == 1.
        if (sizeY === 1) {
            for (let xi = 0; xi < sizeX; xi++) {
                const xCoord = x + xi * scaleX + this.xOffset;
                const floorX = Math.floor(xCoord);
                const X = floorX & 255;
                const localX = xCoord - floorX;
                const fadeX = fade(localX);

                for (let zi = 0; zi < sizeZ; zi++) {
                    const zCoord = z + zi * scaleZ + this.zOffset;
                    const floorZ = Math.floor(zCoord);
                    const Z = floorZ & 255;
                    const localZ = zCoord - floorZ;
                    const fadeZ = fade(localZ);

                    const a = p[X];
                    const aa = p[a] + Z;

                    const b = p[X + 1];
                    const bb = p[b] + Z;

                    // Mantém inclusive a chamada mista de gradientes
                    // observada no bytecode original de Minecraft 1.0.
                    const near = lerp(
                        fadeX,
                        grad2(p[aa], localX, localZ),
                        grad3(p[bb], localX - 1, 0, localZ)
                    );

                    const far = lerp(
                        fadeX,
                        grad3(p[aa + 1], localX, 0, localZ - 1),
                        grad3(p[bb + 1], localX - 1, 0, localZ - 1)
                    );

                    output[index++] += lerp(fadeZ, near, far) * inverseAmplitude;
                }
            }

            return output;
        }

        // Caminho 3D original.
        for (let xi = 0; xi < sizeX; xi++) {
            const xCoord = x + xi * scaleX + this.xOffset;
            const floorX = Math.floor(xCoord);
            const X = floorX & 255;
            const localX = xCoord - floorX;
            const fadeX = fade(localX);

            for (let zi = 0; zi < sizeZ; zi++) {
                const zCoord = z + zi * scaleZ + this.zOffset;
                const floorZ = Math.floor(zCoord);
                const Z = floorZ & 255;
                const localZ = zCoord - floorZ;
                const fadeZ = fade(localZ);

                let cachedY = -1;
                let x00, x10, x01, x11;

                for (let yi = 0; yi < sizeY; yi++) {
                    const yCoord = y + yi * scaleY + this.yOffset;
                    const floorY = Math.floor(yCoord);
                    const Y = floorY & 255;
                    const localY = yCoord - floorY;
                    const fadeY = fade(localY);

                    if (yi === 0 || Y !== cachedY) {
                        cachedY = Y;

                        const a = p[X] + Y;
                        const b = p[X + 1] + Y;

                        const aa = p[a] + Z;
                        const ab = p[a + 1] + Z;
                        const ba = p[b] + Z;
                        const bb = p[b + 1] + Z;

                        x00 = lerp(
                            fadeX,
                            grad3(p[aa], localX, localY, localZ),
                            grad3(p[ba], localX - 1, localY, localZ)
                        );

                        x10 = lerp(
                            fadeX,
                            grad3(p[ab], localX, localY - 1, localZ),
                            grad3(p[bb], localX - 1, localY - 1, localZ)
                        );

                        x01 = lerp(
                            fadeX,
                            grad3(p[aa + 1], localX, localY, localZ - 1),
                            grad3(p[ba + 1], localX - 1, localY, localZ - 1)
                        );

                        x11 = lerp(
                            fadeX,
                            grad3(p[ab + 1], localX, localY - 1, localZ - 1),
                            grad3(p[bb + 1], localX - 1, localY - 1, localZ - 1)
                        );
                    }

                    const near = lerp(fadeY, x00, x10);
                    const far = lerp(fadeY, x01, x11);

                    output[index++] += lerp(fadeZ, near, far) * inverseAmplitude;
                }
            }
        }

        return output;
    }
}

export class NoiseOctaves {
    constructor(random, octaveCount) {
        if (!(random instanceof JavaRandom)) {
            throw new TypeError('Esperado uma instância de JavaRandom.');
        }

        if (!Number.isInteger(octaveCount) || octaveCount <= 0) {
            throw new RangeError('Quantidade de oitavas inválida.');
        }

        this.generators = Array.from(
            { length: octaveCount },
            () => new PerlinNoise(random)
        );
    }

    generateNoise(
        output,
        x, y, z,
        sizeX, sizeY, sizeZ,
        scaleX, scaleY, scaleZ
    ) {
        const requiredLength = sizeX * sizeY * sizeZ;

        if (output === null || output === undefined) {
            output = new Float64Array(requiredLength);
        } else {
            if (!(output instanceof Float64Array) ||
                output.length < requiredLength) {
                throw new RangeError('Array de saída incompatível.');
            }

            output.fill(0, 0, requiredLength);
        }

        let frequency = 1;

        for (const generator of this.generators) {

            let octaveX = x * frequency * scaleX;
            const octaveY = y * frequency * scaleY;
            let octaveZ = z * frequency * scaleZ;

            const floorX = Math.floor(octaveX);
            const floorZ = Math.floor(octaveZ);

            octaveX = octaveX - floorX + (floorX % COORDINATE_WRAP);
            octaveZ = octaveZ - floorZ + (floorZ % COORDINATE_WRAP);

            generator.generateNoise(
                output,
                octaveX, octaveY, octaveZ,
                sizeX, sizeY, sizeZ,
                scaleX * frequency,
                scaleY * frequency,
                scaleZ * frequency,
                frequency
            );

            frequency /= 2;
        }

        return output;
    }

    generateNoise2D(
        output,
        x, z,
        sizeX, sizeZ,
        scaleX, scaleZ
    ) {
        return this.generateNoise(
            output,
            x, 10, z,
            sizeX, 1, sizeZ,
            scaleX, 1, scaleZ
        );
    }
}
