const MULTIPLIER = 0x5DEECE66Dn;
const ADDEND = 0xBn;
const MASK = (1n << 48n) - 1n;

export class JavaRandom {
    constructor(seed) {
        this.setSeed(seed);
    }

    setSeed(seed) {
        this.seed = (
            BigInt.asUintN(64, BigInt(seed)) ^ MULTIPLIER
        ) & MASK;
    }

    next(bits) {
        if (!Number.isInteger(bits) || bits < 1 || bits > 32) {
            throw new RangeError('bits deve estar entre 1 e 32.');
        }

        this.seed = (
            this.seed * MULTIPLIER + ADDEND
        ) & MASK;

        return Number(this.seed >> BigInt(48 - bits));
    }

    nextInt(bound) {
        if (!Number.isInteger(bound) || bound <= 0 || bound > 0x7fffffff) {
            throw new RangeError('bound inválido.');
        }

        if ((bound & -bound) === bound) {
            return Math.floor((bound * this.next(31)) / 0x80000000);
        }

        let bits;
        let value;

        do {
            bits = this.next(31);
            value = bits % bound;
        } while (((bits - value + (bound - 1)) | 0) < 0);

        return value;
    }

    nextDouble() {
        const high = BigInt(this.next(26));
        const low = BigInt(this.next(27));

        return Number((high << 27n) + low) / 9007199254740992;
    }
}
