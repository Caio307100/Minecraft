/**
 * Porte das camadas de geração (GenLayer) de Minecraft Java 1.0.
 *
 * Nomes obfuscados confirmados por bytecode:
 *   jx  -> GenLayer
 *   aib -> GenLayerIsland
 *   gn  -> GenLayerFuzzyZoom
 *   tv  -> GenLayerAddIsland
 *   hv  -> GenLayerAddSnow
 *   aas -> GenLayerRareBiome
 *   act -> GenLayerZoom
 *   jw  -> GenLayerSmoothZoom (usada nas cadeias de temperatura/chuva)
 *   sp  -> GenLayerRiverInit
 *   xu  -> GenLayerRiver
 *   acn -> GenLayerSmooth
 *   afa -> GenLayerBiome
 *   afc -> GenLayerTemperature
 *   afd -> GenLayerRainfall
 *   zy  -> GenLayerShore
 *   rk  -> GenLayerTemperatureMix
 *   mh  -> GenLayerRainfallMix
 *   na  -> GenLayerRiverMix
 *   df  -> GenLayerVoronoiZoom
 *
 * A aritmética de `long` do Java é reproduzida com BigInt e
 * BigInt.asIntN(64, ...). Em particular, `b(long)` (initWorldGenSeed)
 * desce recursivamente apenas pelo campo `a` (parent). Camadas com mais
 * de um pai, como `rk`/`mh`, não sobrescrevem esse método; por isso o
 * segundo ramo não recebe a semente recursivamente. Essa assimetria é
 * intencional e deve ser mantida.
 */

const MULTIPLIER = 6364136223846793005n;
const ADDEND = 1442695040888963407n;
const LONG_BITS = 64;
const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;

/** IDs de bioma (`sr.F`) usados pelas camadas de 1.0. */
const BIOME_OCEAN = 0;
const BIOME_PLAINS = 1;
const BIOME_DESERT = 2;
const BIOME_EXTREME_HILLS = 3;
const BIOME_FOREST = 4;
const BIOME_TAIGA = 5;
const BIOME_SWAMPLAND = 6;
const BIOME_RIVER = 7;
const BIOME_FROZEN_OCEAN = 10;
const BIOME_FROZEN_RIVER = 11;
const BIOME_ICE_PLAINS = 12;
const BIOME_MUSHROOM_ISLAND = 14;
const BIOME_MUSHROOM_ISLAND_SHORE = 15;

/**
 * Escolhas de `afa` na ordem do original:
 * `sr.d, sr.f, sr.e, sr.h, sr.c, sr.g`.
 */
const BIOME_CHOICES = [
  BIOME_DESERT,
  BIOME_FOREST,
  BIOME_EXTREME_HILLS,
  BIOME_SWAMPLAND,
  BIOME_PLAINS,
  BIOME_TAIGA,
];

/**
 * `sr.f()` e `sr.e()`: temperatura e chuva multiplicadas por 65536 e
 * truncadas para int. Índices 0..15 são os biomas do gerador de 1.0.
 */
const BIOME_TEMPERATURE = [
  32768, 52428, 131072, 13107, 45875, 19660, 52428, 32768,
  131072, 32768, 0, 0, 0, 0, 58982, 58982,
];
const BIOME_RAINFALL = [
  32768, 26214, 0, 19660, 52428, 52428, 58982, 32768,
  0, 32768, 32768, 32768, 32768, 32768, 65536, 65536,
];

function biomeTableValue(table, id, label) {
  if (!Number.isInteger(id) || id < 0 || id >= table.length) {
    throw new RangeError(`${label} não conhece o bioma ${id}.`);
  }

  return table[id];
}

function toLong(value, label = 'semente') {
  if (typeof value === 'bigint') return BigInt.asIntN(64, value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return BigInt.asIntN(64, BigInt(value));
  }
  throw new TypeError(`${label} precisa ser um inteiro de 64 bits (bigint ou number seguro).`);
}

function assertInt32(value, label) {
  if (!Number.isInteger(value) || value < INT32_MIN || value > INT32_MAX) {
    throw new RangeError(`${label} precisa ser um inteiro de 32 bits.`);
  }
}

function assertDimension(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > INT32_MAX) {
    throw new RangeError(`${label} precisa ser um inteiro não negativo de 32 bits.`);
  }
}

function assertParent(parent) {
  if (!(parent instanceof GenLayer)) {
    throw new TypeError('parent precisa ser uma instância de GenLayer.');
  }
}

/** Combina o estado atual com o LCG do Java: x * (x * MULT + ADD). */
function advance(seed) {
  return BigInt.asIntN(LONG_BITS, seed * BigInt.asIntN(LONG_BITS, seed * MULTIPLIER + ADDEND));
}

/** Interpolação inteira de `jw`: delta * rand / 256 com truncamento do Java. */
function lerp(from, to, rand) {
  const delta = (to - from) | 0;
  const scaled = Math.trunc(Math.imul(delta, rand) / 256);
  return (from + scaled) | 0;
}

export class GenLayer {
  constructor(seed) {
    /** Campo `a` do original. Só este ramo é percorrido por initWorldGenSeed. */
    this.parent = null;
    /** Campo `b` do original. */
    this.worldSeed = 0n;
    /** Campo `c` do original. */
    this.chunkSeed = 0n;

    const base = toLong(seed);
    let mixed = base;

    for (let i = 0; i < 3; i += 1) {
      mixed = BigInt.asIntN(LONG_BITS, advance(mixed) + base);
    }

    /** Campo `d` do original. */
    this.baseSeed = mixed;
  }

  /**
   * `jx.b(long)`: grava a semente, propaga para o pai e só então mistura.
   * A recursão acontece antes das três rodadas do LCG.
   */
  initWorldGenSeed(seed) {
    const value = toLong(seed);

    this.worldSeed = value;

    // Apenas o campo `a`. Pais secundários (ex.: o ramo de temperatura em
    // rk/mh) não são semeados, pois aquelas classes não sobrescrevem b(long).
    if (this.parent !== null) {
      this.parent.initWorldGenSeed(value);
    }

    let mixed = this.worldSeed;

    for (let i = 0; i < 3; i += 1) {
      mixed = BigInt.asIntN(LONG_BITS, advance(mixed) + this.baseSeed);
    }

    this.worldSeed = mixed;
  }

  /** `jx.a(long, long)`: quatro rodadas, alternando +x, +z, +x, +z. */
  initChunkSeed(x, z) {
    const chunkX = toLong(x, 'x');
    const chunkZ = toLong(z, 'z');

    let mixed = this.worldSeed;
    mixed = BigInt.asIntN(LONG_BITS, advance(mixed) + chunkX);
    mixed = BigInt.asIntN(LONG_BITS, advance(mixed) + chunkZ);
    mixed = BigInt.asIntN(LONG_BITS, advance(mixed) + chunkX);
    mixed = BigInt.asIntN(LONG_BITS, advance(mixed) + chunkZ);

    this.chunkSeed = mixed;
  }

  /** `jx.a(int)`: resto truncado do Java, corrigido para não negativo. */
  nextInt(bound) {
    if (!Number.isInteger(bound) || bound <= 0 || bound > INT32_MAX) {
      throw new RangeError('bound precisa ser um inteiro positivo de 32 bits.');
    }

    let value = Number((this.chunkSeed >> 24n) % BigInt(bound));

    if (value < 0) value += bound;

    this.chunkSeed = BigInt.asIntN(
      LONG_BITS,
      advance(this.chunkSeed) + this.worldSeed,
    );

    return value;
  }

  /** `jx.a(int, int, int, int)`, implementado pelas subclasses. */
  getInts() {
    throw new Error('GenLayer.getInts() precisa ser implementado pela subclasse.');
  }
}

/**
 * `aib` -> GenLayerIsland. Camada-fonte: 10% de chance de terra por célula,
 * com o centro do mapa forçado para terra quando a janela cobre a origem.
 */
export class GenLayerIsland extends GenLayer {
  getInts(areaX, areaY, areaWidth, areaHeight) {
    assertInt32(areaX, 'areaX');
    assertInt32(areaY, 'areaY');
    assertDimension(areaWidth, 'areaWidth');
    assertDimension(areaHeight, 'areaHeight');

    const out = new Array(areaWidth * areaHeight);

    for (let j = 0; j < areaHeight; j += 1) {
      for (let i = 0; i < areaWidth; i += 1) {
        this.initChunkSeed(areaX + i, areaY + j);
        out[i + j * areaWidth] = this.nextInt(10) === 0 ? 1 : 0;
      }
    }

    // `aib` força terra na célula que contém a origem, mas somente quando a
    // janela realmente a cobre: areaX > -width && areaX <= 0 (idem para Y).
    if (
      areaX > -areaWidth
      && areaX <= 0
      && areaY > -areaHeight
      && areaY <= 0
    ) {
      out[-areaX + -areaY * areaWidth] = 1;
    }

    return out;
  }
}

/**
 * `tv` -> GenLayerAddIsland.
 *
 * Consulta as quatro diagonais do pai, na ordem fixa:
 *   a = (0,0), b = (2,0), c = (0,2), d = (2,2)
 * e o centro em (1,1), numa janela pai de (x-1, y-1, w+2, h+2).
 *
 * A ordem das diagonais e das chamadas nextInt é significativa: alterá-la
 * muda o mapa. Detalhes confirmados no bytecode de 1.0:
 * - centro == 0 e alguma diagonal != 0: amostragem tipo reservoir com um
 *   contador que começa em 1 e só avança nas diagonais não nulas, seguida
 *   de nextInt(3) para decidir entre a diagonal escolhida, 0 ou sr.l.
 * - centro > 0 e alguma diagonal == 0: nextInt(5) == 0 remove a terra;
 *   se todas as diagonais forem não nulas, nextInt(5) NÃO é chamado.
 * - centro <= 0: mantém o centro.
 */
export class GenLayerAddIsland extends GenLayer {
  constructor(seed, parent) {
    super(seed);
    assertParent(parent);
    this.parent = parent;
  }

  getInts(areaX, areaY, areaWidth, areaHeight) {
    assertInt32(areaX, 'areaX');
    assertInt32(areaY, 'areaY');
    assertDimension(areaWidth, 'areaWidth');
    assertDimension(areaHeight, 'areaHeight');

    const x = areaX - 1;
    const y = areaY - 1;
    const width = areaWidth + 2;
    const height = areaHeight + 2;
    const base = this.parent.getInts(x, y, width, height);
    const out = new Array(areaWidth * areaHeight);

    for (let j = 0; j < areaHeight; j += 1) {
      for (let i = 0; i < areaWidth; i += 1) {
        const a = base[i + j * width];
        const b = base[i + 2 + j * width];
        const c = base[i + (j + 2) * width];
        const d = base[i + 2 + (j + 2) * width];
        const center = base[i + 1 + (j + 1) * width];
        const index = i + j * areaWidth;

        this.initChunkSeed(areaX + i, areaY + j);

        if (center === 0) {
          if (a === 0 && b === 0 && c === 0 && d === 0) {
            out[index] = center;
            continue;
          }

          // `i1` (contador) e `j1` (escolha) começam em 1. O contador só
          // incrementa para diagonais não nulas; logo a primeira diagonal
          // não nula usa nextInt(1).
          let count = 1;
          let chosen = 1;

          if (a !== 0 && this.nextInt(count++) === 0) chosen = a;
          if (b !== 0 && this.nextInt(count++) === 0) chosen = b;
          if (c !== 0 && this.nextInt(count++) === 0) chosen = c;
          if (d !== 0 && this.nextInt(count++) === 0) chosen = d;

          if (this.nextInt(3) === 0) {
            out[index] = chosen;
          } else if (chosen === BIOME_ICE_PLAINS) {
            // sr.n (Ice Plains) vira sr.l (Frozen Ocean).
            out[index] = BIOME_FROZEN_OCEAN;
          } else {
            out[index] = 0;
          }

          continue;
        }

        if (center > 0) {
          // Repare: o teste é "alguma diagonal oceânica". Quando todas as
          // diagonais são não nulas, nextInt(5) não é consumido.
          if (a === 0 || b === 0 || c === 0 || d === 0) {
            if (this.nextInt(5) === 0) {
              out[index] = center === BIOME_ICE_PLAINS
                ? BIOME_FROZEN_OCEAN
                : 0;
            } else {
              out[index] = center;
            }
          } else {
            out[index] = center;
          }

          continue;
        }

        out[index] = center;
      }
    }

    return out;
  }
}

/**
 * `hv` -> GenLayerAddSnow. Para cada célula não oceânica, sorteia
 * nextInt(5): zero vira Ice Plains (12), qualquer outro valor vira
 * Plains (1). Células oceânicas permanecem 0.
 */
export class GenLayerAddSnow extends GenLayer {
  constructor(seed, parent) {
    super(seed);
    assertParent(parent);
    this.parent = parent;
  }

  getInts(areaX, areaY, areaWidth, areaHeight) {
    assertInt32(areaX, 'areaX');
    assertInt32(areaY, 'areaY');
    assertDimension(areaWidth, 'areaWidth');
    assertDimension(areaHeight, 'areaHeight');

    const x = areaX - 1;
    const y = areaY - 1;
    const width = areaWidth + 2;
    const height = areaHeight + 2;
    const base = this.parent.getInts(x, y, width, height);
    const out = new Array(areaWidth * areaHeight);

    for (let j = 0; j < areaHeight; j += 1) {
      for (let i = 0; i < areaWidth; i += 1) {
        const center = base[i + 1 + (j + 1) * width];

        this.initChunkSeed(areaX + i, areaY + j);

        if (center === 0) {
          out[i + j * areaWidth] = 0;
        } else {
          out[i + j * areaWidth] = this.nextInt(5) === 0
            ? BIOME_ICE_PLAINS
            : BIOME_PLAINS;
        }
      }
    }

    return out;
  }
}

/**
 * `aas` -> GenLayerRareBiome. Célula totalmente oceânica (centro e as
 * quatro diagonais iguais a 0) tem 1% de chance de virar Mushroom Island.
 */
export class GenLayerRareBiome extends GenLayer {
  constructor(seed, parent) {
    super(seed);
    assertParent(parent);
    this.parent = parent;
  }

  getInts(areaX, areaY, areaWidth, areaHeight) {
    assertInt32(areaX, 'areaX');
    assertInt32(areaY, 'areaY');
    assertDimension(areaWidth, 'areaWidth');
    assertDimension(areaHeight, 'areaHeight');

    const x = areaX - 1;
    const y = areaY - 1;
    const width = areaWidth + 2;
    const height = areaHeight + 2;
    const base = this.parent.getInts(x, y, width, height);
    const out = new Array(areaWidth * areaHeight);

    for (let j = 0; j < areaHeight; j += 1) {
      for (let i = 0; i < areaWidth; i += 1) {
        const a = base[i + j * width];
        const b = base[i + 2 + j * width];
        const c = base[i + (j + 2) * width];
        const d = base[i + 2 + (j + 2) * width];
        const center = base[i + 1 + (j + 1) * width];

        this.initChunkSeed(areaX + i, areaY + j);

        if (
          center === 0
          && a === 0
          && b === 0
          && c === 0
          && d === 0
          && this.nextInt(100) === 0
        ) {
          out[i + j * areaWidth] = BIOME_MUSHROOM_ISLAND;
        } else {
          out[i + j * areaWidth] = center;
        }
      }
    }

    return out;
  }
}

/**
 * `sp` -> GenLayerRiverInit. Células de terra recebem um identificador de
 * rio em {2, 3}; células oceânicas permanecem 0.
 */
export class GenLayerRiverInit extends GenLayer {
  constructor(seed, parent) {
    super(seed);
    assertParent(parent);
    this.parent = parent;
  }

  getInts(areaX, areaY, areaWidth, areaHeight) {
    assertInt32(areaX, 'areaX');
    assertInt32(areaY, 'areaY');
    assertDimension(areaWidth, 'areaWidth');
    assertDimension(areaHeight, 'areaHeight');

    const base = this.parent.getInts(areaX, areaY, areaWidth, areaHeight);
    const out = new Array(areaWidth * areaHeight);

    for (let j = 0; j < areaHeight; j += 1) {
      for (let i = 0; i < areaWidth; i += 1) {
        this.initChunkSeed(areaX + i, areaY + j);

        const index = i + j * areaWidth;
        out[index] = base[index] > 0 ? this.nextInt(2) + 2 : 0;
      }
    }

    return out;
  }
}

/**
 * `xu` -> GenLayerRiver. Marca como River (7) toda célula cujo centro ou
 * algum vizinho cardinal seja oceânico; se o centro e os quatro cardinais
 * forem iguais, marca -1 (sem rio). A janela pai é (x-1, y-1, w+2, h+2).
 */
export class GenLayerRiver extends GenLayer {
  constructor(seed, parent) {
    super(seed);
    assertParent(parent);
    this.parent = parent;
  }

  getInts(areaX, areaY, areaWidth, areaHeight) {
    assertInt32(areaX, 'areaX');
    assertInt32(areaY, 'areaY');
    assertDimension(areaWidth, 'areaWidth');
    assertDimension(areaHeight, 'areaHeight');

    const x = areaX - 1;
    const y = areaY - 1;
    const width = areaWidth + 2;
    const height = areaHeight + 2;
    const base = this.parent.getInts(x, y, width, height);
    const out = new Array(areaWidth * areaHeight);

    for (let j = 0; j < areaHeight; j += 1) {
      for (let i = 0; i < areaWidth; i += 1) {
        const left = base[i + (j + 1) * width];
        const right = base[i + 2 + (j + 1) * width];
        const top = base[i + 1 + j * width];
        const bottom = base[i + 1 + (j + 2) * width];
        const center = base[i + 1 + (j + 1) * width];

        const allEqual = center === left
          && center === top
          && center === right
          && center === bottom;

        out[i + j * areaWidth] = (
          center === 0
          || left === 0
          || right === 0
          || top === 0
          || bottom === 0
          || !allEqual
        ) ? BIOME_RIVER : -1;
      }
    }

    return out;
  }
}

/**
 * `acn` -> GenLayerSmooth. Suaviza horizontal/verticalmente; quando os dois
 * pares opostos coincidem, nextInt(2) escolhe entre eles.
 */
export class GenLayerSmooth extends GenLayer {
  constructor(seed, parent) {
    super(seed);
    assertParent(parent);
    this.parent = parent;
  }

  getInts(areaX, areaY, areaWidth, areaHeight) {
    assertInt32(areaX, 'areaX');
    assertInt32(areaY, 'areaY');
    assertDimension(areaWidth, 'areaWidth');
    assertDimension(areaHeight, 'areaHeight');

    const x = areaX - 1;
    const y = areaY - 1;
    const width = areaWidth + 2;
    const height = areaHeight + 2;
    const base = this.parent.getInts(x, y, width, height);
    const out = new Array(areaWidth * areaHeight);

    for (let j = 0; j < areaHeight; j += 1) {
      for (let i = 0; i < areaWidth; i += 1) {
        const left = base[i + (j + 1) * width];
        const right = base[i + 2 + (j + 1) * width];
        const top = base[i + 1 + j * width];
        const bottom = base[i + 1 + (j + 2) * width];
        let value = base[i + 1 + (j + 1) * width];

        if (left === right && top === bottom) {
          this.initChunkSeed(areaX + i, areaY + j);
          value = this.nextInt(2) === 0 ? left : top;
        } else {
          if (left === right) value = left;
          // O segundo teste sobrescreve o primeiro, como no bytecode.
          if (top === bottom) value = top;
        }

        out[i + j * areaWidth] = value;
      }
    }

    return out;
  }
}

/**
 * `afa` -> GenLayerBiome. Oceano permanece oceano, Mushroom Island é
 * preservada, Plains vira uma das seis escolhas de BIOME_CHOICES e qualquer
 * outro bioma vira Ice Plains.
 */
export class GenLayerBiome extends GenLayer {
  constructor(seed, parent) {
    super(seed);
    assertParent(parent);
    this.parent = parent;
  }

  getInts(areaX, areaY, areaWidth, areaHeight) {
    assertInt32(areaX, 'areaX');
    assertInt32(areaY, 'areaY');
    assertDimension(areaWidth, 'areaWidth');
    assertDimension(areaHeight, 'areaHeight');

    const base = this.parent.getInts(areaX, areaY, areaWidth, areaHeight);
    const out = new Array(areaWidth * areaHeight);

    for (let j = 0; j < areaHeight; j += 1) {
      for (let i = 0; i < areaWidth; i += 1) {
        this.initChunkSeed(areaX + i, areaY + j);

        const index = i + j * areaWidth;
        const value = base[index];

        if (value === BIOME_OCEAN) {
          out[index] = BIOME_OCEAN;
        } else if (value === BIOME_MUSHROOM_ISLAND) {
          out[index] = value;
        } else if (value === BIOME_PLAINS) {
          out[index] = BIOME_CHOICES[this.nextInt(BIOME_CHOICES.length)];
        } else {
          out[index] = BIOME_ICE_PLAINS;
        }
      }
    }

    return out;
  }
}

/**
 * `afc` -> GenLayerTemperature. Constrói sem semente (super(0)) e mapeia
 * cada bioma para `sr.f()` (temperatura escalada por 65536).
 */
export class GenLayerTemperature extends GenLayer {
  constructor(parent) {
    super(0n);
    assertParent(parent);
    this.parent = parent;
  }

  getInts(areaX, areaY, areaWidth, areaHeight) {
    assertInt32(areaX, 'areaX');
    assertInt32(areaY, 'areaY');
    assertDimension(areaWidth, 'areaWidth');
    assertDimension(areaHeight, 'areaHeight');

    const base = this.parent.getInts(areaX, areaY, areaWidth, areaHeight);
    const out = new Array(areaWidth * areaHeight);

    for (let i = 0; i < base.length; i += 1) {
      out[i] = biomeTableValue(BIOME_TEMPERATURE, base[i], 'GenLayerTemperature');
    }

    return out;
  }
}

/**
 * `afd` -> GenLayerRainfall. Análoga a `afc`, mas usa `sr.e()` (chuva).
 */
export class GenLayerRainfall extends GenLayer {
  constructor(parent) {
    super(0n);
    assertParent(parent);
    this.parent = parent;
  }

  getInts(areaX, areaY, areaWidth, areaHeight) {
    assertInt32(areaX, 'areaX');
    assertInt32(areaY, 'areaY');
    assertDimension(areaWidth, 'areaWidth');
    assertDimension(areaHeight, 'areaHeight');

    const base = this.parent.getInts(areaX, areaY, areaWidth, areaHeight);
    const out = new Array(areaWidth * areaHeight);

    for (let i = 0; i < base.length; i += 1) {
      out[i] = biomeTableValue(BIOME_RAINFALL, base[i], 'GenLayerRainfall');
    }

    return out;
  }
}

/**
 * `zy` -> GenLayerShore. Mushroom Island cercada por oceano vira
 * Mushroom Island Shore (15).
 */
export class GenLayerShore extends GenLayer {
  constructor(seed, parent) {
    super(seed);
    assertParent(parent);
    this.parent = parent;
  }

  getInts(areaX, areaY, areaWidth, areaHeight) {
    assertInt32(areaX, 'areaX');
    assertInt32(areaY, 'areaY');
    assertDimension(areaWidth, 'areaWidth');
    assertDimension(areaHeight, 'areaHeight');

    const x = areaX - 1;
    const y = areaY - 1;
    const width = areaWidth + 2;
    const height = areaHeight + 2;
    const base = this.parent.getInts(x, y, width, height);
    const out = new Array(areaWidth * areaHeight);

    for (let j = 0; j < areaHeight; j += 1) {
      for (let i = 0; i < areaWidth; i += 1) {
        const center = base[i + 1 + (j + 1) * width];
        const index = i + j * areaWidth;

        this.initChunkSeed(areaX + i, areaY + j);

        if (center === BIOME_MUSHROOM_ISLAND) {
          const left = base[i + (j + 1) * width];
          const right = base[i + 2 + (j + 1) * width];
          const top = base[i + 1 + j * width];
          const bottom = base[i + 1 + (j + 2) * width];

          out[index] = (
            left === BIOME_OCEAN
            || right === BIOME_OCEAN
            || top === BIOME_OCEAN
            || bottom === BIOME_OCEAN
          ) ? BIOME_MUSHROOM_ISLAND_SHORE : center;
        } else {
          out[index] = center;
        }
      }
    }

    return out;
  }
}

/**
 * `rk` -> mistura de temperatura. O campo `b` do original recebe a camada
 * de temperatura (primeiro argumento) e o campo `a` a camada de bioma
 * (segundo argumento). Como `jx.b(long)` só desce pelo campo `a`, a camada
 * de temperatura NÃO recebe initWorldGenSeed por este caminho.
 *
 * out = temperatura + (temperaturaDoBioma - temperatura) / (2 * step + 1)
 */
export class GenLayerTemperatureMix extends GenLayer {
  constructor(secondary, parent, step) {
    super(0n);
    assertParent(secondary);
    assertParent(parent);
    if (!Number.isInteger(step) || step < 0) {
      throw new RangeError('step precisa ser um inteiro não negativo.');
    }

    /** Campo `b` do original: ramo secundário, não percorrido por b(long). */
    this.secondary = secondary;
    /** Campo `a` do original. */
    this.parent = parent;
    this.step = step;
  }

  getInts(areaX, areaY, areaWidth, areaHeight) {
    assertInt32(areaX, 'areaX');
    assertInt32(areaY, 'areaY');
    assertDimension(areaWidth, 'areaWidth');
    assertDimension(areaHeight, 'areaHeight');

    const land = this.parent.getInts(areaX, areaY, areaWidth, areaHeight);
    const temperature = this.secondary.getInts(areaX, areaY, areaWidth, areaHeight);
    const out = new Array(areaWidth * areaHeight);
    const divisor = this.step * 2 + 1;

    for (let i = 0; i < land.length; i += 1) {
      const biomeTemperature = biomeTableValue(
        BIOME_TEMPERATURE,
        land[i],
        'GenLayerTemperatureMix',
      );

      out[i] = temperature[i]
        + Math.trunc((biomeTemperature - temperature[i]) / divisor);
    }

    return out;
  }
}

/**
 * `mh` -> mistura de chuva. Mesma assimetria de `rk`, mas divide por
 * (step + 1) e usa `sr.e()` (chuva).
 */
export class GenLayerRainfallMix extends GenLayer {
  constructor(secondary, parent, step) {
    super(0n);
    assertParent(secondary);
    assertParent(parent);
    if (!Number.isInteger(step) || step < 0) {
      throw new RangeError('step precisa ser um inteiro não negativo.');
    }

    this.secondary = secondary;
    this.parent = parent;
    this.step = step;
  }

  getInts(areaX, areaY, areaWidth, areaHeight) {
    assertInt32(areaX, 'areaX');
    assertInt32(areaY, 'areaY');
    assertDimension(areaWidth, 'areaWidth');
    assertDimension(areaHeight, 'areaHeight');

    const land = this.parent.getInts(areaX, areaY, areaWidth, areaHeight);
    const rainfall = this.secondary.getInts(areaX, areaY, areaWidth, areaHeight);
    const out = new Array(areaWidth * areaHeight);
    const divisor = this.step + 1;

    for (let i = 0; i < land.length; i += 1) {
      const biomeRainfall = biomeTableValue(
        BIOME_RAINFALL,
        land[i],
        'GenLayerRainfallMix',
      );

      out[i] = rainfall[i]
        + Math.trunc((biomeRainfall - rainfall[i]) / divisor);
    }

    return out;
  }
}

/**
 * `na` -> GenLayerRiverMix. `b(long)` do original semeia os dois pais e
 * depois a própria camada; por isso esta classe guarda os pais fora do
 * campo `a` e sobrescreve initWorldGenSeed.
 */
export class GenLayerRiverMix extends GenLayer {
  constructor(seed, landParent, riverParent) {
    super(seed);
    assertParent(landParent);
    assertParent(riverParent);

    // O campo `a` de `na` não é usado; a recursão é feita manualmente.
    this.parent = null;
    this.landParent = landParent;
    this.riverParent = riverParent;
  }

  /** `na.b(long)`: pai de bioma, pai de rio e só então a própria camada. */
  initWorldGenSeed(seed) {
    const value = toLong(seed);
    this.landParent.initWorldGenSeed(value);
    this.riverParent.initWorldGenSeed(value);
    super.initWorldGenSeed(value);
  }

  getInts(areaX, areaY, areaWidth, areaHeight) {
    assertInt32(areaX, 'areaX');
    assertInt32(areaY, 'areaY');
    assertDimension(areaWidth, 'areaWidth');
    assertDimension(areaHeight, 'areaHeight');

    const land = this.landParent.getInts(areaX, areaY, areaWidth, areaHeight);
    const river = this.riverParent.getInts(areaX, areaY, areaWidth, areaHeight);
    const out = new Array(areaWidth * areaHeight);

    for (let i = 0; i < land.length; i += 1) {
      if (land[i] === BIOME_OCEAN) {
        out[i] = land[i];
      } else if (river[i] >= 0) {
        if (land[i] === BIOME_ICE_PLAINS) {
          out[i] = BIOME_FROZEN_RIVER;
        } else if (
          land[i] === BIOME_MUSHROOM_ISLAND
          || land[i] === BIOME_MUSHROOM_ISLAND_SHORE
        ) {
          out[i] = BIOME_MUSHROOM_ISLAND_SHORE;
        } else {
          out[i] = river[i];
        }
      } else {
        out[i] = land[i];
      }
    }

    return out;
  }
}

/**
 * `df` -> GenLayerVoronoiZoom. Amplia em 4x escolhendo, para cada célula,
 * o canto mais próximo segundo jitter pseudoaleatório por canto.
 */
export class GenLayerVoronoiZoom extends GenLayer {
  constructor(seed, parent) {
    super(seed);
    assertParent(parent);
    this.parent = parent;
  }

  getInts(areaX, areaY, areaWidth, areaHeight) {
    assertInt32(areaX, 'areaX');
    assertInt32(areaY, 'areaY');
    assertDimension(areaWidth, 'areaWidth');
    assertDimension(areaHeight, 'areaHeight');

    const x = areaX - 2;
    const y = areaY - 2;
    const zoom = 2;
    const size = 1 << zoom;
    const parentX = x >> zoom;
    const parentY = y >> zoom;
    const parentWidth = (areaWidth >> zoom) + 3;
    const parentHeight = (areaHeight >> zoom) + 3;
    const base = this.parent.getInts(
      parentX,
      parentY,
      parentWidth,
      parentHeight,
    );
    const scratchWidth = parentWidth << zoom;
    const scratch = new Array(scratchWidth * (parentHeight << zoom));

    for (let j = 0; j < parentHeight - 1; j += 1) {
      let topLeft = base[j * parentWidth];
      let bottomLeft = base[(j + 1) * parentWidth];

      for (let i = 0; i < parentWidth - 1; i += 1) {
        const offset = size * 0.9;

        this.initChunkSeed((i + parentX) << zoom, (j + parentY) << zoom);
        const topLeftX = (this.nextInt(1024) / 1024.0 - 0.5) * offset;
        const topLeftY = (this.nextInt(1024) / 1024.0 - 0.5) * offset;

        this.initChunkSeed((i + parentX + 1) << zoom, (j + parentY) << zoom);
        const topRightX = (this.nextInt(1024) / 1024.0 - 0.5) * offset + size;
        const topRightY = (this.nextInt(1024) / 1024.0 - 0.5) * offset;

        this.initChunkSeed((i + parentX) << zoom, (j + parentY + 1) << zoom);
        const bottomLeftX = (this.nextInt(1024) / 1024.0 - 0.5) * offset;
        const bottomLeftY = (this.nextInt(1024) / 1024.0 - 0.5) * offset + size;

        this.initChunkSeed((i + parentX + 1) << zoom, (j + parentY + 1) << zoom);
        const bottomRightX = (this.nextInt(1024) / 1024.0 - 0.5) * offset + size;
        const bottomRightY = (this.nextInt(1024) / 1024.0 - 0.5) * offset + size;

        const topRight = base[(i + 1) + j * parentWidth];
        const bottomRight = base[(i + 1) + (j + 1) * parentWidth];

        for (let dy = 0; dy < size; dy += 1) {
          let index = ((j << zoom) + dy) * scratchWidth + (i << zoom);

          for (let dx = 0; dx < size; dx += 1) {
            const dTopLeft = (dy - topLeftY) ** 2 + (dx - topLeftX) ** 2;
            const dTopRight = (dy - topRightY) ** 2 + (dx - topRightX) ** 2;
            const dBottomLeft = (dy - bottomLeftY) ** 2 + (dx - bottomLeftX) ** 2;
            const dBottomRight = (dy - bottomRightY) ** 2 + (dx - bottomRightX) ** 2;

            if (
              dTopLeft < dTopRight
              && dTopLeft < dBottomLeft
              && dTopLeft < dBottomRight
            ) {
              scratch[index++] = topLeft;
            } else if (
              dTopRight < dTopLeft
              && dTopRight < dBottomLeft
              && dTopRight < dBottomRight
            ) {
              scratch[index++] = topRight;
            } else if (
              dBottomLeft < dTopLeft
              && dBottomLeft < dTopRight
              && dBottomLeft < dBottomRight
            ) {
              scratch[index++] = bottomLeft;
            } else {
              scratch[index++] = bottomRight;
            }
          }
        }

        topLeft = topRight;
        bottomLeft = bottomRight;
      }
    }

    const out = new Array(areaWidth * areaHeight);
    const mask = size - 1;

    // O original usa as coordenadas JÁ deslocadas (x-2, y-2) na máscara.
    for (let k = 0; k < areaHeight; k += 1) {
      const source = (k + (y & mask)) * scratchWidth + (x & mask);
      const destination = k * areaWidth;

      for (let i = 0; i < areaWidth; i += 1) {
        out[destination + i] = scratch[source + i];
      }
    }

    return out;
  }
}

/**
 * Cadeia-base interna de `jx.a(long)`: aib -> gn -> tv -> act -> tv -> hv ->
 * act -> tv -> act -> tv -> aas. Não semeia: o `jx.a(long)` original só
 * chama initWorldGenSeed nos quatro ramos finais.
 */
function buildBaseBiomeLayer() {
  let layer = new GenLayerIsland(1n);
  layer = new GenLayerFuzzyZoom(2000n, layer);
  layer = new GenLayerAddIsland(1n, layer);
  layer = new GenLayerZoom(2001n, layer);
  layer = new GenLayerAddIsland(2n, layer);
  layer = new GenLayerAddSnow(2n, layer);
  layer = new GenLayerZoom(2002n, layer);
  layer = new GenLayerAddIsland(3n, layer);
  layer = new GenLayerZoom(2003n, layer);
  layer = new GenLayerAddIsland(4n, layer);
  layer = new GenLayerRareBiome(5n, layer);

  return layer;
}

/**
 * Cadeia-base de bioma (até `aas`), já semeada. Útil para validar cada etapa
 * contra o Java antes de montar a cadeia completa.
 */
export function createBaseBiomeLayer(worldSeed) {
  const layer = buildBaseBiomeLayer();
  layer.initWorldGenSeed(worldSeed);
  return layer;
}

/**
 * `jx.a(long)`: monta os cinco ramos do gerador de biomas de 1.0 e devolve
 * no MESMO formato do array original:
 *
 *   [0] na  -> RiverMix (biomas finais)
 *   [1] df  -> VoronoiZoom (saída visual, 4x)
 *   [2] rk  -> ramo de temperatura
 *   [3] mh  -> ramo de chuva
 *   [4] na  -> a MESMA instância de [0] (o bytecode guarda o mesmo objeto
 *              em dois slots do array)
 *
 * Repare que `rk`/`mh` não semeiam o ramo secundário (temperatura/chuva):
 * `jx.b(long)` desce apenas pelo campo `a`, que nessas classes aponta para
 * a camada de bioma. Essa assimetria faz parte do gerador de 1.0.
 */
export function createWorldBiomeLayers(worldSeed) {
  const height = 4;
  const base = buildBaseBiomeLayer();

  let river = GenLayerZoom.magnify(1000n, base, 0);
  river = new GenLayerRiverInit(100n, river);
  river = GenLayerZoom.magnify(1000n, river, height + 2);
  river = new GenLayerRiver(1n, river);
  river = new GenLayerSmooth(1000n, river);

  let land = GenLayerZoom.magnify(1000n, base, 0);
  land = new GenLayerBiome(200n, land);
  land = GenLayerZoom.magnify(1000n, land, 2);
  let temperature = new GenLayerTemperature(land);
  let rainfall = new GenLayerRainfall(land);

  for (let i = 0; i < height; i += 1) {
    land = new GenLayerZoom(1000n + BigInt(i), land);
    if (i === 0) {
      land = new GenLayerAddIsland(3n, land);
      land = new GenLayerShore(1000n, land);
    }

    temperature = new GenLayerSmoothZoom(1000n + BigInt(i), temperature);
    temperature = new GenLayerTemperatureMix(temperature, land, i);
    rainfall = new GenLayerSmoothZoom(1000n + BigInt(i), rainfall);
    rainfall = new GenLayerRainfallMix(rainfall, land, i);
  }

  land = new GenLayerSmooth(1000n, land);
  const mixed = new GenLayerRiverMix(100n, land, river);

  temperature = GenLayerSmoothZoom.magnify(1000n, temperature, 2);
  rainfall = GenLayerSmoothZoom.magnify(1000n, rainfall, 2);

  const voronoi = new GenLayerVoronoiZoom(10n, mixed);

  mixed.initWorldGenSeed(worldSeed);
  temperature.initWorldGenSeed(worldSeed);
  rainfall.initWorldGenSeed(worldSeed);
  voronoi.initWorldGenSeed(worldSeed);

  // O original guarda o mesmo objeto `na` nos índices 0 e 4.
  return [mixed, voronoi, temperature, rainfall, mixed];
}

export class GenLayerFuzzyZoom extends GenLayer {
  constructor(seed, parent) {
    super(seed);
    assertParent(parent);
    this.parent = parent;
  }

  getInts(areaX, areaY, areaWidth, areaHeight) {
    assertInt32(areaX, 'areaX');
    assertInt32(areaY, 'areaY');
    assertDimension(areaWidth, 'areaWidth');
    assertDimension(areaHeight, 'areaHeight');

    const x = areaX >> 1;
    const y = areaY >> 1;
    const width = (areaWidth >> 1) + 3;
    const height = (areaHeight >> 1) + 3;
    const base = this.parent.getInts(x, y, width, height);
    const outWidth = width << 1;
    const out = new Array(outWidth * (height << 1));

    for (let j = 0; j < height - 1; j += 1) {
      let offset = (j << 1) * outWidth;
      let topLeft = base[j * width];
      let bottomLeft = base[(j + 1) * width];

      for (let i = 0; i < width - 1; i += 1) {
        this.initChunkSeed((i + x) << 1, (j + y) << 1);

        const topRight = base[(i + 1) + j * width];
        const bottomRight = base[(i + 1) + (j + 1) * width];

        out[offset] = topLeft;
        out[offset + outWidth] = this.selectRandom(topLeft, bottomLeft);
        out[offset + 1] = this.selectRandom(topLeft, topRight);
        out[offset + 1 + outWidth] = this.selectMode(
          topLeft,
          topRight,
          bottomLeft,
          bottomRight,
        );

        topLeft = topRight;
        bottomLeft = bottomRight;
        offset += 2;
      }
    }

    return copyZoomWindow(out, outWidth, areaX, areaY, areaWidth, areaHeight);
  }

  selectRandom(first, second) {
    return this.nextInt(2) === 0 ? first : second;
  }

  selectMode(first, second, third, fourth) {
    switch (this.nextInt(4)) {
      case 0: return first;
      case 1: return second;
      case 2: return third;
      default: return fourth;
    }
  }
}

export class GenLayerZoom extends GenLayer {
  constructor(seed, parent) {
    super(seed);
    assertParent(parent);
    this.parent = parent;
  }

  getInts(areaX, areaY, areaWidth, areaHeight) {
    assertInt32(areaX, 'areaX');
    assertInt32(areaY, 'areaY');
    assertDimension(areaWidth, 'areaWidth');
    assertDimension(areaHeight, 'areaHeight');

    const x = areaX >> 1;
    const y = areaY >> 1;
    const width = (areaWidth >> 1) + 3;
    const height = (areaHeight >> 1) + 3;
    const base = this.parent.getInts(x, y, width, height);
    const outWidth = width << 1;
    const out = new Array(outWidth * (height << 1));

    for (let j = 0; j < height - 1; j += 1) {
      let offset = (j << 1) * outWidth;
      let topLeft = base[j * width];
      let bottomLeft = base[(j + 1) * width];

      for (let i = 0; i < width - 1; i += 1) {
        this.initChunkSeed((i + x) << 1, (j + y) << 1);

        const topRight = base[(i + 1) + j * width];
        const bottomRight = base[(i + 1) + (j + 1) * width];

        out[offset] = topLeft;
        out[offset + outWidth] = this.selectRandom(topLeft, bottomLeft);
        out[offset + 1] = this.selectRandom(topLeft, topRight);
        out[offset + 1 + outWidth] = this.selectMode(
          topLeft,
          topRight,
          bottomLeft,
          bottomRight,
        );

        topLeft = topRight;
        bottomLeft = bottomRight;
        offset += 2;
      }
    }

    return copyZoomWindow(out, outWidth, areaX, areaY, areaWidth, areaHeight);
  }

  selectRandom(first, second) {
    return this.nextInt(2) === 0 ? first : second;
  }

  selectMode(first, second, third, fourth) {
    if (second === third && third === fourth) return second;
    if (first === second && first === third) return first;
    if (first === second && first === fourth) return first;
    if (first === third && first === fourth) return first;
    if (first === second && third !== fourth) return first;
    if (first === third && second !== fourth) return first;
    if (first === fourth && second !== third) return first;
    if (second === first && third !== fourth) return second;
    if (second === third && first !== fourth) return second;
    if (second === fourth && first !== third) return second;
    if (third === first && second !== fourth) return third;
    if (third === second && first !== fourth) return third;
    if (third === fourth && first !== second) return third;

    // O bytecode de 1.0 devolve o terceiro argumento nestes três casos,
    // embora a implementação canônica posterior devolva o quarto.
    if (fourth === first && second !== third) return third;
    if (fourth === second && first !== third) return third;
    if (fourth === third && first !== second) return third;

    switch (this.nextInt(4)) {
      case 0: return first;
      case 1: return second;
      case 2: return third;
      default: return fourth;
    }
  }

  /** `act.a(long, jx, int)`: encadeia `count` zooms. */
  static magnify(seed, parent, count) {
    assertParent(parent);
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError('count precisa ser um inteiro não negativo.');
    }

    const base = toLong(seed);
    let layer = parent;

    for (let i = 0; i < count; i += 1) {
      layer = new GenLayerZoom(base + BigInt(i), layer);
    }

    return layer;
  }
}

export class GenLayerSmoothZoom extends GenLayer {
  constructor(seed, parent) {
    super(seed);
    assertParent(parent);
    this.parent = parent;
  }

  getInts(areaX, areaY, areaWidth, areaHeight) {
    assertInt32(areaX, 'areaX');
    assertInt32(areaY, 'areaY');
    assertDimension(areaWidth, 'areaWidth');
    assertDimension(areaHeight, 'areaHeight');

    const x = areaX >> 1;
    const y = areaY >> 1;
    const width = (areaWidth >> 1) + 3;
    const height = (areaHeight >> 1) + 3;
    const base = this.parent.getInts(x, y, width, height);
    const outWidth = width << 1;
    const out = new Array(outWidth * (height << 1));

    for (let j = 0; j < height - 1; j += 1) {
      let offset = (j << 1) * outWidth;
      let topLeft = base[j * width];
      let bottomLeft = base[(j + 1) * width];

      for (let i = 0; i < width - 1; i += 1) {
        this.initChunkSeed((i + x) << 1, (j + y) << 1);

        const topRight = base[(i + 1) + j * width];
        const bottomRight = base[(i + 1) + (j + 1) * width];

        out[offset] = topLeft;
        out[offset + outWidth] = lerp(topLeft, bottomLeft, this.nextInt(256));
        out[offset + 1] = lerp(topLeft, topRight, this.nextInt(256));

        const topMiddle = lerp(topLeft, topRight, this.nextInt(256));
        const bottomMiddle = lerp(bottomLeft, bottomRight, this.nextInt(256));
        out[offset + 1 + outWidth] = lerp(
          topMiddle,
          bottomMiddle,
          this.nextInt(256),
        );

        topLeft = topRight;
        bottomLeft = bottomRight;
        offset += 2;
      }
    }

    return copyZoomWindow(out, outWidth, areaX, areaY, areaWidth, areaHeight);
  }

  /** `jw.a(long, jx, int)`: mesma cadeia de `magnify` de GenLayerZoom. */
  static magnify(seed, parent, count) {
    assertParent(parent);
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError('count precisa ser um inteiro não negativo.');
    }

    const base = toLong(seed);
    let layer = parent;

    for (let i = 0; i < count; i += 1) {
      layer = new GenLayerSmoothZoom(base + BigInt(i), layer);
    }

    return layer;
  }
}

function copyZoomWindow(out, outWidth, areaX, areaY, areaWidth, areaHeight) {
  const result = new Array(areaWidth * areaHeight);
  const column = areaX & 1;
  const row = areaY & 1;

  for (let j = 0; j < areaHeight; j += 1) {
    const source = (j + row) * outWidth + column;
    const destination = j * areaWidth;
    for (let i = 0; i < areaWidth; i += 1) {
      result[destination + i] = out[source + i];
    }
  }

  return result;
}
