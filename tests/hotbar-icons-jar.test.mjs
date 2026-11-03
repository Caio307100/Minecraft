import test from 'node:test';
import assert from 'node:assert/strict';

import { faceShade, itemModelView, EYE_LIGHT_DIRECTIONS } from '../hotbar-renderer.mjs';
import { grassColorIndex } from '../climate.mjs';

// --- implementação independente (matrizes 3x3 por cofactores, rotações por Rodrigues) -------

const deg = (value) => value * Math.PI / 180;

function rotation3(angle, [x, y, z]) {
  const length = Math.hypot(x, y, z);
  [x, y, z] = [x / length, y / length, z / length];
  const c = Math.cos(deg(angle));
  const s = Math.sin(deg(angle));
  const t = 1 - c;

  // linhas
  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
}

const mulVec = (m, v) => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
const mulMat = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
const normalize = (v) => v.map((x) => x / Math.hypot(...v));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function inverse3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);

  return [
    [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
    [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ];
}

const transpose3 = (m) => [0, 1, 2].map((j) => [m[0][j], m[1][j], m[2][j]]);

// Parte 3x3 do modelview de iw.a (sem translações): S(10) * S(1,1,-1) * Rx(210) * Ry(45) * Ry(-90).
const linearPart = [
  [[10, 0, 0], [0, 10, 0], [0, 0, 10]],
  [[1, 0, 0], [0, 1, 0], [0, 0, -1]],
  rotation3(210, [1, 0, 0]),
  rotation3(45, [0, 1, 0]),
  rotation3(-90, [0, 1, 0]),
].reduce(mulMat);

// rt.c(): glRotatef(-30, Y) depois glRotatef(165, X); luzes em eye space = M * posição.
const lightMatrix = mulMat(rotation3(-30, [0, 1, 0]), rotation3(165, [1, 0, 0]));
const lights = [
  normalize(mulVec(lightMatrix, normalize([0.2, 1, -0.7]))),
  normalize(mulVec(lightMatrix, normalize([-0.2, 1, 0.7]))),
];

function referenceShade(normal) {
  // Normal em eye space = (M^-1)^T n, depois GL_RESCALE_NORMAL/normalização.
  const eye = normalize(mulVec(transpose3(inverse3(linearPart)), normal));
  const diffuse = lights.reduce((sum, light) => sum + Math.max(0, dot(eye, light)) * 0.6, 0);

  return Math.min(1, 0.4 + diffuse);
}

const FACES = {
  bottom: [0, -1, 0],
  top: [0, 1, 0],
  north: [0, 0, -1],
  south: [0, 0, 1],
  west: [-1, 0, 0],
  east: [1, 0, 0],
};

for (const [name, normal] of Object.entries(FACES)) {
  test(`brilho da face ${name} bate com a conta de GL (inversa transposta, ambiente 0,4, difusa 0,6)`, () => {
    assert.ok(Math.abs(faceShade(normal) - referenceShade(normal)) < 1e-6);
  });
}

test('luzes em eye space: mesma conta independente', () => {
  EYE_LIGHT_DIRECTIONS.forEach((light, index) => {
    light.forEach((component, axis) => {
      assert.ok(Math.abs(component - lights[index][axis]) < 1e-6);
    });
  });
});

test('faces visíveis do ícone: topo mais claro, esquerda (+Z) média, direita (+X) mais escura', () => {
  // Valores derivados do bytecode (rt.b/rt.c + iw.a); a face de baixo e as de trás não aparecem.
  assert.ok(Math.abs(faceShade(FACES.top) - 1.0) < 1e-6);
  assert.ok(Math.abs(faceShade(FACES.south) - 0.6366) < 1e-3);
  assert.ok(Math.abs(faceShade(FACES.east) - 0.4347) < 1e-3);
  assert.ok(faceShade(FACES.top) > faceShade(FACES.south));
  assert.ok(faceShade(FACES.south) > faceShade(FACES.east));
});

test('ícone ocupa o slot 16x16: centro em (x+8, y+8) e largura de 10*sqrt(2)', () => {
  const m = itemModelView(3, 3);
  const xs = [];
  const ys = [];

  for (const x of [0, 1]) {
    for (const y of [0, 1]) {
      for (const z of [0, 1]) {
        xs.push(m[0] * x + m[4] * y + m[8] * z + m[12]);
        ys.push(m[1] * x + m[5] * y + m[9] * z + m[13]);
      }
    }
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  assert.ok(Math.abs((minX + maxX) / 2 - 11) < 1e-6);
  assert.ok(Math.abs((minY + maxY) / 2 - 11) < 1e-6);
  assert.ok(Math.abs((maxX - minX) - 10 * Math.SQRT2) < 1e-6);
  assert.ok(minX >= 3 && maxX <= 19 && minY >= 3 && maxY <= 19);
});

test('topo da grama no inventário: ha.a(0.5, 1.0) -> pixel (127, 127) do grasscolor.png', () => {
  const cell = grassColorIndex(0.5, 1.0);

  assert.equal(cell.x, 127);
  assert.equal(cell.y, 127);
});
