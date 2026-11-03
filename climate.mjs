/**
 * Consulta climática do Minecraft 1.0 (ids de bioma, temperatura, chuva e cor da grama).
 *
 * Reproduz o caminho do original, confirmado no bytecode:
 *   jx.a(seed)[1]  df  = VoronoiZoom        -> id do bioma por bloco  (vh.a(sr[],...))
 *   jx.a(seed)[2]  temperatura em Q16       -> vh.a(float[],...)
 *   jx.a(seed)[3]  chuva em Q16             -> vh.b(float[],...)
 *   valor = (int) / 65536.0f, com teto em 1.0f e SEM piso
 *   ha.a(temp, chuva): i = (int)((1 - temp) * 255), j = (int)((1 - chuva * temp) * 255),
 *                      cor = grassBuffer[j << 8 | i]
 *
 * Módulo puro (sem Node, sem DOM): funciona no navegador e nos testes.
 * Coordenadas são de BLOCO (x, z), iguais às do cache de bioma do original.
 */

import { createWorldBiomeLayers } from './genlayer.mjs';

export const Q16_ONE = 65536;
export const GRASS_SIZE = 256;

/**
 * Q16 -> float, como em vh.a/b(float[],...): i2f, fdiv 65536.0f, teto 1.0f.
 * Não há piso: valores negativos passam como estão.
 */
export function q16ToClimate(q16) {
  const value = Math.fround(q16 / Q16_ONE);
  return value > 1 ? 1 : value;
}

/**
 * Reprodução de ha.a(double, double) até o índice do buffer.
 * @returns {{x: number, y: number, index: number}} x = coluna, y = linha em grasscolor.png
 */
export function grassColorIndex(temperature, rainfall) {
  const t = temperature;
  const r = rainfall * t;
  const x = Math.trunc((1 - t) * 255);
  const y = Math.trunc((1 - r) * 255);
  const index = (y << 8) | x;

  if (x < 0 || x >= GRASS_SIZE || y < 0 || y >= GRASS_SIZE) {
    // O original leria fora do esperado (ou outra linha); aqui falhamos alto.
    throw new RangeError(`Índice de grama fora do mapa: x=${x}, y=${y} (temp=${t}, chuva=${rainfall}).`);
  }

  return { x, y, index };
}

/**
 * Converte RGBA de 8 bits (ex.: ImageData.data de um canvas 256x256) em 0xRRGGBB.
 * Use pixels sem alpha parcial (premultiplied alpha distorceria as cores).
 */
export function grassPixelsFromRgba(rgba) {
  if (rgba.length !== GRASS_SIZE * GRASS_SIZE * 4) {
    throw new RangeError('grasscolor precisa ter 256x256 pixels RGBA.');
  }

  const pixels = new Uint32Array(GRASS_SIZE * GRASS_SIZE);

  for (let i = 0; i < pixels.length; i += 1) {
    pixels[i] = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2];
  }

  return pixels;
}

/** Cor 0xRRGGBB da grama para um par (temperatura, chuva) já em float. */
export function grassColor(grassPixels, temperature, rainfall) {
  return grassPixels[grassColorIndex(temperature, rainfall).index] & 0xffffff;
}

/**
 * @param {bigint|number} worldSeed semente do mundo (long do Java; prefira bigint)
 * @param {object} [options]
 * @param {Uint32Array} [options.grassPixels] saída de grassPixelsFromRgba(); habilita `grass`
 */
export function createClimateQuery(worldSeed, { grassPixels } = {}) {
  const layers = createWorldBiomeLayers(worldSeed);
  const voronoi = layers[1];
  const temperatureLayer = layers[2];
  const rainfallLayer = layers[3];

  /** Retângulo de largura x altura a partir de (x, z), em ordem linha por linha (x varia mais rápido). */
  function region(x, z, width, height) {
    const count = width * height;
    const biomeIds = Int32Array.from(voronoi.getInts(x, z, width, height));
    const temperatureQ16 = Int32Array.from(temperatureLayer.getInts(x, z, width, height));
    const rainfallQ16 = Int32Array.from(rainfallLayer.getInts(x, z, width, height));

    const temperature = new Float32Array(count);
    const rainfall = new Float32Array(count);
    const grassX = new Int16Array(count);
    const grassY = new Int16Array(count);
    const grass = grassPixels ? new Uint32Array(count) : null;

    for (let i = 0; i < count; i += 1) {
      temperature[i] = q16ToClimate(temperatureQ16[i]);
      rainfall[i] = q16ToClimate(rainfallQ16[i]);

      const cell = grassColorIndex(temperature[i], rainfall[i]);
      grassX[i] = cell.x;
      grassY[i] = cell.y;

      if (grass) grass[i] = grassPixels[cell.index] & 0xffffff;
    }

    return {
      x, z, width, height,
      biomeIds, temperatureQ16, rainfallQ16,
      temperature, rainfall, grassX, grassY, grass,
    };
  }

  /** Consulta de um único bloco. */
  function at(x, z) {
    const r = region(x, z, 1, 1);

    return {
      x, z,
      biomeId: r.biomeIds[0],
      temperatureQ16: r.temperatureQ16[0],
      rainfallQ16: r.rainfallQ16[0],
      temperature: r.temperature[0],
      rainfall: r.rainfall[0],
      grassX: r.grassX[0],
      grassY: r.grassY[0],
      grass: r.grass ? r.grass[0] : null,
    };
  }

  return { region, at };
}
