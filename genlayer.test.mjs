import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GenLayer,
  GenLayerAddIsland,
  GenLayerAddSnow,
  GenLayerBiome,
  GenLayerFuzzyZoom,
  GenLayerIsland,
  GenLayerRainfall,
  GenLayerRainfallMix,
  GenLayerRareBiome,
  GenLayerRiver,
  GenLayerRiverInit,
  GenLayerRiverMix,
  GenLayerShore,
  GenLayerSmooth,
  GenLayerSmoothZoom,
  GenLayerTemperature,
  GenLayerTemperatureMix,
  GenLayerVoronoiZoom,
  GenLayerZoom,
  createBaseBiomeLayer,
  createWorldBiomeLayers,
} from './genlayer.mjs';

class ConstantLayer extends GenLayer {
  getInts(x, y, width, height) {
    const out = new Array(width * height);

    for (let j = 0; j < height; j += 1) {
      for (let i = 0; i < width; i += 1) {
        const gx = x + i;
        const gy = y + j;
        const value = (gx * 31 + gy * 17 + gx * gy * 7) % 97;
        out[j * width + i] = ((value % 97) + 97) % 97;
      }
    }

    return out;
  }
}

/** Mesmas camadas constantes usadas pelos harness Java de paridade. */
function harnessValue(x, y, multiplierX, multiplierY, multiplierXY, modulo) {
  const value = x * multiplierX + y * multiplierY + x * y * multiplierXY;
  return ((value % modulo) + modulo) % modulo;
}

class HarnessConst extends GenLayer {
  getInts(x, y, width, height) {
    const out = new Array(width * height);

    for (let j = 0; j < height; j += 1) {
      for (let i = 0; i < width; i += 1) {
        out[j * width + i] = harnessValue(x + i, y + j, 31, 17, 7, 16);
      }
    }

    return out;
  }
}

class HarnessWideConst extends GenLayer {
  getInts(x, y, width, height) {
    const out = new Array(width * height);

    for (let j = 0; j < height; j += 1) {
      for (let i = 0; i < width; i += 1) {
        out[j * width + i] = harnessValue(x + i, y + j, 31, 17, 7, 200000);
      }
    }

    return out;
  }
}

class HarnessRiverConst extends GenLayer {
  getInts(x, y, width, height) {
    const out = new Array(width * height);

    for (let j = 0; j < height; j += 1) {
      for (let i = 0; i < width; i += 1) {
        out[j * width + i] = harnessValue(x + i, y + j, 13, 7, 3, 9) - 1;
      }
    }

    return out;
  }
}

/** Todas as células são Plains (1), para exercitar as seis escolhas de `afa`. */
class PlainsLayer extends GenLayer {
  getInts(x, y, width, height) {
    return new Array(width * height).fill(1);
  }
}

function assertLayerOutput(layer, seed, x, y, width, height, expected) {
  layer.initWorldGenSeed(seed);
  assert.deepEqual(layer.getInts(x, y, width, height), expected);
}

test('GenLayerFuzzyZoom reproduz a saída do Java 1.0', () => {
  const fuzzy = new GenLayerFuzzyZoom(2000n, new ConstantLayer(7n));

  assertLayerOutput(fuzzy, 123456789n, -3, 5, 6, 5, [
    86, 96, 51, 34, 34, 79,
    44, 96, 51, 51, 6, 6,
    47, 9, 96, 68, 6, 6,
    47, 9, 68, 68, 68, 30,
    50, 19, 9, 68, 30, 54,
  ]);
});

test('GenLayerZoom reproduz a saída do Java 1.0', () => {
  const zoom = new GenLayerZoom(
    2001n,
    new GenLayerFuzzyZoom(2000n, new ConstantLayer(7n)),
  );

  assertLayerOutput(zoom, -42n, 7, -9, 6, 5, [
    0, 0, 0, 17, 17, 17,
    0, 0, 17, 17, 17, 17,
    0, 31, 31, 31, 17, 55,
    31, 31, 31, 31, 31, 55,
    31, 31, 31, 31, 31, 55,
  ]);
});

test('GenLayerSmoothZoom reproduz a saída do Java 1.0', () => {
  const smooth = new GenLayerSmoothZoom(
    1000n,
    new GenLayerZoom(
      2001n,
      new GenLayerFuzzyZoom(2000n, new ConstantLayer(7n)),
    ),
  );

  assertLayerOutput(smooth, 0n, -1, -2, 6, 5, [
    0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0,
    13, 16, 8, 0, 0, 0,
    29, 17, 13, 0, 0, 0,
  ]);
});

test('GenLayerIsland reproduz a saída do Java 1.0', () => {
  const island = new GenLayerIsland(1n);

  // Janela fora da origem: não força o centro.
  assertLayerOutput(island, 123456789n, -3, 5, 6, 5, [
    0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0,
    0, 1, 0, 0, 0, 0,
    0, 0, 0, 1, 0, 0,
    0, 0, 0, 0, 0, 0,
  ]);

  // Janela cobrindo a origem: a célula (-areaX, -areaY) vira terra (índice 21).
  assertLayerOutput(island, -42n, -3, -3, 6, 5, [
    0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0,
    0, 0, 0, 1, 0, 1,
    0, 1, 0, 0, 1, 1,
  ]);
});

test('GenLayerAddIsland reproduz a saída do Java 1.0', () => {
  const addIsland = new GenLayerAddIsland(2000n, new ConstantLayer(7n));

  assertLayerOutput(addIsland, -42n, -1, -2, 6, 5, [
    46, 63, 80, 0, 17, 34,
    56, 80, 7, 31, 55, 79,
    66, 0, 31, 62, 93, 27,
    76, 17, 55, 93, 34, 72,
    86, 34, 79, 27, 72, 20,
  ]);

  assertLayerOutput(addIsland, 0n, -4, -4, 9, 9, [
    17, 20, 23, 26, 29, 32, 35, 38, 0,
    6, 16, 26, 36, 46, 0, 66, 76, 86,
    92, 12, 29, 46, 63, 80, 0, 17, 34,
    81, 8, 32, 56, 80, 0, 31, 55, 79,
    70, 4, 35, 66, 7, 31, 62, 93, 27,
    59, 0, 38, 76, 17, 55, 93, 34, 72,
    48, 93, 41, 86, 34, 79, 27, 72, 20,
    37, 89, 44, 96, 51, 6, 58, 13, 65,
    26, 85, 47, 9, 68, 30, 89, 51, 13,
  ]);
});

test('GenLayerAddSnow reproduz a saída do Java 1.0', () => {
  const addSnow = new GenLayerAddSnow(2n, new ConstantLayer(7n));

  assertLayerOutput(addSnow, -42n, -1, -2, 6, 5, [
    1, 1, 1, 0, 1, 1,
    1, 1, 1, 12, 1, 1,
    1, 0, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 12,
    12, 1, 12, 12, 12, 1,
  ]);
});

test('GenLayerRareBiome reproduz a saída do Java 1.0', () => {
  const rareBiome = new GenLayerRareBiome(5n, new ConstantLayer(7n));

  assertLayerOutput(rareBiome, 0n, -4, -4, 9, 9, [
    17, 20, 23, 26, 29, 32, 35, 38, 41,
    6, 16, 26, 36, 46, 56, 66, 76, 86,
    92, 12, 29, 46, 63, 80, 0, 17, 34,
    81, 8, 32, 56, 80, 7, 31, 55, 79,
    70, 4, 35, 66, 0, 31, 62, 93, 27,
    59, 0, 38, 76, 17, 55, 93, 34, 72,
    48, 93, 41, 86, 34, 79, 27, 72, 20,
    37, 89, 44, 96, 51, 6, 58, 13, 65,
    26, 85, 47, 9, 68, 30, 89, 51, 13,
  ]);
});

test('createBaseBiomeLayer reproduz a cadeia-base do Java 1.0', () => {
  assertLayerOutput(createBaseBiomeLayer(123456789n), 123456789n, 0, 0, 8, 8, [
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 0, 1, 1, 1, 1,
    1, 1, 0, 1, 1, 1, 1, 1,
    0, 1, 0, 1, 1, 1, 1, 1,
    1, 1, 0, 1, 1, 1, 1, 0,
    0, 0, 1, 1, 1, 1, 0, 1,
    1, 0, 1, 1, 0, 1, 0, 0,
    1, 1, 1, 1, 0, 0, 1, 0,
  ]);

  assertLayerOutput(createBaseBiomeLayer(-42n), -42n, -3, -3, 8, 8, [
    1, 1, 1, 1, 1, 1, 1, 1,
    0, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 12, 12, 1, 1, 1,
    10, 12, 12, 12, 12, 12, 12, 1,
    1, 12, 12, 12, 12, 1, 1, 1,
    1, 1, 1, 12, 12, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 0,
    1, 1, 1, 1, 1, 1, 1, 1,
  ]);
});

test('GenLayerRiverInit reproduz a saída do Java 1.0', () => {
  const layer = new GenLayerRiverInit(100n, new HarnessConst(7n));

  assertLayerOutput(layer, 0n, 0, 0, 8, 8, [
    0, 2, 3, 3, 2, 3, 3, 2,
    3, 3, 3, 3, 3, 3, 2, 3,
    3, 2, 3, 2, 2, 3, 0, 3,
    2, 2, 2, 3, 3, 3, 2, 3,
    2, 3, 3, 2, 0, 2, 2, 3,
    2, 3, 3, 3, 3, 3, 3, 3,
    3, 2, 2, 3, 3, 2, 3, 2,
    3, 3, 3, 3, 3, 2, 3, 2,
  ]);
});

test('GenLayerRiver reproduz a saída do Java 1.0', () => {
  const layer = new GenLayerRiver(1n, new HarnessConst(7n));

  assertLayerOutput(layer, 0n, 0, 0, 8, 8, [
    7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7,
  ]);
});

test('GenLayerSmooth reproduz a saída do Java 1.0', () => {
  const layer = new GenLayerSmooth(1000n, new HarnessConst(7n));

  assertLayerOutput(layer, 0n, 0, 0, 8, 8, [
    0, 7, 14, 13, 12, 11, 10, 9,
    1, 15, 13, 3, 9, 15, 5, 11,
    2, 7, 12, 9, 6, 3, 0, 13,
    3, 15, 11, 15, 3, 7, 11, 15,
    4, 7, 10, 5, 0, 11, 6, 1,
    5, 15, 9, 11, 13, 15, 1, 3,
    6, 7, 8, 1, 10, 3, 12, 5,
    7, 7, 7, 7, 7, 7, 7, 7,
  ]);
});

test('GenLayerBiome reproduz a saída do Java 1.0', () => {
  const layer = new GenLayerBiome(200n, new HarnessConst(7n));

  assertLayerOutput(layer, 0n, 0, 0, 8, 8, [
    0, 12, 14, 12, 12, 12, 12, 12,
    3, 12, 12, 12, 12, 12, 12, 12,
    12, 12, 12, 12, 12, 12, 0, 12,
    12, 12, 12, 12, 12, 12, 12, 12,
    12, 12, 12, 12, 0, 12, 12, 1,
    12, 12, 12, 12, 12, 12, 3, 12,
    12, 12, 12, 2, 12, 12, 12, 12,
    12, 12, 12, 12, 12, 12, 12, 12,
  ]);

  // Com todas as células em Plains, nextInt(6) percorre as seis escolhas.
  const plains = new GenLayerBiome(200n, new PlainsLayer(0n));

  assertLayerOutput(plains, 0n, 0, 0, 8, 8, [
    6, 6, 1, 4, 2, 1, 4, 5,
    3, 3, 3, 3, 1, 1, 2, 4,
    2, 2, 5, 5, 5, 5, 1, 1,
    5, 3, 2, 3, 2, 1, 5, 6,
    6, 1, 1, 6, 6, 6, 4, 1,
    3, 6, 6, 5, 1, 2, 3, 6,
    3, 1, 5, 2, 6, 6, 5, 2,
    1, 2, 6, 4, 2, 4, 4, 3,
  ]);
});

test('GenLayerTemperature reproduz a saída do Java 1.0', () => {
  const layer = new GenLayerTemperature(new HarnessConst(7n));

  assertLayerOutput(layer, 0n, 0, 0, 8, 8, [
    32768, 58982, 58982, 0, 0, 0, 0, 32768,
    52428, 32768, 0, 13107, 32768, 58982, 19660, 0,
    131072, 58982, 0, 32768, 52428, 13107, 32768, 0,
    13107, 32768, 0, 58982, 13107, 32768, 0, 58982,
    45875, 58982, 0, 19660, 32768, 0, 52428, 52428,
    19660, 32768, 32768, 0, 0, 58982, 52428, 13107,
    52428, 58982, 131072, 52428, 0, 13107, 0, 19660,
    32768, 32768, 32768, 32768, 32768, 32768, 32768, 32768,
  ]);
});

test('GenLayerRainfall reproduz a saída do Java 1.0', () => {
  const layer = new GenLayerRainfall(new HarnessConst(7n));

  assertLayerOutput(layer, 0n, 0, 0, 8, 8, [
    32768, 65536, 65536, 32768, 32768, 32768, 32768, 32768,
    26214, 32768, 32768, 19660, 32768, 65536, 52428, 32768,
    0, 65536, 32768, 32768, 58982, 19660, 32768, 32768,
    19660, 32768, 32768, 65536, 19660, 32768, 32768, 65536,
    52428, 65536, 32768, 52428, 32768, 32768, 58982, 26214,
    52428, 32768, 32768, 32768, 32768, 65536, 26214, 19660,
    58982, 65536, 0, 26214, 32768, 19660, 32768, 52428,
    32768, 32768, 32768, 32768, 32768, 32768, 32768, 32768,
  ]);
});

test('GenLayerShore reproduz a saída do Java 1.0', () => {
  const layer = new GenLayerShore(1000n, new HarnessConst(7n));

  assertLayerOutput(layer, 0n, 0, 0, 8, 8, [
    0, 15, 14, 13, 12, 11, 10, 9,
    1, 7, 13, 3, 9, 15, 5, 11,
    2, 15, 12, 9, 6, 3, 0, 13,
    3, 7, 11, 15, 3, 7, 11, 15,
    4, 15, 10, 5, 0, 11, 6, 1,
    5, 7, 9, 11, 13, 15, 1, 3,
    6, 15, 8, 1, 10, 3, 12, 5,
    7, 7, 7, 7, 7, 7, 7, 7,
  ]);
});

test('GenLayerTemperatureMix reproduz a saída do Java 1.0', () => {
  const layer = new GenLayerTemperatureMix(
    new HarnessWideConst(7n),
    new HarnessConst(11n),
    3,
  );

  assertLayerOutput(layer, 0n, 0, 0, 8, 8, [
    4681, 8452, 8479, 80, 107, 133, 160, 4867,
    7504, 4728, 80, 1984, 4826, 8603, 3018, 243,
    18753, 8493, 107, 4826, 7673, 2094, 4941, 300,
    1916, 4769, 133, 8603, 2094, 4947, 312, 8781,
    6611, 8534, 160, 3018, 4941, 312, 7851, 7902,
    2881, 4810, 4867, 243, 300, 8781, 7902, 2341,
    7577, 8576, 18937, 7764, 338, 2272, 463, 3334,
    4783, 4851, 4920, 4988, 5057, 5126, 5194, 5263,
  ]);
});

test('GenLayerRainfallMix reproduz a saída do Java 1.0', () => {
  const layer = new GenLayerRainfallMix(
    new HarnessWideConst(7n),
    new HarnessConst(11n),
    3,
  );

  assertLayerOutput(layer, 0n, 0, 0, 8, 8, [
    8192, 16407, 16430, 8261, 8285, 8308, 8331, 8354,
    6566, 8233, 8261, 5013, 8318, 16539, 13290, 8404,
    26, 16443, 8285, 8318, 14906, 5109, 8420, 8453,
    4953, 8269, 8308, 16539, 5109, 8425, 8464, 16695,
    13158, 16479, 8331, 13290, 8420, 8464, 15062, 6914,
    13170, 8305, 8354, 8404, 8453, 16695, 6914, 5325,
    14822, 16515, 186, 6794, 8487, 5265, 8597, 13566,
    8281, 8341, 8401, 8461, 8521, 8581, 8641, 8701,
  ]);
});

test('GenLayerRiverMix reproduz a saída do Java 1.0', () => {
  const layer = new GenLayerRiverMix(
    100n,
    new HarnessConst(11n),
    new HarnessRiverConst(7n),
  );

  assertLayerOutput(layer, 0n, 0, 0, 8, 8, [
    0, 15, 15, 2, 11, 1, 5, 0,
    6, 4, 2, 0, 7, 15, 3, 1,
    4, 15, 11, 7, 6, 0, 0, 2,
    2, 6, 1, 15, 0, 4, 11, 15,
    0, 15, 5, 3, 0, 11, 6, 4,
    7, 7, 0, 1, 2, 15, 4, 5,
    5, 15, 4, 1, 3, 7, 11, 6,
    3, 1, 7, 6, 4, 2, 0, 7,
  ]);
});

test('GenLayerVoronoiZoom reproduz a saída do Java 1.0', () => {
  const layer = new GenLayerVoronoiZoom(10n, new HarnessConst(7n));

  assertLayerOutput(layer, 0n, 0, 0, 8, 8, [
    15, 15, 15, 15, 15, 15, 15, 7,
    1, 1, 0, 15, 15, 15, 15, 15,
    1, 1, 0, 0, 0, 15, 15, 15,
    1, 1, 0, 0, 0, 0, 15, 15,
    1, 1, 0, 0, 0, 0, 7, 7,
    1, 1, 0, 0, 7, 7, 7, 7,
    1, 1, 1, 7, 7, 7, 7, 7,
    1, 1, 1, 2, 7, 7, 7, 7,
  ]);
});

test('createWorldBiomeLayers reproduz a cadeia completa do Java 1.0', () => {
  const seed = 9223372036854775807n;
  const layers = createWorldBiomeLayers(seed);

  assert.equal(layers.length, 5);
  // O bytecode original guarda o mesmo objeto `na` nos índices 0 e 4.
  assert.equal(layers[4], layers[0]);

  assertLayerOutput(layers[0], seed, 0, 0, 8, 8, [
    4, 4, 4, 4, 4, 4, 4, 4,
    4, 4, 4, 4, 4, 4, 4, 4,
    4, 4, 4, 4, 4, 4, 4, 4,
    2, 2, 2, 2, 4, 4, 4, 2,
    2, 2, 2, 2, 2, 2, 2, 2,
    2, 2, 2, 2, 2, 2, 2, 2,
    2, 2, 2, 2, 2, 2, 2, 2,
    2, 2, 2, 2, 2, 2, 2, 2,
  ]);

  assertLayerOutput(layers[1], seed, 0, 0, 8, 8, [
    4, 4, 4, 4, 4, 4, 4, 4,
    4, 4, 4, 4, 4, 4, 4, 4,
    4, 4, 4, 4, 4, 4, 4, 4,
    4, 4, 4, 4, 4, 4, 4, 4,
    4, 4, 4, 4, 4, 4, 4, 4,
    4, 4, 4, 4, 4, 4, 4, 4,
    4, 4, 4, 4, 4, 4, 4, 4,
    4, 4, 4, 4, 4, 4, 4, 4,
  ]);

  assertLayerOutput(layers[2], seed, 0, 0, 4, 4, [
    45875, 45875, 45875, 45875,
    45875, 45875, 45875, 45875,
    45875, 45875, 45875, 45875,
    45875, 45875, 45875, 45875,
  ]);

  assertLayerOutput(layers[3], seed, 0, 0, 4, 4, [
    52428, 52428, 52428, 52428,
    52428, 52428, 52428, 52428,
    52428, 52428, 52428, 52428,
    52428, 52428, 52428, 52428,
  ]);
});

test('magnify encadeia zooms com sementes seed + i', () => {
  const magnified = GenLayerZoom.magnify(1000n, new ConstantLayer(7n), 2);

  assertLayerOutput(magnified, 42n, 0, 0, 6, 5, [
    0, 0, 0, 31, 31, 31,
    0, 0, 55, 31, 31, 31,
    0, 0, 55, 55, 31, 31,
    17, 17, 55, 55, 31, 55,
    17, 17, 17, 55, 55, 55,
  ]);
});

test('initWorldGenSeed propaga apenas pelo parent', () => {
  class MultiParentLayer extends GenLayer {
    constructor(seed, parent, secondary) {
      super(seed);
      this.parent = parent;
      this.secondary = secondary;
    }

    getInts(x, y, width, height) {
      return this.secondary.getInts(x, y, width, height);
    }
  }

  const primary = new GenLayerFuzzyZoom(2000n, new ConstantLayer(7n));
  const secondary = new GenLayerFuzzyZoom(3000n, new ConstantLayer(9n));
  const multi = new MultiParentLayer(5n, primary, secondary);

  multi.initWorldGenSeed(424242n);

  assert.equal(multi.worldSeed, -7350678379089813889n);
  assert.equal(primary.worldSeed, -8252855113519333086n);
  assert.equal(secondary.worldSeed, 0n);
});
