import test from 'node:test';
import assert from 'node:assert/strict';
import { createMinecraft10Lightmap } from './lightmap-mc10.mjs';

test('gera lightmap RGBA 16x16 com alpha opaco', () => {
    const pixels = createMinecraft10Lightmap();
    assert.equal(pixels.length, 16 * 16 * 4);
    for (let i = 3; i < pixels.length; i += 4) assert.equal(pixels[i], 255);
});

test('luz aumenta com os níveis de céu e bloco', () => {
    const pixels = createMinecraft10Lightmap();
    const pixel = (sky, block) => [...pixels.slice((sky * 16 + block) * 4, (sky * 16 + block) * 4 + 3)];
    const dark = pixel(0, 0);
    const skyLit = pixel(15, 0);
    const torchLit = pixel(0, 15);
    assert.ok(skyLit[0] > dark[0]);
    assert.ok(torchLit[0] > dark[0]);
});

test('gamma e flicker alteram a textura', () => {
    const base = createMinecraft10Lightmap();
    const gamma = createMinecraft10Lightmap({ gamma: 1 });
    const flicker = createMinecraft10Lightmap({ torchFlicker: 4 });
    assert.notDeepEqual(gamma, base);
    assert.notDeepEqual(flicker, base);
});
