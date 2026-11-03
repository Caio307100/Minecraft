// Port das classes gk (água corrente) e va (água parada) do Minecraft Java 1.0.
const SIZE = 256;

function byte(value) {
    return value & 255;
}

function grayscale(r, g, b) {
    return [
        (r * 30 + g * 59 + b * 11) / 100 | 0,
        (r * 30 + g * 70) / 100 | 0,
        (r * 30 + b * 70) / 100 | 0
    ];
}

function createWaterTexture(index, duplicate = false) {
    let g = new Float32Array(256);
    let h = new Float32Array(256);
    const i = new Float32Array(256);
    const j = new Float32Array(256);
    let tick = 0;

    function update() {
        let p = 0;
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                let value = 0;
                if (index === 205) {
                    for (let xx = x - 1; xx <= x + 1; xx++) {
                        value += g[(xx & 15) + (y & 15) * 16];
                    }
                    h[p] = value / 3.3 + i[p] * 0.8;
                } else {
                    for (let yy = x - 2; yy <= x; yy++) {
                        value += g[(y & 15) + (yy & 15) * 16];
                    }
                    h[p] = value / 3.2 + i[p] * 0.8;
                }
                i[p] += j[p] * 0.05;
                if (i[p] < 0) i[p] = 0;
                j[p] -= index === 205 ? 0.1 : 0.3;
                if (Math.random() < (index === 205 ? 0.05 : 0.2)) j[p] = 0.5;
                p++;
            }
        }
        const old = h;
        h = g;
        g = old;
        tick++;

        const pixels = new Uint8Array(16 * 16 * 4);
        for (let n = 0; n < 256; n++) {
            let value = index === 205 ? g[n] : g[(n - tick * 16) & 255];
            value = Math.max(0, Math.min(1, value));
            const square = value * value;
            let r = index === 205 ? (32 + square * 32) | 0 : (32 + square * 32) | 0;
            let green = index === 205 ? (50 + square * 64) | 0 : (50 + square * 64) | 0;
            let blue = 255;
            const alpha = (146 + square * 50) | 0;
            if (false) [r, green, blue] = grayscale(r, green, blue);
            const offset = n * 4;
            pixels[offset] = byte(r);
            pixels[offset + 1] = byte(green);
            pixels[offset + 2] = byte(blue);
            pixels[offset + 3] = byte(alpha);
        }
        return pixels;
    }

    return { update, duplicate };
}

export function createMinecraft10WaterTextureAnimation(gl, atlasTexture) {
    const flowing = createWaterTexture(205);
    const still = createWaterTexture(206, true);
    let lastTick = 0;

    return function update(now) {
        if (now - lastTick < 50) return;
        lastTick = now;
        gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        const flowingPixels = flowing.update();
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 208, 192, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, flowingPixels);
        const stillPixels = still.update();
        // va.e = 2 no JAR: a textura é repetida nos quatro tiles da região 2x2.
        for (let y = 0; y < 2; y++) {
            for (let x = 0; x < 2; x++) {
                gl.texSubImage2D(gl.TEXTURE_2D, 0, 224 + x * 16, 192 + y * 16, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, stillPixels);
            }
        }
    };
}
