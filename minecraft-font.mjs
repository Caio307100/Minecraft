function loadGlyphWidths(rgba, width, height) {
    if (width !== 128 || height !== 128 || rgba.length !== 128 * 128 * 4) {
        throw new Error('Atlas de fonte incompatível: esperado 128x128 RGBA.');
    }

    const widths = new Uint8Array(256);

    for (let glyph = 0; glyph < 256; glyph++) {
        let x = 7;
        const cellX = (glyph % 16) * 8;
        const cellY = Math.floor(glyph / 16) * 8;

        for (; x >= 0; x--) {
            let found = false;

            for (let y = 0; y < 8; y++) {
                const offset = ((cellY + y) * width + cellX + x) * 4;

                if (rgba[offset + 2] > 0) {
                    found = true;
                    break;
                }
            }

            if (found) break;
        }

        widths[glyph] = glyph === 32 ? 4 : x + 2;
    }

    return widths;
}

export function createMinecraftFont({
    fontText,
    defaultPixels,
    alternatePixels,
    defaultUrl = './public/assets/mc10/font/default.png',
    alternateUrl = './public/assets/mc10/font/alternate.png'
}) {
    const characters = fontText
        .split(/\r?\n/)
        .filter(line => !line.startsWith('#'))
        .join('');

    if (!defaultPixels || !alternatePixels) {
        throw new Error('As duas texturas da fonte são obrigatórias.');
    }

    const defaultWidths = loadGlyphWidths(
        defaultPixels.rgba,
        defaultPixels.width,
        defaultPixels.height
    );

    const alternateWidths = loadGlyphWidths(
        alternatePixels.rgba,
        alternatePixels.width,
        alternatePixels.height
    );

    function getGlyph(character, alternate = false) {
        const index = characters.indexOf(character);

        if (index < 0) return null;

        const glyph = index + 32;
        const widths = alternate ? alternateWidths : defaultWidths;

        return {
            index: glyph,
            width: widths[glyph],
            x: (glyph % 16) * 8,
            y: Math.floor(glyph / 16) * 8
        };
    }

    function measureText(text, alternate = false) {
        let width = 0;

        for (const character of text) {
            const glyph = getGlyph(character, alternate);
            if (glyph) width += glyph.width;
        }

        return width;
    }

    return {
        characters,
        defaultWidths,
        alternateWidths,
        defaultUrl,
        alternateUrl,
        getGlyph,
        measureText
    };
}

async function loadAtlas(url) {
    const image = new Image();
    image.src = url;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);

    return {
        width: canvas.width,
        height: canvas.height,
        rgba: context.getImageData(0, 0, canvas.width, canvas.height).data
    };
}

export async function loadMinecraftFont() {
    const [fontResponse, defaultPixels, alternatePixels] = await Promise.all([
        fetch('./public/assets/mc10/font/font.txt'),
        loadAtlas('./public/assets/mc10/font/default.png'),
        loadAtlas('./public/assets/mc10/font/alternate.png')
    ]);

    if (!fontResponse.ok) {
        throw new Error(`Não foi possível carregar font.txt: HTTP ${fontResponse.status}`);
    }

    return createMinecraftFont({
        fontText: await fontResponse.text(),
        defaultPixels,
        alternatePixels
    });
}

export function setMinecraftText(element, text, font, {
    alternate = false,
    scale = 1,
    shadow = true
} = {}) {
    if (!element) return;

    const wrapper = document.createElement('span');
    wrapper.className = 'mc-text';
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.style.height = `${8 * scale}px`;
    wrapper.style.lineHeight = `${8 * scale}px`;
    if (shadow) wrapper.style.filter = 'drop-shadow(1px 1px 0 #3f3f3f)';

    for (const character of String(text)) {
        const glyph = font.getGlyph(character, alternate);
        if (!glyph) continue;

        const node = document.createElement('span');
        const atlas = alternate ? font.alternateUrl : font.defaultUrl;
        const maskImage = `url("${atlas}")`;
        node.className = 'mc-glyph';
        // FontRenderer do Minecraft 1.0 desenha cada glifo em um quad
        // de 7.99x7.99 px e só depois avança pela largura calculada.
        // Usar glyph.width como largura do quad cortava as letras.
        node.style.width = `${8 * scale}px`;
        node.style.height = `${8 * scale}px`;
        node.style.marginRight = `${(glyph.width - 8) * scale}px`;
        node.style.backgroundColor = 'currentColor';
        node.style.maskImage = maskImage;
        node.style.maskSize = `${128 * scale}px ${128 * scale}px`;
        node.style.maskPosition = `-${glyph.x * scale}px -${glyph.y * scale}px`;
        node.style.maskRepeat = 'no-repeat';
        node.style.webkitMaskImage = maskImage;
        node.style.webkitMaskSize = `${128 * scale}px ${128 * scale}px`;
        node.style.webkitMaskPosition = `-${glyph.x * scale}px -${glyph.y * scale}px`;
        node.style.webkitMaskRepeat = 'no-repeat';
        wrapper.append(node);
    }

    element.setAttribute('aria-label', String(text));
    element.replaceChildren(wrapper);
}
