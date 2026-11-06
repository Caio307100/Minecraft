// Lightmap RGB 16x16 do Minecraft Java 1.0 (adt.e()) para o Overworld.
export function createMinecraft10Lightmap({
    worldBrightness = 1,
    torchFlicker = 0,
    gamma = 0,
    lightning = false
} = {}) {
    const brightness = Array.from({ length: 16 }, (_, level) => {
        const darkness = 1 - level / 15;
        return (1 - darkness) / (darkness * 3 + 1);
    });
    const pixels = new Uint8Array(16 * 16 * 4);

    for (let sky = 0; sky < 16; sky++) {
        for (let block = 0; block < 16; block++) {
            const skyBase = brightness[sky];
            const skyFactor = worldBrightness * 0.95 + 0.05;
            let skyValue = skyBase * skyFactor;
            if (lightning) skyValue = skyBase;

            const blockValue = brightness[block] * (torchFlicker * 0.1 + 1.5);
            const skyTint = skyValue * (worldBrightness * 0.65 + 0.35);
            let red = skyTint + blockValue;
            let green = skyTint + blockValue * ((blockValue * 0.6 + 0.4) * 0.6 + 0.4);
            let blue = skyValue + blockValue * (blockValue * blockValue * 0.6 + 0.4);

            red = red * 0.96 + 0.03;
            green = green * 0.96 + 0.03;
            blue = blue * 0.96 + 0.03;

            const applyGamma = value => {
                value = Math.min(1, value);
                const gammaCurve = 1 - Math.pow(1 - value, 4);
                return value * (1 - gamma) + gammaCurve * gamma;
            };
            red = applyGamma(red) * 0.96 + 0.03;
            green = applyGamma(green) * 0.96 + 0.03;
            blue = applyGamma(blue) * 0.96 + 0.03;

            const i = (sky * 16 + block) * 4;
            pixels[i] = Math.floor(Math.max(0, Math.min(1, red)) * 255);
            pixels[i + 1] = Math.floor(Math.max(0, Math.min(1, green)) * 255);
            pixels[i + 2] = Math.floor(Math.max(0, Math.min(1, blue)) * 255);
            pixels[i + 3] = 255;
        }
    }
    return pixels;
}
