import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

import {
  createClimateQuery,
  grassColorIndex,
  grassPixelsFromRgba,
  q16ToClimate,
} from './climate.mjs';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));

/** Decodificador mínimo de PNG 8 bits RGBA/RGB sem entrelaçamento (só para o teste). */
function decodePng(buffer) {
  assert.equal(buffer.subarray(1, 4).toString('latin1'), 'PNG');

  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('latin1');
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, 'só 8 bits por canal');
      assert.ok(data[9] === 6 || data[9] === 2, 'só RGBA ou RGB');
      assert.equal(data[12], 0, 'sem entrelaçamento');
      channels = data[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') {
      idat.push(data);
    }

    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));

    for (let i = 0; i < stride; i += 1) {
      const left = i >= channels ? out[y * stride + i - channels] : 0;
      const up = y > 0 ? out[(y - 1) * stride + i] : 0;
      const upLeft = y > 0 && i >= channels ? out[(y - 1) * stride + i - channels] : 0;
      let value = row[i];

      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }

      out[y * stride + i] = value & 0xff;
    }
  }

  // Normaliza para RGBA.
  const rgba = new Uint8Array(width * height * 4);

  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = out[i * channels];
    rgba[i * 4 + 1] = out[i * channels + 1];
    rgba[i * 4 + 2] = out[i * channels + 2];
    rgba[i * 4 + 3] = channels === 4 ? out[i * channels + 3] : 255;
  }

  return { width, height, rgba };
}

const png = decodePng(readFileSync(here('./public/assets/grasscolor.png')));
const grassPixels = grassPixelsFromRgba(png.rgba);

const [header, ...lines] = readFileSync(here('./tests/golden/climate.tsv'), 'utf8')
  .trim()
  .split('\n');

assert.equal(
  header,
  'seed\tx\tz\tbiomaId\tbioma\ttempQ16\tchuvaQ16\ttemp\tchuva\tidxX\tidxY\tgrassRGB',
);

const rows = lines.map((line) => {
  const c = line.split('\t');

  return {
    seed: BigInt(c[0]),
    x: Number(c[1]),
    z: Number(c[2]),
    biomeId: Number(c[3]),
    biomeName: c[4],
    temperatureQ16: Number(c[5]),
    rainfallQ16: Number(c[6]),
    temperature: Number(c[7]),
    rainfall: Number(c[8]),
    grassX: Number(c[9]),
    grassY: Number(c[10]),
    grass: parseInt(c[11], 16),
  };
});

test('golden tem 3072 pontos', () => {
  assert.equal(rows.length, 3072);
});

test('grasscolor.png tem 256x256', () => {
  assert.equal(png.width, 256);
  assert.equal(png.height, 256);
});

test('q16ToClimate: divide por 65536 e aplica teto 1.0 sem piso', () => {
  assert.equal(q16ToClimate(0), 0);
  assert.equal(q16ToClimate(32768), 0.5);
  assert.equal(q16ToClimate(65536), 1);
  assert.equal(q16ToClimate(131072), 1); // deserto: 2.0 vira 1.0
  assert.equal(q16ToClimate(52428), Math.fround(52428 / 65536));
  assert.equal(q16ToClimate(-65536), -1); // sem piso, como no original
});

test('grassColorIndex: mesma conta de ha.a(double,double)', () => {
  assert.deepEqual(grassColorIndex(1, 1), { x: 0, y: 0, index: 0 }); // quente e úmido: canto superior esquerdo
  assert.deepEqual(grassColorIndex(1, 0), { x: 0, y: 255, index: 255 << 8 }); // chuva 0: linha de baixo
  assert.deepEqual(grassColorIndex(0, 1), { x: 255, y: 255, index: 65535 });
  assert.deepEqual(grassColorIndex(0.5, 1), { x: 127, y: 127, index: (127 << 8) | 127 });
  assert.throws(() => grassColorIndex(2, 0), RangeError);
});

// Janelas de 16x16 (256 linhas consecutivas), como gerado por tools/climate-golden.sh.
const WINDOW = 256;
const windows = [];

for (let i = 0; i < rows.length; i += WINDOW) windows.push(rows.slice(i, i + WINDOW));

const queries = new Map();

function queryFor(seed) {
  if (!queries.has(seed)) queries.set(seed, createClimateQuery(seed, { grassPixels }));
  return queries.get(seed);
}

for (const win of windows) {
  const first = win[0];

  test(`janela seed=${first.seed} x=${first.x} z=${first.z}: id, Q16, clima, índices e cor`, () => {
    const r = queryFor(first.seed).region(first.x, first.z, 16, 16);

    win.forEach((row, i) => {
      const label = `seed=${row.seed} (${row.x},${row.z})`;

      assert.equal(row.x, first.x + (i % 16), `${label}: ordem x`);
      assert.equal(row.z, first.z + Math.floor(i / 16), `${label}: ordem z`);

      assert.equal(r.biomeIds[i], row.biomeId, `${label}: id do bioma`);
      assert.equal(r.temperatureQ16[i], row.temperatureQ16, `${label}: temp Q16`);
      assert.equal(r.rainfallQ16[i], row.rainfallQ16, `${label}: chuva Q16`);

      // O Java imprime com %.6f; compara no mesmo formato.
      assert.equal(r.temperature[i].toFixed(6), row.temperature.toFixed(6), `${label}: temp`);
      assert.equal(r.rainfall[i].toFixed(6), row.rainfall.toFixed(6), `${label}: chuva`);

      assert.equal(r.grassX[i], row.grassX, `${label}: idxX`);
      assert.equal(r.grassY[i], row.grassY, `${label}: idxY`);
      assert.equal(r.grass[i], row.grass, `${label}: cor da grama`);
    });
  });
}

test('at() concorda com region() em pontos soltos', () => {
  const sample = rows.filter((_, i) => i % 97 === 0);

  for (const row of sample) {
    const p = queryFor(row.seed).at(row.x, row.z);

    assert.equal(p.biomeId, row.biomeId);
    assert.equal(p.temperatureQ16, row.temperatureQ16);
    assert.equal(p.rainfallQ16, row.rainfallQ16);
    assert.equal(p.grass, row.grass);
  }
});

test('o teto de 1.0 é exercitado (deserto, Q16 > 65536)', () => {
  const clamped = rows.filter((row) => row.temperatureQ16 > 65536);

  assert.ok(clamped.length > 0);
  for (const row of clamped) assert.equal(row.temperature, 1);
});
