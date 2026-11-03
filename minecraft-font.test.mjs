import test from 'node:test';
import assert from 'node:assert/strict';
import { createMinecraftFont } from './minecraft-font.mjs';

function createAtlas(glyph, pixelX) {
    const rgba = new Uint8Array(128 * 128 * 4);
    const cellX = (glyph % 16) * 8;
    const cellY = Math.floor(glyph / 16) * 8;
    const offset = (cellY * 128 + cellX + pixelX) * 4;

    rgba[offset + 2] = 255;

    return { width: 128, height: 128, rgba };
}

test('mapeia caracteres usando o deslocamento original +32', () => {
    const font = createMinecraftFont({
        fontText: '# comentário\n !A',
        defaultPixels: createAtlas(33, 5),
        alternatePixels: createAtlas(33, 5)
    });

    assert.equal(font.getGlyph(' ').index, 32);
    assert.equal(font.getGlyph('!').index, 33);
    assert.equal(font.getGlyph('A').index, 34);
});

test('espaço possui largura fixa de 4 pixels', () => {
    const font = createMinecraftFont({
        fontText: ' ',
        defaultPixels: createAtlas(32, 7),
        alternatePixels: createAtlas(32, 7)
    });

    assert.equal(font.getGlyph(' ').width, 4);
});

test('calcula largura pelo pixel mais à direita', () => {
    const font = createMinecraftFont({
        fontText: ' !',
        defaultPixels: createAtlas(33, 5),
        alternatePixels: createAtlas(33, 5)
    });

    assert.equal(font.getGlyph('!').width, 7);
    assert.equal(font.measureText('!'), 7);
});

test('ignora caracteres ausentes', () => {
    const font = createMinecraftFont({
        fontText: 'A',
        defaultPixels: createAtlas(32, 7),
        alternatePixels: createAtlas(32, 7)
    });

    assert.equal(font.getGlyph('?'), null);
    assert.equal(font.measureText('?'), 0);
});
