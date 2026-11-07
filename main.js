import { createClimateQuery, grassColor, grassColorIndex, grassPixelsFromRgba } from './climate.mjs';
import { initializeWebAssets } from './web-assets.mjs';
import { openWorldMenu } from './world-menu.mjs';
import { createWorldStorage, serializeModifiedChunks, deserializeModifiedChunks } from './world-storage.mjs';
import { buildTerrainMesh } from './terrain-mesher.mjs';
import { createWorldLightingTask, initializeChunkLighting, refreshSkyLightColumn } from './sky-light.mjs';
import { createMinecraft10Lightmap } from './lightmap-mc10.mjs';
import { buildBlockMesh } from './mine-mesher.mjs';
import { createLegacyAudio } from './legacy-audio.mjs';
import { createWaterSimulation } from './water-simulation.mjs';
import { createMinecraft10ParticleEngine } from './particles-mc10.mjs';
import { createMinecraft10WaterTextureAnimation } from './water-texture-animation.mjs';
import { MINE_TICK_MS, getBareHandMiningProgressPerTick, getMiningCrackStage } from './mining-timing.mjs';
const legacyAudio = createLegacyAudio();
import { createHotbarRenderer } from './hotbar-renderer.mjs';
import { loadMinecraftFont, setMinecraftText } from './minecraft-font.mjs';
import { createSteveInventoryPreview } from './steve-preview.mjs';
import { getMinecraft10InventoryLayout, getMinecraft10HudIconPosition, getMinecraft10ItemTooltipName } from './inventory-layout.mjs';
import { createSteveMeshes, createStevePartMatrices, createSteveFirstPersonArmMatrix, updatePlayerBodyRotation, STEVE_PART_ORDER } from './steve.mjs';
import {
    FoodStatsMC10, InventoryPlayerMC10, ItemStackMC10, DroppedItemMC10,
    getMinecraft10BlockDrop, createPlayerDrop, createBlockDrop
} from './survival-mc10.mjs';

await initializeWebAssets();

const canvas = document.querySelector('#game');
const gl = canvas.getContext('webgl2');

if (!gl) throw new Error('WebGL 2.0 não disponível.');

const gpuTimerExtension = gl.getExtension('EXT_disjoint_timer_query_webgl2');

const minecraftFont = await loadMinecraftFont();
const debugOverlay = document.querySelector('#debug-overlay');
// F3 do Minecraft 1.0: linhas em y fixos (px de GUI), cor 0xFFFFFF nas 5 primeiras e 0xE0E0E0 nas demais.
const debugLeftLines = [2, 12, 22, 32, 42, 64, 72, 80, 88, 104].map((row, index) => {
    const line = document.createElement('div');
    line.className = 'left';
    line.style.top = `calc(${row}px * var(--hud-scale, 1))`;
    line.style.color = index < 5 ? '#ffffff' : '#e0e0e0';
    debugOverlay.append(line);
    return line;
});
const debugRightLines = [2, 12].map(row => {
    const line = document.createElement('div');
    line.className = 'right';
    line.style.top = `calc(${row}px * var(--hud-scale, 1))`;
    line.style.color = '#e0e0e0';
    debugOverlay.append(line);
    return line;
});

// Gráfico de barras (canto inferior esquerdo): 512 amostras de 1px, uma por tick de 50 ms.
const debugLagCanvas = document.createElement('canvas');
debugLagCanvas.width = 512;
debugLagCanvas.height = 166;
Object.assign(debugLagCanvas.style, {
    position: 'fixed', left: '0', bottom: '0', width: '512px', height: '166px',
    zIndex: '99', display: 'none', pointerEvents: 'none', imageRendering: 'pixelated'
});
document.body.append(debugLagCanvas);
const debugLagCtx = debugLagCanvas.getContext('2d');

// Pizza do profiler (canto inferior direito): centro em (largura-170, altura-320), raio 160, como no jar.
const DEBUG_PIE_W = 346, DEBUG_PIE_H = 432, DEBUG_PIE_X = 176, DEBUG_PIE_Y = 112, DEBUG_PIE_R = 160;
const debugProfiler = document.createElement('div');
Object.assign(debugProfiler.style, {
    position: 'fixed', right: '0', bottom: '0', width: `${DEBUG_PIE_W}px`, height: `${DEBUG_PIE_H}px`,
    zIndex: '99', display: 'none', pointerEvents: 'none', whiteSpace: 'pre', color: '#ffffff'
});
const debugProfilerCanvas = document.createElement('canvas');
debugProfilerCanvas.width = DEBUG_PIE_W;
debugProfilerCanvas.height = DEBUG_PIE_H;
Object.assign(debugProfilerCanvas.style, {
    position: 'absolute', left: '0', top: '0', width: `${DEBUG_PIE_W}px`, height: `${DEBUG_PIE_H}px`, display: 'block'
});
debugProfiler.append(debugProfilerCanvas);
const debugProfilerCtx = debugProfilerCanvas.getContext('2d');
const debugProfText = style => {
    const el = document.createElement('div');
    Object.assign(el.style, { position: 'absolute', height: '8px', ...style });
    debugProfiler.append(el);
    return el;
};
const debugProfHeaderName = debugProfText({ left: '16px', top: '16px' });
const debugProfHeaderShare = debugProfText({ right: '10px', top: '16px' });
const debugProfRows = Array.from({ length: 5 }, (_, i) => {
    const top = `${212 + i * 8}px`;
    return {
        name: debugProfText({ left: '16px', top }),
        share: debugProfText({ right: '60px', top }),
        global: debugProfText({ right: '10px', top })
    };
});
document.body.append(debugProfiler);
// Cor do profiler do 1.0: (String.hashCode(nome) & 0xAAAAAA) + 0x444444.
const debugJavaHash = name => {
    let hash = 0;
    for (const character of name) hash = (Math.imul(31, hash) + character.charCodeAt(0)) | 0;
    return hash;
};
const debugProfColor = name => (debugJavaHash(name) & 0xAAAAAA) + 0x444444;
const debugHex = color => '#' + (color & 0xFFFFFF).toString(16).padStart(6, '0');
const debugPercent = value => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
const debugJavaDouble = value => Number.isInteger(value) ? value.toFixed(1) : String(value);
setMinecraftText(document.querySelector('#inventory-title'), 'Crafting', minecraftFont, { shadow: false });
setMinecraftText(document.querySelector('#death-title'), 'You died!', minecraftFont, { scale: 2 });
setMinecraftText(document.querySelector('#death-score'), 'Score: 0', minecraftFont);
setMinecraftText(document.querySelector('#respawn-button'), 'Respawn', minecraftFont);
setMinecraftText(document.querySelector('#game-menu-title'), 'Game menu', minecraftFont, { shadow: true });
for (const button of document.querySelectorAll('.game-menu-button')) {
    setMinecraftText(button, button.textContent, minecraftFont, { shadow: true });
}


const vertexShader = `#version 300 es
in vec3 a_position;
in vec2 a_uv;
in vec3 a_normal;
in vec3 a_color;
in vec2 a_light;
in float a_alpha;

uniform mat4 u_mvp;
uniform mat4 u_model;
uniform vec3 u_offset;

out vec2 v_uv;
out vec3 v_normal;
out vec3 v_color;
out vec2 v_light;
out float v_alpha;
out vec3 v_worldPosition;

void main() {
    vec4 modelPosition = u_model * vec4(a_position, 1.0);
    vec3 worldPosition = modelPosition.xyz + u_offset;
    gl_Position = u_mvp * vec4(worldPosition, 1.0);
    v_worldPosition = worldPosition;
    v_uv = a_uv;
    v_normal = mat3(u_model) * a_normal;
    v_color = a_color;
    v_light = a_light;
    v_alpha = a_alpha;
}`;

const fragmentShader = `#version 300 es
precision highp float;

in vec2 v_uv;
in vec3 v_normal;
in vec3 v_color;
in vec2 v_light;
in float v_alpha;
in vec3 v_worldPosition;

uniform sampler2D u_texture;
uniform sampler2D u_lightmap;
uniform float u_applyLightmap;
uniform float u_alphaMultiplier;
uniform float u_alphaTest;
uniform float u_underwater;
uniform vec3 u_cameraPosition;
uniform float u_handLighting;
uniform float u_handLight;
uniform vec2 u_handLightUv;

out vec4 outColor;

void main() {
    float shade;
    vec3 handLightColor = vec3(1.0);

    if (u_handLighting > 0.5) {
        vec3 normal = normalize(v_normal);
        // EntityRenderer do Minecraft 1.0 usa duas luzes direcionais fixas.
        vec3 lightA = normalize(vec3(-0.2, 1.0, -0.7));
        vec3 lightB = normalize(vec3(0.2, 1.0, 0.7));
        float diffuse = max(dot(normal, lightA), 0.0)
                      + max(dot(normal, lightB), 0.0);
        handLightColor = texture(u_lightmap, u_handLightUv).rgb;
        shade = min(1.0, 0.4 + 0.6 * diffuse) * u_handLight;
    } else if (v_normal.y > 0.5) shade = 1.0;
    else if (v_normal.y < -0.5) shade = 0.5;
    else if (abs(v_normal.z) > 0.5) shade = 0.8;
    else shade = 0.6;

    vec4 texel = texture(u_texture, v_uv);
    // Folhas e demais texturas recortadas do terrain.png usam alpha-test,
    // não transparência por mistura. O atlas original tem alpha binário.
    if (u_alphaTest > 0.5 && texel.a < 0.5) discard;
    // O JAR usa uma textura 16x16 RGB: eixo X = block light, eixo Y = sky light.
    // As coordenadas apontam para o centro dos texels e preservam interpolação bilinear.
    vec2 lightmapUv = (clamp(v_light.yx, 0.0, 1.0) * 15.0 + 0.5) / 16.0;
    vec3 worldLight = texture(u_lightmap, lightmapUv).rgb;
    vec3 particleAwareLight = mix(vec3(1.0), worldLight, u_applyLightmap);
    vec3 finalColor = texel.rgb * v_color * shade * particleAwareLight * handLightColor;

    if (u_underwater > 0.5) {
        float distanceToCamera =
            distance(v_worldPosition, u_cameraPosition);

        float fog = clamp(
            (distanceToCamera - 2.0) / 16.0,
            0.0,
            1.0
        );

        finalColor = mix(
            finalColor,
            vec3(0.015, 0.08, 0.16),
            0.45 + 0.45 * fog
        );
    }

    outColor = vec4(finalColor, texel.a * u_alphaMultiplier * v_alpha);
}`;

function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
    }

    return shader;
}

function createProgram() {
    const program = gl.createProgram();

    gl.attachShader(program, createShader(gl.VERTEX_SHADER, vertexShader));
    gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fragmentShader));
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
    }

    return program;
}


function createOutlineProgram() {
    const vertex = `#version 300 es
    in vec3 a_position;
    uniform mat4 u_mvp;
    uniform vec3 u_offset;
    void main() {
        gl_Position = u_mvp * vec4(a_position + u_offset, 1.0);
    }`;

    const fragment = `#version 300 es
    precision mediump float;
    uniform vec4 u_color;
    out vec4 outColor;
    void main() {
        outColor = u_color;
    }`;

    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
    }

    return program;
}

function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const nf = 1 / (near - far);

    return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0
    ]);
}

function lookAt(eye, center, up) {
    const normalize = v => {
        const length = Math.hypot(...v);
        return v.map(n => n / length);
    };

    const cross = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];

    const subtract = (a, b) => a.map((n, i) => n - b[i]);
    const z = normalize(subtract(eye, center));
    const x = normalize(cross(up, z));
    const y = cross(z, x);

    return new Float32Array([
        x[0], y[0], z[0], 0,
        x[1], y[1], z[1], 0,
        x[2], y[2], z[2], 0,
        -x.reduce((s, n, i) => s + n * eye[i], 0),
        -y.reduce((s, n, i) => s + n * eye[i], 0),
        -z.reduce((s, n, i) => s + n * eye[i], 0),
        1
    ]);
}

function multiply(a, b) {
    const out = new Float32Array(16);

    for (let column = 0; column < 4; column++) {
        for (let row = 0; row < 4; row++) {
            for (let k = 0; k < 4; k++) {
                out[column * 4 + row] +=
                    a[k * 4 + row] * b[column * 4 + k];
            }
        }
    }

    return out;
}

function translationMatrix(x, y, z) {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        x, y, z, 1
    ]);
}

function scalingMatrix(x, y, z) {
    return new Float32Array([
        x, 0, 0, 0,
        0, y, 0, 0,
        0, 0, z, 0,
        0, 0, 0, 1
    ]);
}

function rotationXMatrix(angle) {
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    return new Float32Array([
        1, 0, 0, 0,
        0, c, sn, 0,
        0, -sn, c, 0,
        0, 0, 0, 1
    ]);
}

function rotationZMatrix(angle) {
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    return new Float32Array([
        c, sn, 0, 0,
        -sn, c, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
}

// Reproduz adt.e(float) do Minecraft 1.0: translação e rotações da câmera.
function createViewBobbingMatrix(walkDistance, bobAmount, cameraPitch) {
    const phase = -walkDistance * Math.PI;
    const degrees = Math.PI / 180;
    const translateX = Math.sin(phase) * bobAmount * 0.5;
    const translateY = -Math.abs(Math.cos(phase) * bobAmount);
    const rotateZ = Math.sin(phase) * bobAmount * 3 * degrees;
    const rotateX = Math.abs(Math.cos(phase - 0.2) * bobAmount) * 5 * degrees;

    return [
        translationMatrix(translateX, translateY, 0),
        rotationZMatrix(rotateZ),
        rotationXMatrix(rotateX),
        rotationXMatrix(cameraPitch * degrees)
    ].reduce((matrix, transform) => multiply(matrix, transform));
}

function rotationYMatrix(angle) {
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    return new Float32Array([
        c, 0, -sn, 0,
        0, 1, 0, 0,
        sn, 0, c, 0,
        0, 0, 0, 1
    ]);
}

/** n.a(float): transformação original do item segurado em primeira pessoa no Minecraft 1.0. */
function createHeldBlockMatrix(swingProgress, equippedProgress = 1) {
    const degrees = Math.PI / 180;
    const swingRootSin = Math.sin(Math.sqrt(swingProgress) * Math.PI);
    const swingBob = Math.sin(Math.sqrt(swingProgress) * Math.PI * 2);
    const swingSin = Math.sin(swingProgress * Math.PI);
    const swingSquaredSin = Math.sin(swingProgress * swingProgress * Math.PI);
    const transforms = [
        translationMatrix(-swingRootSin * 0.4, swingBob * 0.2, -swingSin * 0.2),
        translationMatrix(0.56, -0.52 - (1 - equippedProgress) * 0.6, -0.72),
        rotationYMatrix(45 * degrees),
        rotationYMatrix(-swingSquaredSin * 20 * degrees),
        rotationZMatrix(-swingRootSin * 20 * degrees),
        rotationXMatrix(-swingRootSin * 80 * degrees),
        scalingMatrix(0.4, 0.4, 0.4),
        translationMatrix(-0.5, -0.5, -0.5)
    ];
    const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
    return transforms.reduce((matrix, transform) => multiply(matrix, transform), identity);
}

/** zr.java: posiciona o bloco na mão direita do Steve em terceira pessoa. */
function createThirdPersonHeldBlockMatrix(rightArmMatrix) {
    const degrees = Math.PI / 180;
    const transforms = [
        translationMatrix(-0.0625, 0.4375, 0.0625),
        translationMatrix(0, 0.1875, -0.3125),
        rotationXMatrix(20 * degrees),
        rotationYMatrix(45 * degrees),
        scalingMatrix(0.375, -0.375, 0.375)
    ];
    return transforms.reduce((matrix, transform) => multiply(matrix, transform), rightArmMatrix);
}

function createBuffer(target, data) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(target, buffer);
    gl.bufferData(target, data, gl.STATIC_DRAW);
    return buffer;
}

const DEFAULT_WORLD_SEED = 12345n;

function createRandomWorldSeed() {
    const words = new Uint32Array(2);
    crypto.getRandomValues(words);
    return BigInt.asIntN(64, (BigInt(words[0]) << 32n) | BigInt(words[1]));
}

/** Semente do mundo (long do Java). Aceita ?seed=<inteiro> na URL; inválida cai no padrão. */
function readWorldSeed() {
    const raw = new URLSearchParams(window.location.search).get('seed');

    if (raw === null) return createRandomWorldSeed();

    try {
        return BigInt.asIntN(64, BigInt(raw.trim()));
    } catch {
        console.warn(`Seed inválida "${raw}"; usando ${DEFAULT_WORLD_SEED}.`);
        return DEFAULT_WORLD_SEED;
    }
}

/** Pixels 0xRRGGBB do grasscolor.png (o PNG é opaco, então não há distorção por alpha). */
function readGrassPixels(image) {
    const canvas2d = document.createElement('canvas');
    canvas2d.width = 256;
    canvas2d.height = 256;

    const context = canvas2d.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);

    return grassPixelsFromRgba(context.getImageData(0, 0, 256, 256).data);
}

async function main() {
    const response = await fetch('./public/assets/mc10_faces_spec.json');

    if (!response.ok) {
        throw new Error('Não foi possível carregar a especificação JSON.');
    }

    const spec = await response.json();

    const grassColorImage = new Image();
    grassColorImage.src = './public/assets/grasscolor.png';
    await grassColorImage.decode();

    const foliageColorImage = new Image();
    foliageColorImage.src = './public/assets/foliagecolor.png';
    await foliageColorImage.decode();

    if (grassColorImage.width !== 256 || grassColorImage.height !== 256 ||
        foliageColorImage.width !== 256 || foliageColorImage.height !== 256) {
        throw new Error('Mapas de cores de grama/folhagem incompatíveis.');
    }

    const selectedWorld = window.__mc10SelectedWorld;
    const worldSeed = BigInt(selectedWorld.meta.seed);
    const grassPixels = readGrassPixels(grassColorImage);
    const foliagePixels = readGrassPixels(foliageColorImage);

    // Geração do terreno fora da thread de renderização.
    const chunkWorkers = Array.from({ length: 2 }, () => {
        const worker = new Worker(new URL('./terrain-worker.mjs', import.meta.url), { type: 'module' });
        worker.postMessage({ type: 'init', seed: worldSeed.toString(), grassPixels });
        return worker;
    });
    let nextChunkWorker = 0;

    const program = createProgram();
    gl.useProgram(program);
    const outlineProgram = createOutlineProgram();
    const outlineVao = gl.createVertexArray();

    const outlinePositions = new Float32Array([
        -0.003, -0.003, -0.003,
         1.003, -0.003, -0.003,
         1.003,  1.003, -0.003,
        -0.003,  1.003, -0.003,
        -0.003, -0.003,  1.003,
         1.003, -0.003,  1.003,
         1.003,  1.003,  1.003,
        -0.003,  1.003,  1.003
    ]);

    const outlineIndices = new Uint16Array([
        0,1, 1,2, 2,3, 3,0,
        4,5, 5,6, 6,7, 7,4,
        0,4, 1,5, 2,6, 3,7
    ]);

    gl.bindVertexArray(outlineVao);

    const outlinePositionBuffer = createBuffer(
        gl.ARRAY_BUFFER,
        outlinePositions
    );

    const outlineIndexBuffer = createBuffer(
        gl.ELEMENT_ARRAY_BUFFER,
        outlineIndices
    );

    const outlinePositionLocation = gl.getAttribLocation(
        outlineProgram,
        'a_position'
    );

    gl.enableVertexAttribArray(outlinePositionLocation);
    gl.vertexAttribPointer(
        outlinePositionLocation,
        3,
        gl.FLOAT,
        false,
        0,
        0
    );

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, outlineIndexBuffer);
    gl.bindVertexArray(null);

    const outlineMvpLocation = gl.getUniformLocation(
        outlineProgram,
        'u_mvp'
    );

    const outlineOffsetLocation = gl.getUniformLocation(
        outlineProgram,
        'u_offset'
    );

    const outlineColorLocation = gl.getUniformLocation(
        outlineProgram,
        'u_color'
    );


    function createGpuMesh(mesh) {
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        const positionBuffer = createBuffer(gl.ARRAY_BUFFER, mesh.positions);
        const uvBuffer = createBuffer(gl.ARRAY_BUFFER, mesh.uvs);
        const normalBuffer = createBuffer(gl.ARRAY_BUFFER, mesh.normals);

        // buildBlockMesh() não fornece cores; a malha de rachaduras precisa
        // de branco para preservar a cor original da textura do atlas.
        const colorData = mesh.colors ?? new Float32Array(mesh.positions.length).fill(1);
        const colorBuffer = createBuffer(gl.ARRAY_BUFFER, colorData);
        const lightData = mesh.lights ?? new Float32Array(mesh.positions.length / 3 * 2).fill(1);
        const lightBuffer = createBuffer(gl.ARRAY_BUFFER, lightData);
        const alphaData = mesh.alphas ?? new Float32Array(mesh.positions.length / 3).fill(1);
        const alphaBuffer = createBuffer(gl.ARRAY_BUFFER, alphaData);
        const indexBuffer = createBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indices);

        function attribute(name, buffer, size) {
            const location = gl.getAttribLocation(program, name);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
        }

        attribute('a_position', positionBuffer, 3);
        attribute('a_uv', uvBuffer, 2);
        attribute('a_normal', normalBuffer, 3);
        attribute('a_color', colorBuffer, 3);
        attribute('a_light', lightBuffer, 2);
        attribute('a_alpha', alphaBuffer, 1);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bindVertexArray(null);

        return {
            vao,
            indexCount: mesh.indices.length,
            buffers: [
                positionBuffer,
                uvBuffer,
                normalBuffer,
                colorBuffer,
                alphaBuffer,
                indexBuffer,
                lightBuffer
            ]
        };
    }

    const makeParticleGpuMesh = () => createGpuMesh({
        positions: new Float32Array(48000),
        uvs: new Float32Array(32000),
        normals: new Float32Array(48000),
        colors: new Float32Array(48000),
        alphas: new Float32Array(16000),
        indices: new Uint16Array(24000)
    });
    const particleGpuLayers = Array.from({ length: 4 }, makeParticleGpuMesh);
    const particleExplosionGpu = makeParticleGpuMesh();

    const steveMeshes = createSteveMeshes();
    const steveGpuParts = Object.fromEntries(
        Object.entries(steveMeshes).map(([name, mesh]) => [
            name,
            createGpuMesh(mesh)
        ])
    );

    // Minecraft terrain.png: damage overlay stages occupy tiles 240..249.
    const breakStageGpu = Array.from({ length: 10 }, (_, stage) => {
        const mesh = buildBlockMesh(spec, {
            bounds: {
                minX: -0.003, maxX: 1.003,
                minY: -0.003, maxY: 1.003,
                minZ: -0.003, maxZ: 1.003
            },
            textureIndex: 240 + stage
        });
        return createGpuMesh(mesh);
    });

    function createGpuChunk(mesh) {
        return {
            solid: createGpuMesh(mesh),
            water: createGpuMesh(mesh.water)
        };
    }

    function deleteGpuMesh(gpu) {
        gl.deleteVertexArray(gpu.vao);
        for (const buffer of gpu.buffers) {
            gl.deleteBuffer(buffer);
        }
    }

    function deleteGpuChunk(gpu) {
        deleteGpuMesh(gpu.solid);
        deleteGpuMesh(gpu.water);
    }

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Não permitir que estado global de upload pré-multiplique ou altere
    // o canal alpha do atlas terrain.png original.
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

    const image = new Image();
    image.src = './public/assets/terrain.png';

    await image.decode();

    if (image.width !== 256 || image.height !== 256) {
        throw new Error('Atlas incompatível: esperado 256x256.');
    }

    gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA,
        gl.RGBA, gl.UNSIGNED_BYTE, image
    );

    const updateWaterTextureAnimation = createMinecraft10WaterTextureAnimation(gl, texture);

    async function loadParticleTexture(path) {
        const source = new Image();
        source.src = path;
        await source.decode();
        const atlas = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, atlas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        return atlas;
    }

    const particlesTexture = await loadParticleTexture('./public/assets/mc10/particles.png');
    const itemsParticleTexture = await loadParticleTexture('./public/assets/mc10/gui/items.png');
    const explosionTexture = await loadParticleTexture('./public/assets/mc10/explosion.png');
    const footprintTexture = await loadParticleTexture('./public/assets/mc10/footprint.png');
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const steveSkinImage = new Image();
    steveSkinImage.src = './public/assets/mc10/char.png';
    await steveSkinImage.decode();

    if (steveSkinImage.width !== 64 || steveSkinImage.height !== 32) {
        throw new Error('Skin do Steve incompatível: esperado 64x32.');
    }

    const steveSkinTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, steveSkinTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA,
        gl.RGBA, gl.UNSIGNED_BYTE, steveSkinImage
    );
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    let inventoryPreview = null;
    try {
        inventoryPreview = createSteveInventoryPreview(
            document.querySelector('#inventory-preview'),
            steveSkinImage,
            { perspective, lookAt, multiply }
        );
    } catch (error) {
        console.warn('Falha ao renderizar o preview do Steve:', error);
    }

    let drawHotbarIcons = null;
    let drawInventoryIcons = null;
    try {
        // jb.c(int) do JAR: o topo da grama nos inventários usa ha.a(0.5, 1.0).
        const inventoryGrassColor = grassColor(grassPixels, 0.5, 1.0);

        drawHotbarIcons = createHotbarRenderer(
            document.querySelector('#hotbar-icons'),
            spec,
            image,
            { perspective, lookAt, multiply },
            { grassColor: inventoryGrassColor }
        );
        drawInventoryIcons = createHotbarRenderer(
            document.querySelector('#inventory-items'),
            spec,
            image,
            { perspective, lookAt, multiply },
            { width: 176, height: 166, grassColor: inventoryGrassColor }
        );
        document.querySelectorAll('.hotbar-item').forEach(item => item.remove());
        console.log('Hotbar e ícones do inventário 3D carregados.');
    } catch (error) {
        console.warn('Falha ao renderizar a hotbar 3D:', error);
    }



    const climate = createClimateQuery(worldSeed, { grassPixels });
    const originSample = climate.at(0, 0);

    console.log('Seed:', worldSeed);
    console.log('Streaming de chunks 3x3 preparado.');

    const offsetLocation = gl.getUniformLocation(program, 'u_offset');

    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);
    gl.uniform1i(gl.getUniformLocation(program, 'u_lightmap'), 1);
    gl.uniform1f(gl.getUniformLocation(program, 'u_applyLightmap'), 1.0);

    // Textura RGB 16x16 equivalente ao lightmap do adt.e() no JAR 1.0.
    const lightmapTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, lightmapTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, 16, 16, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, createMinecraft10Lightmap()
    );

    let torchFlicker = 0;
    let torchFlickerVelocity = 0;
    function updateMinecraft10Lightmap() {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, lightmapTexture);
        gl.texSubImage2D(
            gl.TEXTURE_2D, 0, 0, 0, 16, 16,
            gl.RGBA, gl.UNSIGNED_BYTE,
            createMinecraft10Lightmap({ torchFlicker })
        );
        gl.activeTexture(gl.TEXTURE0);
    }

    gl.activeTexture(gl.TEXTURE0);

    const mvpLocation = gl.getUniformLocation(program, 'u_mvp');
    const modelLocation = gl.getUniformLocation(program, 'u_model');
    const alphaMultiplierLocation =
        gl.getUniformLocation(program, 'u_alphaMultiplier');
    const alphaTestLocation =
        gl.getUniformLocation(program, 'u_alphaTest');
    const identityModel = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
    const underwaterLocation =
        gl.getUniformLocation(program, 'u_underwater');
    const cameraPositionLocation =
        gl.getUniformLocation(program, 'u_cameraPosition');
    const handLightingLocation =
        gl.getUniformLocation(program, 'u_handLighting');
    const handLightLocation =
        gl.getUniformLocation(program, 'u_handLight');
    const handLightUvLocation =
        gl.getUniformLocation(program, 'u_handLightUv');

    gl.uniform1f(handLightingLocation, 0.0);
    gl.uniform1f(handLightLocation, 1.0);
    const applyLightmapLocation = gl.getUniformLocation(program, 'u_applyLightmap');

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.frontFace(gl.CCW);
    gl.cullFace(gl.BACK);

    let yaw = selectedWorld.save?.player?.yaw ?? Math.PI / 4;
    let bodyYaw = yaw;
    let pitch = selectedWorld.save?.player?.pitch ?? 0.45;
    // Acumula a variação da câmera entre frames para a animação da mão.
    let handLookDeltaYaw = 0;
    let handLookDeltaPitch = 0;
    let cameraMode = 0; // 0 = primeira pessoa, 1 = terceira traseira, 2 = terceira frontal.
    let debugInfo = false;
    let debugFrameCount = 0;
    let debugLastUpdate = 0;
    let debugOverlayRenderAt = 0;
    let debugFps = 0;
    let debugFrameTimeMs = 0;
    let debugWorkTimeMs = 0;
    let debugRafDispatchMs = 0;
    let debugTerrainMs = 0;
    let debugParticlesMs = 0;
    let debugParticleTickMs = 0;
    let debugChunkUpdateMs = 0;
    let debugRaycastMs = 0;
    let debugRaycastCalls = 0;
    let raycastWindowMs = 0;
    let raycastWindowCalls = 0;
    let raycastWindowStartedAt = 0;
    let debugGpuMs = -1;
    const gpuTimerQueries = [];
    let activeGpuTimerQuery = null;
    let debugFrameSpikes = 0;
    let debugSpikeWindowAt = 0;
    let debugChunkUpdatesCount = 0;
    let debugChunkUpdatesShown = 0;
    let debugFrameTickMs = 0;
    let debugFrameSoundMs = 0;
    let debugFrameLightMs = 0;
    let debugProfRoot = 0, debugProfRender = 0, debugProfTick = 0, debugProfSound = 0, debugProfLight = 0;
    let debugProfShown = null;
    let debugProfWindowAt = 0;
    let debugProfilerVisible = false;
    let debugProfilerDrawAt = 0;
    const debugTickSamples = new Float32Array(512);
    let debugTickCursor = 0;
    let debugTickFilled = 0;
    let debugTickWindowMax = 0;
    let debugTickWindowAt = 0;
    let debugLagDrawAt = 0;
    let inventoryOpen = false;
    let chatOpen = false;
    let gameMenuOpen = false;
    let sprinting = false;
    let lastForwardTapAt = -Infinity;

    // O mundo começa perto da origem, como no Minecraft; o ponto exato
    // será escolhido depois que os chunks da região forem gerados.
    const randomSpawnX = Math.floor(Math.random() * 257) - 128;
    const randomSpawnZ = Math.floor(Math.random() * 257) - 128;
    const cameraPosition = selectedWorld.save?.player?.position?.slice() ?? [randomSpawnX + 0.5, 128, randomSpawnZ + 0.5];

    const inventory = new InventoryPlayerMC10();
    const savedInventory = selectedWorld.save?.player?.inventory;
    if (Array.isArray(savedInventory)) savedInventory.forEach((stack, slot) => { if (stack && slot < 40) inventory.setStack(slot, new ItemStackMC10(stack.id, stack.count, stack.damage, stack.maxStackSize)); });
    if (Number.isInteger(selectedWorld.save?.player?.selectedSlot)) inventory.selectHotbar(selectedWorld.save.player.selectedSlot);
    let foodStats = new FoodStatsMC10();
    if (selectedWorld.save?.player?.foodStats) Object.assign(foodStats, selectedWorld.save.player.foodStats);
    const craftingSlots = new Array(4).fill(null);
    let carriedStack = null;
    let inventoryPointer = { x: 88, y: 83 };
    let difficulty = selectedWorld.save?.player?.difficulty ?? 2; // 0 peaceful, 1 easy, 2 normal, 3 hard.
    let mouseSensitivity = 0.5;
    let musicVolume = 1;
    let soundVolume = 1;
    let invertMouse = false;
    let fieldOfView = 70;
    let health = selectedWorld.save?.player?.health ?? 20;
    let air = selectedWorld.save?.player?.air ?? 300;
    let hurtTicks = 0;
    let previousDamage = 0;
    let dead = false;
    let deathCause = '';
    let survivalTickAccumulator = 0;
    let survivalWorldTicks = 0;
    let fallDistance = 0;
    let itemEntities = (selectedWorld.save?.player?.drops ?? []).map(item => new DroppedItemMC10(new ItemStackMC10(item.stack.id, item.stack.count, item.stack.damage, item.stack.maxStackSize), [item.x,item.y,item.z], [item.vx,item.vy,item.vz], item.pickupDelay));
    let spawnPoint = selectedWorld.save?.player?.spawnPoint?.slice() ?? (selectedWorld.save?.player?.position ? [...cameraPosition] : null);
    let survivalSpawnInitialized = !!selectedWorld.save?.player?.position;
    let spawnSearchAttempts = 0;
    let spawnSearchChunkCount = -1;

    let flying = false;
    let verticalVelocity = 0;
    let horizontalVelocityX = 0;
    let horizontalVelocityZ = 0;
    let grounded = false;
    let inWater = false;
    let nextWaterAmbientAt = 0;
    let nextWaterSplashAt = 0;
    let jumpKeyWasDown = false;

    const PLAYER_RADIUS = 0.3;
    const PLAYER_HEIGHT = 1.8;
    const PLAYER_EYE_HEIGHT = 1.62;

    const pressedKeys = new Set();
    const mobileKeys = new Set();
    let mobileActionDispatch = false;
    let previousFrameTime = 0;
    let musicTickAccumulator = 0;
    let footstepDistance = 0;
    let sprintParticleAccumulator = 0;
    let limbSwing = 0;
    let limbSwingAmount = 0;
    let viewBobWalkDistance = 0;
    let previousViewBobWalkDistance = 0;
    let viewBobAmount = 0;
    let previousViewBobAmount = 0;
    let viewBobPitch = 0;
    let previousViewBobPitch = 0;
    let armSwingStartedAt = -Infinity;
    let equippedProgress = 1;
    let renderedHeldItem = inventory.getCurrentItem() ? { ...inventory.getCurrentItem() } : null;
    let nextMiningSwingAt = 0;
    let leftMouseDown = false;
    let rightMouseDown = false;
    let nextBlockPlacementAt = 0;
    let miningTarget = null;

    // O jogador do Minecraft 1.0 completa o swing em 6 ticks (300 ms a 20 TPS).
    const ARM_SWING_DURATION = 300;

    function startArmSwing(now = performance.now()) {
        armSwingStartedAt = now;
    }

    function getArmSwingProgress(now) {
        if (!Number.isFinite(armSwingStartedAt)) return 0;
        const progress = (now - armSwingStartedAt) / ARM_SWING_DURATION;
        return progress >= 1 ? 0 : Math.max(0, progress);
    }


    canvas.addEventListener('mousedown', event => {
        if (event.button !== 0 || inventoryOpen || chatOpen || gameMenuOpen || dead || mobileActionDispatch) return;
        legacyAudio.unlock();
        if (document.pointerLockElement !== canvas) {
            const request = canvas.requestPointerLock();
            request?.catch(error => console.error('Pointer Lock recusado pelo Electron:', error));
        }
    });

    document.addEventListener('mousemove', event => {
        if (document.pointerLockElement !== canvas) return;

        const sensitivity = 0.00125 + mouseSensitivity * 0.0025;
        const deltaYaw = -event.movementX * sensitivity;
        const deltaPitch = event.movementY * sensitivity * (invertMouse ? -1 : 1);
        yaw += deltaYaw;
        pitch += deltaPitch;
        handLookDeltaYaw += deltaYaw;
        handLookDeltaPitch += deltaPitch;
        pitch = Math.max(-1.5, Math.min(1.5, pitch));
    });

    document.addEventListener('pointerlockerror', () => {
        console.error('Não foi possível capturar o mouse. Verifique a permissão pointerLock da janela.');
    });

    // Evita que Ctrl+W feche a aba enquanto o jogo está em foco.
    window.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.code === 'KeyW') {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);

    window.addEventListener('keydown', event => {
        if (!inventoryOpen && !gameMenuOpen && !chatOpen && event.code === getControlCode('chat') &&
            !controlsScreen.classList.contains('open')) {
            event.preventDefault();
            openChat();
            return;
        }
        if (inventoryOpen || gameMenuOpen || chatOpen || controlsScreen.classList.contains('open')) return;
        if (controlBindings.some(binding => ['forward','left','back','right','jump','sneak'].includes(binding.id) && binding.code === event.code)) {
            event.preventDefault();
            pressedKeys.add(event.code);
        }

        // Minecraft 1.0: dois toques rápidos em W iniciam a corrida.
        if (event.code === getControlCode('forward') && !event.repeat) {
            const now = performance.now();
            if (now - lastForwardTapAt <= 300) sprinting = true;
            lastForwardTapAt = now;
        }
    });

    // Scroll do mouse: percorre os nove slots.
    window.addEventListener('wheel', event => {
        event.preventDefault();
        event.stopImmediatePropagation();

        if (inventoryOpen || gameMenuOpen || chatOpen || dead || event.deltaY === 0) return;

        inventory.changeCurrentItem(event.deltaY > 0 ? -1 : 1);
        updateHotbar();
    }, { passive: false, capture: true }); // hotbar-wheel


    window.addEventListener('keyup', event => {
        pressedKeys.delete(event.code);
        if (event.code === getControlCode('forward')) sprinting = false;
    });

    window.addEventListener('blur', () => {
        pressedKeys.clear();
        sprinting = false;
        lastForwardTapAt = -Infinity;
        leftMouseDown = false;
        miningTarget = null;
    });

    window.addEventListener('keydown', event => {
        if (event.code !== 'F3' || event.repeat) return;
        if (inventoryOpen || gameMenuOpen || chatOpen || dead ||
            controlsScreen.classList.contains('open')) return;
        event.preventDefault();
        debugInfo = !debugInfo;
        debugFrameCount = 0;
        debugLastUpdate = performance.now();
        debugOverlayRenderAt = 0;
        debugOverlay.classList.toggle('visible', debugInfo);
        debugOverlay.setAttribute('aria-hidden', String(!debugInfo));
        // 1.0: F3 mostra texto + gráficos; Shift+F3 mostra só o texto (sem a pizza do profiler).
        debugProfilerVisible = debugInfo && !event.shiftKey;
        debugChunkUpdatesCount = 0;
        debugChunkUpdatesShown = 0;
        debugProfRoot = debugProfRender = debugProfTick = debugProfSound = debugProfLight = 0;
        debugProfShown = null;
        debugProfWindowAt = performance.now();
        debugTickSamples.fill(0);
        debugTickCursor = 0;
        debugTickFilled = 0;
        debugTickWindowMax = 0;
        debugTickWindowAt = performance.now();
        debugProfilerDrawAt = 0;
        debugLagDrawAt = 0;
        debugLagCanvas.style.display = debugInfo ? 'block' : 'none';
        debugProfiler.style.display = debugProfilerVisible ? 'block' : 'none';
    }, true);

    window.addEventListener('keydown', event => {
        if (event.code !== 'F5' || event.repeat || gameMenuOpen) return;
        event.preventDefault();
        cameraMode = (cameraMode + 1) % 3;
        const modes = ['primeira pessoa', 'terceira pessoa traseira', 'terceira pessoa frontal'];
        console.log(`Câmera: ${modes[cameraMode]}`);
    });

    // O voo livre foi removido: o jogador inicia e permanece em Survival.


    canvas.addEventListener('wheel', event => {
        const cp = Math.cos(pitch);
        cameraPosition[0] += Math.sin(yaw) * cp * event.deltaY * 0.04;
        cameraPosition[1] += Math.sin(pitch) * event.deltaY * 0.04;
        cameraPosition[2] += Math.cos(yaw) * cp * event.deltaY * 0.04;
    }, { passive: true });

    const renderDistanceNames = ['Far', 'Normal', 'Short', 'Tiny'];
    const renderDistanceRadii = [16, 8, 4, 2];
    // Evita que o cálculo global de iluminação processe centenas de chunks
    // de uma só vez. O jogador ainda pode aumentar a distância nas opções.
    let renderDistance = 0;
    let smoothLighting = true;
    let viewBobbing = true;
    try {
        const savedVideoOptions = JSON.parse(localStorage.getItem('mc10-video-options') || '{}');
        if (Number.isInteger(savedVideoOptions.renderDistance) && savedVideoOptions.renderDistance >= 0 && savedVideoOptions.renderDistance < 4) renderDistance = savedVideoOptions.renderDistance;
        if (typeof savedVideoOptions.smoothLighting === 'boolean') smoothLighting = savedVideoOptions.smoothLighting;
        if (typeof savedVideoOptions.viewBobbing === 'boolean') viewBobbing = savedVideoOptions.viewBobbing;
    } catch {}
    const saveVideoOptions = () => {
        try { localStorage.setItem('mc10-video-options', JSON.stringify({ renderDistance, smoothLighting, viewBobbing })); } catch {}
    };
    let chunkRadius = renderDistanceRadii[renderDistance];
    const loadedChunks = new Map();
    // Cache evita alocar e copiar todos os chunks a cada frame.
    let renderEntriesCache = [];
    const visibleRenderEntries = [];
    let renderEntriesDirty = true;
    let waterSortCenterX = NaN;
    let waterSortCenterZ = NaN;
    // Guarda alterações fora dos chunks carregados para não perdê-las no unload.
    // Cada entrada contém apenas blocos modificados pelo jogador/simulações.
    const modifiedChunkBlocks = deserializeModifiedChunks(selectedWorld.save?.chunks);
    const pendingChunkGeneration = [];
    let pendingChunkGenerationIndex = 0;
    const pendingChunkGenerationKeys = new Set();
    const inFlightChunkGenerationKeys = new Set();
    const pendingChunkMeshes = new Set();
    const priorityChunkMeshes = new Set();
    for (const worker of chunkWorkers) {
        worker.addEventListener('message', event => {
            const { type, chunk, chunkX, chunkZ, error } = event.data;
            const key = `${chunkX},${chunkZ}`;
            inFlightChunkGenerationKeys.delete(key);
            if (type === 'error') {
                console.error(`Falha ao gerar chunk ${key}:`, error);
                return;
            }
            if (type !== 'generated' || !chunk) return;
            const centerX = Math.floor(cameraPosition[0] / 16);
            const centerZ = Math.floor(cameraPosition[2] / 16);
            if (Math.abs(chunkX - centerX) > chunkRadius || Math.abs(chunkZ - centerZ) > chunkRadius) return;
            if (loadedChunks.has(key)) return;
            const entry = { chunkX, chunkZ, chunk, gpu: null };
            restoreChunkBlocks(entry);
            initializeChunkLighting(chunk);
            loadedChunks.set(key, entry);
            renderEntriesDirty = true;
            lightingDirty = true;
            queueChunkMesh(chunkX, chunkZ);
            queueChunkMesh(chunkX - 1, chunkZ);
            queueChunkMesh(chunkX + 1, chunkZ);
            queueChunkMesh(chunkX, chunkZ - 1);
            queueChunkMesh(chunkX, chunkZ + 1);
        });
        worker.addEventListener('error', event => console.error('Worker de terreno falhou:', event.message));
    }
    let lightingDirty = false;
    let lightingTask = null;
    let localLightingDirty = false;
    let localLightingTask = null;
    const localLightingCenters = new Set();
    let localLightingNotBefore = 0;
    let localLightingEntries = [];
    let localLightingPublish = [];
    // Marca só a vizinhança do chunk alterado (água, blocos) em vez do mundo todo.
    function markLocalLighting(cx, cz) {
        localLightingCenters.add(`${cx},${cz}`);
        localLightingDirty = true;
    }

    const waterSimulation = createWaterSimulation({
        getBlock: getWorldBlock,
        getMetadata: getWorldMetadata,
        setCell: setWorldCell,
        getChunks: () => loadedChunks.values(),
        onChanged(chunkKeys) {
            for (const key of chunkKeys) {
                const [cx, cz] = key.split(',').map(Number);
                rebuildNearbyMeshes(cx, cz);
            }
        }
    });

    let lastCenterX = NaN;
    let lastCenterZ = NaN;

    function queueChunkMesh(chunkX, chunkZ, priority = false) {
        const key = `${chunkX},${chunkZ}`;
        if (!loadedChunks.has(key)) return;
        if (priority) {
            pendingChunkMeshes.delete(key);
            priorityChunkMeshes.add(key);
        } else if (!priorityChunkMeshes.has(key)) {
            pendingChunkMeshes.add(key);
        }
    }

    // Seções 16x16x16 não vazias de uma coluna (o F3 do 1.0 conta "renderers" de 16³: 8 por coluna).
    function countNonEmptySections(chunk) {
        const blocks = chunk.blocks;
        let mask = 0;
        for (let column = 0; column < 256 && mask !== 255; column++) {
            const base = column * 128;
            for (let section = 0; section < 8; section++) {
                if (mask & (1 << section)) continue;
                const start = base + section * 16;
                for (let y = 0; y < 16; y++) {
                    if (blocks[start + y] !== 0) { mask |= 1 << section; break; }
                }
            }
        }
        let count = 0;
        for (let section = 0; section < 8; section++) if (mask & (1 << section)) count++;
        return count;
    }

    function buildOneQueuedChunkMesh() {
        const startedAt = performance.now();
        let built = 0;
        if (pendingChunkMeshes.size === 0 && priorityChunkMeshes.size === 0) return;
        const neighbors = new Map();
        for (const [neighborKey, neighborEntry] of loadedChunks) {
            neighbors.set(neighborKey, neighborEntry.chunk);
        }

        // Reconstrói várias malhas por atualização, respeitando um orçamento
        // curto para que a fila pós-iluminação não deixe chunks pretos por muito tempo.
        while ((priorityChunkMeshes.size > 0 || pendingChunkMeshes.size > 0) &&
            (built === 0 || performance.now() - startedAt < 4)) {
            const key = priorityChunkMeshes.size > 0
                ? priorityChunkMeshes.values().next().value
                : pendingChunkMeshes.values().next().value;
            priorityChunkMeshes.delete(key);
            pendingChunkMeshes.delete(key);
            const entry = loadedChunks.get(key);
            if (!entry) continue;
            if (entry.gpu) deleteGpuChunk(entry.gpu);
            entry.gpu = createGpuChunk(buildTerrainMesh(spec, entry.chunk, neighbors, { smoothLighting }));
            entry.sectionsNonEmpty = countNonEmptySections(entry.chunk);
            debugChunkUpdatesCount++;
            built++;
        }
    }

    function updateChunks() {
        const chunkUpdateStartedAt = performance.now();
        const centerX = Math.floor(cameraPosition[0] / 16);
        const centerZ = Math.floor(cameraPosition[2] / 16);

        if (centerX !== lastCenterX || centerZ !== lastCenterZ) {
            const requested = [];
            for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
                for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
                    requested.push({
                        x: centerX + dx,
                        z: centerZ + dz,
                        distance: dx * dx + dz * dz
                    });
                }
            }
            requested.sort((a, b) => a.distance - b.distance);

            // Mantém os chunks existentes e agenda somente os que faltam.
            pendingChunkGeneration.length = 0;
            pendingChunkGenerationIndex = 0;
            pendingChunkGenerationKeys.clear();
            for (const position of requested) {
                const key = `${position.x},${position.z}`;
                if (loadedChunks.has(key) || inFlightChunkGenerationKeys.has(key)) continue;
                pendingChunkGeneration.push(position);
                pendingChunkGenerationKeys.add(key);
            }

            // Descarrega somente o que saiu do raio e atualiza as bordas vizinhas.
            for (const [key, entry] of loadedChunks) {
                if (
                    Math.abs(entry.chunkX - centerX) > chunkRadius ||
                    Math.abs(entry.chunkZ - centerZ) > chunkRadius
                ) {
                    if (entry.gpu) deleteGpuChunk(entry.gpu);
                    loadedChunks.delete(key);
                    renderEntriesDirty = true;
                    lightingDirty = true;
                    pendingChunkMeshes.delete(key);
                    priorityChunkMeshes.delete(key);
                    queueChunkMesh(entry.chunkX - 1, entry.chunkZ);
                    queueChunkMesh(entry.chunkX + 1, entry.chunkZ);
                    queueChunkMesh(entry.chunkX, entry.chunkZ - 1);
                    queueChunkMesh(entry.chunkX, entry.chunkZ + 1);
                }
            }

            lastCenterX = centerX;
            lastCenterZ = centerZ;
            waterSimulation.invalidate();
        }

        // Envia a geração ao worker sem bloquear o loop de renderização.
        if (pendingChunkGenerationIndex < pendingChunkGeneration.length) {
            const position = pendingChunkGeneration[pendingChunkGenerationIndex++];
            const key = `${position.x},${position.z}`;
            pendingChunkGenerationKeys.delete(key);
            if (pendingChunkGenerationIndex >= pendingChunkGeneration.length) {
                pendingChunkGeneration.length = 0;
                pendingChunkGenerationIndex = 0;
            }
            if (!loadedChunks.has(key) && !inFlightChunkGenerationKeys.has(key)) {
                inFlightChunkGenerationKeys.add(key);
                const worker = chunkWorkers[nextChunkWorker];
                nextChunkWorker = (nextChunkWorker + 1) % chunkWorkers.length;
                worker.postMessage({ type: 'generate', chunkX: position.x, chunkZ: position.z });
            }
        }

        if (localLightingDirty && !localLightingTask && performance.now() >= localLightingNotBefore) {
            // Calcula em 5x5 e publica só o 3x3: a luz alcança no máximo 15 blocos,
            // então o 3x3 recebe a entrada correta dos vizinhos, sem escurecer bordas.
            const computeSet = new Set();
            const publishSet = new Set();
            for (const centerKey of localLightingCenters) {
                const [cx, cz] = centerKey.split(',').map(Number);
                for (let dz = -2; dz <= 2; dz++) {
                    for (let dx = -2; dx <= 2; dx++) {
                        const entry = loadedChunks.get(`${cx + dx},${cz + dz}`);
                        if (!entry) continue;
                        computeSet.add(entry);
                        if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) publishSet.add(entry);
                    }
                }
            }
            localLightingCenters.clear();
            localLightingDirty = false;
            localLightingEntries = [...computeSet];
            localLightingPublish = [...publishSet];
            if (localLightingEntries.length) {
                localLightingTask = createWorldLightingTask(localLightingEntries, localLightingPublish);
            }
        }
        if (localLightingTask) {
            const startedAt = performance.now();
            let result;
            do {
                result = localLightingTask.next();
            } while (!result.done && performance.now() - startedAt < 3);
            debugFrameLightMs += performance.now() - startedAt;
            if (result?.done) {
                localLightingTask = null;
                for (const entry of localLightingPublish) {
                    pendingChunkMeshes.add(`${entry.chunkX},${entry.chunkZ}`);
                }
                localLightingEntries = [];
                localLightingPublish = [];
                localLightingNotBefore = performance.now() + 100;
            }
        }

        if (lightingDirty && pendingChunkGeneration.length === 0 && inFlightChunkGenerationKeys.size === 0 && !lightingTask && !localLightingTask) {
            lightingTask = createWorldLightingTask(loadedChunks.values());
            lightingDirty = false;
        }
        if (lightingTask) {
            const startedAt = performance.now();
            let result;
            do {
                result = lightingTask.next();
            } while (!result.done && performance.now() - startedAt < 3);
            debugFrameLightMs += performance.now() - startedAt;
            if (result?.done) {
                lightingTask = null;
                for (const loadedKey of loadedChunks.keys()) pendingChunkMeshes.add(loadedKey);
            }
        }

        // Constrói no máximo uma malha por frame; não toca nas malhas intactas.
        buildOneQueuedChunkMesh();

        // O spawn só é escolhido depois que a área inicial foi completamente gerada.
        if (
            !survivalSpawnInitialized &&
            pendingChunkGeneration.length === 0 &&
            inFlightChunkGenerationKeys.size === 0 &&
            (loadedChunks.size !== spawnSearchChunkCount || pendingChunkMeshes.size === 0)
        ) {
            spawnSearchChunkCount = loadedChunks.size;
            const preferredSpawns = [];
            const fallbackSpawns = [];
            const unsafeGround = new Set([8, 9, 10, 11, 18, 51, 81]);

            // Examina diretamente as colunas dos chunks carregados.
            // Evita percorrer um raio fixo de 80 blocos e consultar o mundo
            // repetidamente, o que pesava muito em CPUs antigas.
            for (const entry of loadedChunks.values()) {
                const { chunkX, chunkZ, chunk } = entry;
                const blocks = chunk.blocks;
                for (let localX = 0; localX < 16; localX++) {
                    for (let localZ = 0; localZ < 16; localZ++) {
                        const column = localX * 2048 + localZ * 128;
                        for (let y = 126; y >= 1; y--) {
                            const ground = blocks[column + y];
                            if (ground === 0) continue;

                            const safeGround = !unsafeGround.has(ground);
                            const hasHeadroom =
                                blocks[column + y + 1] === 0 &&
                                blocks[column + y + 2] === 0;
                            if (safeGround && hasHeadroom) {
                                const candidate = {
                                    x: chunkX * 16 + localX,
                                    y,
                                    z: chunkZ * 16 + localZ
                                };
                                fallbackSpawns.push(candidate);
                                if (ground === 2) preferredSpawns.push(candidate);
                            }
                            // Só considera o primeiro bloco não-ar da coluna.
                            break;
                        }
                    }
                }
            }

            const candidates = preferredSpawns.length > 0
                ? preferredSpawns
                : fallbackSpawns;
            if (candidates.length > 0) {
                const chosen = candidates[Math.floor(Math.random() * candidates.length)];
                cameraPosition[0] = chosen.x + 0.5;
                cameraPosition[1] = chosen.y + 1 + PLAYER_EYE_HEIGHT;
                cameraPosition[2] = chosen.z + 0.5;
                spawnPoint = [...cameraPosition];
                survivalSpawnInitialized = true;
                console.log('Spawn Survival 1.0:', chosen.x, chosen.y + 1, chosen.z);
                console.log('Regiões verificadas até encontrar spawn:', spawnSearchAttempts + 1);
            } else if (pendingChunkMeshes.size === 0) {
                // Uma seed pode gerar oceano em toda a área inicial. Nesse
                // caso, desloca a região de busca em vez de deixar o jogo preso.
                spawnSearchAttempts++;
                const offsetX = (Math.random() < 0.5 ? -1 : 1) *
                    (24 + Math.floor(Math.random() * 40));
                const offsetZ = (Math.random() < 0.5 ? -1 : 1) *
                    (24 + Math.floor(Math.random() * 40));
                cameraPosition[0] = (centerX + offsetX) * 16 + 8;
                cameraPosition[1] = 128;
                cameraPosition[2] = (centerZ + offsetZ) * 16 + 8;
                updateChunks.readyLogged = false;
                console.warn(
                    `Nenhum local seguro nesta região. Tentando outra área (${spawnSearchAttempts}).`
                );
            }
        }

        if (pendingChunkGeneration.length === 0 && inFlightChunkGenerationKeys.size === 0 && pendingChunkMeshes.size === 0) {
            // Evita log por frame; informa apenas quando o streaming termina.
            if (!updateChunks.readyLogged) {
                console.log(`Chunks ativos: ${loadedChunks.size} | Centro: ${centerX}, ${centerZ}`);
                updateChunks.readyLogged = true;
            }
        } else {
            updateChunks.readyLogged = false;
        }
        debugChunkUpdateMs = performance.now() - chunkUpdateStartedAt;
    }



    // InventoryPlayer (x.java): 36 slots principais, 4 slots de armadura,
    // com os nove primeiros mostrados na hotbar.
    let selectedBlockId = 0;
    const hotbarSelection = document.querySelector('#hotbar-selection');
    const hotbarCountItems = document.querySelectorAll('.hotbar-count');
    const healthIcons = document.querySelector('#health-icons');
    const foodIcons = document.querySelector('#food-icons');
    const airIcons = document.querySelector('#air-icons');
    const deathScreen = document.querySelector('#death-screen');
    const gameMenu = document.querySelector('#game-menu');
    const backToGameButton = document.querySelector('#back-to-game');
    const saveQuitTitleButton = document.querySelector('#save-quit-title');
    const optionsScreen = document.querySelector('#options-screen');
    const videoOptionsScreen = document.querySelector('#video-options-screen');
    const controlsScreen = document.querySelector('#controls-screen');
    const optionsButton = document.querySelector('#options-button');
    const optionsDoneButton = document.querySelector('#options-done');
    const musicSlider = document.querySelector('#option-music');
    const soundSlider = document.querySelector('#option-sound');
    const sensitivitySlider = document.querySelector('#option-sensitivity');
    const invertButton = document.querySelector('#option-invert');
    const fovSlider = document.querySelector('#option-fov');
    const difficultyButton = document.querySelector('#option-difficulty');
    const videoOptionsButton = document.querySelector('#options-video');
    const controlsOptionsButton = document.querySelector('#options-controls');
    const optionsLabels = { music: document.querySelector('#option-music-label'), sound: document.querySelector('#option-sound-label'), sensitivity: document.querySelector('#option-sensitivity-label'), fov: document.querySelector('#option-fov-label') };
    const videoOptionsDone = document.querySelector('#video-options-done');
    const renderDistanceButton = document.querySelector('#option-render-distance');
    const smoothLightingButton = document.querySelector('#option-smooth-lighting');
    const viewBobbingButton = document.querySelector('#option-view-bobbing');
    const controlsDone = document.querySelector('#controls-done');
    const controlsList = document.querySelector('#controls-list');
    const controlBindings = [
        { id: 'attack', name: 'Attack', code: 'Mouse0' },
        { id: 'use', name: 'Use Item', code: 'Mouse2' },
        { id: 'forward', name: 'Forward', code: 'KeyW' },
        { id: 'left', name: 'Left', code: 'KeyA' },
        { id: 'back', name: 'Back', code: 'KeyS' },
        { id: 'right', name: 'Right', code: 'KeyD' },
        { id: 'jump', name: 'Jump', code: 'Space' },
        { id: 'sneak', name: 'Sneak', code: 'ShiftLeft' },
        { id: 'drop', name: 'Drop', code: 'KeyQ' },
        { id: 'inventory', name: 'Inventory', code: 'KeyE' },
        { id: 'chat', name: 'Chat', code: 'KeyT' },
        { id: 'playerlist', name: 'Player List', code: 'Tab' },
        { id: 'pickItem', name: 'Pick Block', code: 'Mouse1' }
    ];
    let waitingForControl = -1;
    try {
        const saved = JSON.parse(localStorage.getItem('mc10-controls') || '{}');
        for (const binding of controlBindings) if (typeof saved[binding.id] === 'string') binding.code = saved[binding.id];
    } catch {}
    let optionsOpen = false;
    const respawnButton = document.querySelector('#respawn-button');
    const inventoryScreen = document.querySelector('#inventory-screen');
    const inventoryPanel = document.querySelector('#inventory-panel');
    const inventorySlotLayer = document.querySelector('#inventory-slots');
    const inventoryCountLayer = document.querySelector('#inventory-counts');
    const inventoryCursorCount = document.querySelector('#inventory-cursor-count');
    const inventoryTooltip = document.querySelector('#inventory-tooltip');
    const inventoryLayout = getMinecraft10InventoryLayout();
    const chatScreen = document.querySelector('#chat-screen');
    const chatInput = document.querySelector('#chat-input');
    const chatRenderedText = document.querySelector('#chat-rendered-text');

    function updateChatText() {
        const cursor = Math.floor(performance.now() / 300) % 2 === 0 ? '_' : '';
        const scale = Number(getComputedStyle(document.documentElement).getPropertyValue('--hud-scale')) || 1;
        setMinecraftText(chatRenderedText, '> ' + chatInput.value + cursor, minecraftFont, { scale });
    }

    function closeChat() {
        chatOpen = false;
        chatScreen.classList.remove('open');
        chatScreen.setAttribute('aria-hidden', 'true');
        chatInput.blur();
        if (!dead && !inventoryOpen && !gameMenuOpen) canvas.requestPointerLock?.();
    }

    function submitChat() {
        const message = chatInput.value.trim();
        chatInput.value = '';
        closeChat();
        if (!message) return;
        if (message.toLowerCase() === '/kill') {
            damagePlayer(1000, 'generic');
            return;
        }
        // O JAR 1.0 não mantém mensagens locais quando não há servidor.
    }

    function openChat() {
        if (dead || inventoryOpen || gameMenuOpen || chatOpen ||
            controlsScreen.classList.contains('open') ||
            document.querySelector('#options-screen').classList.contains('open') ||
            document.querySelector('#video-options-screen').classList.contains('open')) return;
        chatOpen = true;
        pressedKeys.clear();
        sprinting = false;
        leftMouseDown = false;
        miningTarget = null;
        chatScreen.classList.add('open');
        chatScreen.setAttribute('aria-hidden', 'false');
        document.exitPointerLock?.();
        chatInput.value = '';
        updateChatText();
        chatInput.focus({ preventScroll: true });
    }

    chatInput.addEventListener('input', updateChatText);

    // Enquanto o chat está aberto, cliques não podem roubar o foco do campo.
    document.addEventListener('mousedown', event => {
        if (!chatOpen) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        chatInput.focus({ preventScroll: true });
    }, true);

    chatInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            submitChat();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            chatInput.value = '';
            closeChat();
        }
        event.stopPropagation();
    });


    // Som clássico de clique da interface do Minecraft 1.0.
    document.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button || button.disabled || button.closest('#inventory-screen')) return;
        legacyAudio.click();
    });

    function updateHotbar() {
        selectedBlockId = inventory.getCurrentItem()?.id ?? 0;
        hotbarSelection.style.left = `${inventory.currentItem * 20 - 1}px`;

        const ids = inventory.main.slice(0, 9).map(stack => stack
            ? { id: stack.id, metadata: stack.damage ?? 0 }
            : 0);
        drawHotbarIcons?.(ids);

        hotbarCountItems.forEach((element, slot) => {
            const stack = inventory.main[slot];
            setMinecraftText(
                element,
                stack && stack.count > 1 ? String(stack.count) : '',
                minecraftFont,
                { shadow: true }
            );
            element.style.left = `${slot * 20 + 7}px`;
        });
        if (inventoryOpen) renderInventoryScreen();
    }

    function getInventorySlotStack(entry) {
        return entry.type === 'crafting'
            ? craftingSlots[entry.slot]
            : inventory.getStack(entry.slot);
    }

    // Receitas do inventário 2x2: um tronco produz quatro tábuas.
    function getCraftingResult() {
        const occupied = craftingSlots
            .map((stack, index) => stack ? { stack, index } : null)
            .filter(Boolean);
        if (occupied.length !== 1) return null;

        const { stack, index } = occupied[0];
        if (stack.id !== 17 || stack.count < 1) return null;
        return {
            stack: new ItemStackMC10(5, 4, stack.damage),
            inputIndex: index
        };
    }

    function takeCraftingResult() {
        const result = getCraftingResult();
        if (!result || !inventoryOpen) return;

        const output = result.stack;
        if (!carriedStack) {
            carriedStack = output;
        } else if (carriedStack.isStackableWith(output) &&
            carriedStack.count + output.count <= carriedStack.maxStackSize) {
            carriedStack.count += output.count;
        } else {
            return;
        }

        const input = craftingSlots[result.inputIndex];
        input.count--;
        if (input.count <= 0) craftingSlots[result.inputIndex] = null;

        updateHotbar();
        renderInventoryScreen();
    }

    function setInventorySlotStack(entry, stack) {
        if (entry.type === 'crafting') {
            craftingSlots[entry.slot] = stack ? stack.copy() : null;
        } else {
            inventory.setStack(entry.slot, stack);
        }
    }

    function moveInventoryCursor(entry, button = 0) {
        const slotStack = getInventorySlotStack(entry);

        if (button === 2) {
            if (!carriedStack && slotStack) {
                const amount = Math.ceil(slotStack.count / 2);
                carriedStack = slotStack.copy();
                carriedStack.count = amount;
                slotStack.count -= amount;
                if (slotStack.count <= 0) setInventorySlotStack(entry, null);
            } else if (carriedStack && !slotStack) {
                const one = carriedStack.copy();
                one.count = 1;
                setInventorySlotStack(entry, one);
                carriedStack.count--;
                if (carriedStack.count <= 0) carriedStack = null;
            } else if (carriedStack && slotStack && slotStack.isStackableWith(carriedStack)) {
                const maximum = Math.min(slotStack.maxStackSize, carriedStack.maxStackSize);
                if (slotStack.count < maximum) {
                    slotStack.count++;
                    carriedStack.count--;
                    if (carriedStack.count <= 0) carriedStack = null;
                }
            }
        } else if (!carriedStack && slotStack) {
            carriedStack = slotStack.copy();
            setInventorySlotStack(entry, null);
        } else if (carriedStack && !slotStack) {
            setInventorySlotStack(entry, carriedStack);
            carriedStack = null;
        } else if (carriedStack && slotStack && slotStack.isStackableWith(carriedStack)) {
            const maximum = Math.min(slotStack.maxStackSize, carriedStack.maxStackSize);
            const amount = Math.min(carriedStack.count, maximum - slotStack.count);
            if (amount > 0) {
                slotStack.count += amount;
                carriedStack.count -= amount;
                if (carriedStack.count <= 0) carriedStack = null;
            } else {
                setInventorySlotStack(entry, carriedStack);
                carriedStack = slotStack.copy();
            }
        } else if (carriedStack && slotStack) {
            setInventorySlotStack(entry, carriedStack);
            carriedStack = slotStack.copy();
        }

        updateHotbar();
        renderInventoryScreen();
    }

    function renderInventoryScreen() {
        if (!inventoryOpen) return;

        const icons = [];
        inventoryCountLayer.replaceChildren();
        for (const entry of inventoryLayout) {
            const stack = getInventorySlotStack(entry);
            if (!stack || stack.count <= 0) continue;
            icons.push({ id: stack.id, metadata: stack.damage ?? 0, x: entry.x, y: entry.y });
            if (stack.count > 1) {
                const count = document.createElement('span');
                count.className = 'inventory-count';
                setMinecraftText(count, String(stack.count), minecraftFont, { shadow: true });
                count.style.left = `${entry.x}px`;
                count.style.top = `${entry.y + 8}px`;
                inventoryCountLayer.append(count);
            }
        }

        if (carriedStack && carriedStack.count > 0) {
            icons.push({
                id: carriedStack.id,
                metadata: carriedStack.damage ?? 0,
                x: inventoryPointer.x - 8,
                y: inventoryPointer.y - 8
            });
            setMinecraftText(
                inventoryCursorCount,
                carriedStack.count > 1 ? String(carriedStack.count) : '',
                minecraftFont,
                { shadow: true }
            );
            inventoryCursorCount.style.display = carriedStack.count > 1 ? 'block' : 'none';
            inventoryCursorCount.style.left = `${inventoryPointer.x}px`;
            inventoryCursorCount.style.top = `${inventoryPointer.y}px`;
        } else {
            setMinecraftText(inventoryCursorCount, '', minecraftFont, { shadow: true });
            inventoryCursorCount.style.display = 'none';
        }

        const craftingResult = getCraftingResult();
        const outputButton = inventorySlotLayer.querySelector('.output-slot');
        if (craftingResult) {
            icons.push({
                id: craftingResult.stack.id,
                metadata: craftingResult.stack.damage,
                x: 144,
                y: 36
            });
            if (outputButton) outputButton.disabled = false;
        } else if (outputButton) {
            outputButton.disabled = true;
        }

        drawInventoryIcons?.renderItems(icons);

        // mg.a(...) no JAR: mostra dk.q() somente ao passar sobre um slot
        // ocupado e esconde o tooltip enquanto o cursor carrega um item.
        const hoveredEntry = carriedStack ? null : inventoryLayout.find(entry =>
            inventoryPointer.x >= entry.x - 1 &&
            inventoryPointer.x < entry.x + 17 &&
            inventoryPointer.y >= entry.y - 1 &&
            inventoryPointer.y < entry.y + 17
        );
        const hoveredStack = hoveredEntry ? getInventorySlotStack(hoveredEntry) : null;
        if (hoveredStack && hoveredStack.count > 0) {
            setMinecraftText(
                inventoryTooltip,
                getMinecraft10ItemTooltipName(hoveredStack.id),
                minecraftFont,
                { shadow: true }
            );
            inventoryTooltip.style.left = `${inventoryPointer.x + 9}px`;
            inventoryTooltip.style.top = `${inventoryPointer.y - 16}px`;
            inventoryTooltip.style.display = 'block';
            inventoryTooltip.setAttribute('aria-hidden', 'false');
        } else {
            inventoryTooltip.replaceChildren();
            inventoryTooltip.style.display = 'none';
            inventoryTooltip.setAttribute('aria-hidden', 'true');
        }
    }

    function createInventorySlotButtons() {
        inventorySlotLayer.replaceChildren();
        for (const entry of inventoryLayout) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'inventory-slot';
            button.style.left = `${entry.x}px`;
            button.style.top = `${entry.y}px`;
            button.setAttribute('aria-label', entry.type === 'crafting'
                ? `Crafting ${entry.slot + 1}`
                : `Inventário ${entry.slot + 1}`);
            button.addEventListener('mousedown', event => {
                event.preventDefault();
                event.stopPropagation();
                moveInventoryCursor(entry, event.button);
            });
            inventorySlotLayer.append(button);
        }

        const output = document.createElement('button');
        output.type = 'button';
        output.className = 'inventory-slot output-slot';
        output.style.left = '144px';
        output.style.top = '36px';
        output.disabled = true;
        output.setAttribute('aria-label', 'Resultado de crafting');
        output.addEventListener('mousedown', event => {
            event.preventDefault();
            event.stopPropagation();
            if (event.button === 0) takeCraftingResult();
        });
        inventorySlotLayer.append(output);
    }

    function returnCarriedItems() {
        const pending = [];
        if (carriedStack) pending.push(carriedStack);
        for (const stack of craftingSlots) if (stack) pending.push(stack);

        for (const stack of pending) {
            const remaining = stack.copy();
            inventory.addItemStack(remaining);
            if (remaining.count > 0) {
                itemEntities.push(new DroppedItemMC10(remaining, [
                    cameraPosition[0],
                    cameraPosition[1] - PLAYER_EYE_HEIGHT - 0.15,
                    cameraPosition[2]
                ]));
            }
        }

        carriedStack = null;
        craftingSlots.fill(null);
    }

    function openInventory() {
        if (dead || inventoryOpen) return;
        inventoryOpen = true;
        leftMouseDown = false;
        miningTarget = null;
        pressedKeys.clear();
        document.exitPointerLock?.();
        inventoryScreen.classList.add('open');
        inventoryScreen.setAttribute('aria-hidden', 'false');
        renderInventoryScreen();
        inventoryPreview?.render();
    }

    function closeInventory() {
        if (!inventoryOpen) return;
        returnCarriedItems();
        inventoryOpen = false;
        inventoryScreen.classList.remove('open');
        inventoryScreen.setAttribute('aria-hidden', 'true');
        updateHotbar();
    }

    inventoryPanel.addEventListener('contextmenu', event => event.preventDefault());
    document.addEventListener('mousemove', event => {
        if (!inventoryOpen) return;
        const rect = inventoryPanel.getBoundingClientRect();
        const scale = rect.width / 176 || 1;
        inventoryPointer = {
            x: (event.clientX - rect.left) / scale,
            y: (event.clientY - rect.top) / scale
        };
        // hw.java atualiza o olhar mesmo quando o cursor sai do painel.
        inventoryPreview?.setLook(inventoryPointer.x, inventoryPointer.y);
        renderInventoryScreen();
    });
    createInventorySlotButtons();

    function openGameMenu() {
        if (dead || inventoryOpen || gameMenuOpen) return;
        gameMenuOpen = true;
        leftMouseDown = false;
        miningTarget = null;
        pressedKeys.clear();
        sprinting = false;
        document.exitPointerLock?.();
        gameMenu.classList.add('open');
        gameMenu.setAttribute('aria-hidden', 'false');
    }

    function closeGameMenu() {
        if (!gameMenuOpen) return;
        gameMenuOpen = false;
        gameMenu.classList.remove('open');
        gameMenu.setAttribute('aria-hidden', 'true');
        canvas.requestPointerLock?.();
    }

    // O navegador reserva Escape para sair do Pointer Lock. Quando isso
    // acontecer durante o jogo, tratamos a perda do lock como abertura do menu.
    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement !== canvas && !inventoryOpen && !gameMenuOpen && !chatOpen && !dead) {
            openGameMenu();
        }
    });

    backToGameButton.addEventListener('click', closeGameMenu);
    saveQuitTitleButton.addEventListener('click', async () => {
        saveQuitTitleButton.disabled = true;
        try {
            const storage = createWorldStorage();
            const stacks = inventory.main.concat(inventory.armor).map(stack => stack ? {
                id: stack.id, count: stack.count, damage: stack.damage, maxStackSize: stack.maxStackSize
            } : null);
            const drops = itemEntities.filter(item => !item.dead && !item.pickupAnimation).map(item => ({
                stack: { id: item.stack.id, count: item.stack.count, damage: item.stack.damage, maxStackSize: item.stack.maxStackSize },
                x:item.x, y:item.y, z:item.z, vx:item.vx, vy:item.vy, vz:item.vz, pickupDelay:item.pickupDelay
            }));
            await storage.saveWorld(selectedWorld.meta.id, {
                chunks: serializeModifiedChunks(modifiedChunkBlocks),
                player: { position: [...cameraPosition], yaw, pitch, inventory: stacks, selectedSlot: inventory.currentItem,
                    foodStats: { foodLevel: foodStats.foodLevel, saturationLevel: foodStats.saturationLevel, exhaustionLevel: foodStats.exhaustionLevel, foodTickTimer: foodStats.foodTickTimer, previousFoodLevel: foodStats.previousFoodLevel },
                    health, air, difficulty, drops, spawnPoint: spawnPoint ? [...spawnPoint] : null }
            });
            window.__mc10SelectedWorld = await storage.loadWorld(selectedWorld.meta.id);
            window.location.reload();
        } catch (error) {
            console.error('Falha ao salvar o mundo:', error);
            saveQuitTitleButton.disabled = false;
            alert('Não foi possível salvar o mundo: ' + error.message);
        }
    });

    const optionNames = ['Music', 'Sound', 'Invert Mouse', 'Sensitivity', 'FOV', 'Difficulty'];
    const difficultyNames = ['Peaceful', 'Easy', 'Normal', 'Hard'];
    const fovLabel = value => value === 0 ? 'FOV: Normal' : value === 100 ? 'FOV: Quake Pro' : `FOV: ${70 + Math.floor(value * 0.4)}`;
    function updateOptionLabels() {
        setMinecraftText(optionsLabels.music, `Music: ${musicVolume === 0 ? 'OFF' : Math.round(musicVolume * 100) + '%'}`, minecraftFont);
        setMinecraftText(optionsLabels.sound, `Sound: ${soundVolume === 0 ? 'OFF' : Math.round(soundVolume * 100) + '%'}`, minecraftFont);
        setMinecraftText(invertButton, `Invert Mouse: ${invertMouse ? 'ON' : 'OFF'}`, minecraftFont);
        setMinecraftText(optionsLabels.sensitivity, mouseSensitivity === 0 ? 'Sensitivity: MIN' : mouseSensitivity === 1 ? 'Sensitivity: MAX' : `Sensitivity: ${Math.floor(mouseSensitivity * 200)}%`, minecraftFont);
        setMinecraftText(optionsLabels.fov, fovLabel(fieldOfView), minecraftFont);
        setMinecraftText(difficultyButton, `Difficulty: ${difficultyNames[difficulty]}`, minecraftFont);
        setMinecraftText(videoOptionsButton, 'Video Settings...', minecraftFont);
        setMinecraftText(controlsOptionsButton, 'Controls...', minecraftFont);
        setMinecraftText(optionsDoneButton, 'Done', minecraftFont);
        setMinecraftText(videoOptionsDone, 'Done', minecraftFont);
        setMinecraftText(controlsDone, 'Done', minecraftFont);
        setMinecraftText(document.querySelector('#options-title'), 'Options', minecraftFont);
        setMinecraftText(document.querySelector('#video-options-title'), 'Video Settings', minecraftFont);
        setMinecraftText(renderDistanceButton, `Render Distance: ${renderDistanceNames[renderDistance]}`, minecraftFont);
        setMinecraftText(smoothLightingButton, `Smooth Lighting: ${smoothLighting ? 'ON' : 'OFF'}`, minecraftFont);
        setMinecraftText(viewBobbingButton, `View Bobbing: ${viewBobbing ? 'ON' : 'OFF'}`, minecraftFont);
        setMinecraftText(document.querySelector('#controls-title'), 'Controls', minecraftFont);
        for (const [index, binding] of controlBindings.entries()) {
            const entry = controlsList.children[index];
            const button = entry?.querySelector('.mc-option-control');
            if (button) setMinecraftText(button, waitingForControl === index ? '> ??? <' : formatControlCode(binding.code), minecraftFont);
        }
    }
    function placeOptionsControls() {
        const scale = Number(getComputedStyle(document.documentElement).getPropertyValue('--hud-scale')) || 1;
        const width = innerWidth, height = innerHeight;
        const x = width / 2 - 155 * scale, y = height / 6;
        const place = (el, col, row, w=150) => {
            el.style.left = `${x + col * 160 * scale}px`;
            el.style.top = `${y + 24 * row * scale}px`;
            if (el.classList.contains('mc-option-control')) el.style.width = `${w}px`;
        };
        place(optionsLabels.music,0,0); place(musicSlider,0,0);
        place(optionsLabels.sound,1,0); place(soundSlider,1,0);
        place(invertButton,0,1);
        place(optionsLabels.sensitivity,1,1); place(sensitivitySlider,1,1);
        place(optionsLabels.fov,0,2); place(fovSlider,0,2);
        place(difficultyButton,1,2);
        for (const [el,col,row] of [[renderDistanceButton,0,0],[smoothLightingButton,1,0],[viewBobbingButton,0,1]]) {
            el.style.left = `${x + col * 160 * scale}px`;
            el.style.top = `${y + 24 * row * scale}px`;
            el.style.width = '150px';
            el.style.transform = `scale(${scale})`;
            el.style.transformOrigin = 'top left';
        }
        for (const [el,offset] of [[videoOptionsButton,108],[controlsOptionsButton,132],[optionsDoneButton,168]]) {
            el.style.left = `${width/2 - 100*scale}px`;
            el.style.top = `${y + offset*scale}px`;
            el.style.width = '200px';
            el.style.transform = `scale(${scale})`;
            el.style.transformOrigin = 'top left';
        }
    }
    function formatControlCode(code) {
        if (code === 'Mouse0') return 'Button 1';
        if (code === 'Mouse1') return 'Button 3';
        if (code === 'Mouse2') return 'Button 2';
        if (code.startsWith('Key')) return code.slice(3);
        if (code.startsWith('Digit')) return code.slice(5);
        if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
        return code;
    }
    function saveControlBindings() {
        try { localStorage.setItem('mc10-controls', JSON.stringify(Object.fromEntries(controlBindings.map(({id,code}) => [id,code])))); } catch {}
    }
    function setControlBinding(index, code) {
        if (index < 0 || index >= controlBindings.length) return;
        const duplicate = controlBindings.findIndex((binding, i) => i !== index && binding.code === code);
        if (duplicate >= 0) controlBindings[duplicate].code = '';
        controlBindings[index].code = code;
        waitingForControl = -1;
        saveControlBindings();
        updateOptionLabels();
    }
    function getControlCode(id) { return controlBindings.find(binding => binding.id === id)?.code; }
    function isControlDown(id) {
        const code = getControlCode(id);
        return code ? (pressedKeys.has(code) || mobileKeys.has(id)) : false;
    }

    // Entrada touch: joystick virtual, gesto para câmera e botões de ação.
    const mobileControls = document.querySelector('#mobile-controls');
    const mobileJoystick = document.querySelector('#mobile-joystick');
    const mobileStick = document.querySelector('#mobile-stick');
    const mobileAttack = document.querySelector('#mobile-attack');
    const mobileUse = document.querySelector('#mobile-use');
    const mobileJump = document.querySelector('#mobile-jump');
    const mobileSneak = document.querySelector('#mobile-sneak');
    const mobileInventory = document.querySelector('#mobile-inventory');
    const mobilePause = document.querySelector('#mobile-pause');
    const mobileMoveControls = ['forward', 'back', 'left', 'right'];
    let joystickPointerId = null;
    let lookPointerId = null;
    let joystickCenter = { x: 0, y: 0 };
    let lastTouchLook = { x: 0, y: 0 };

    function updateMobileJoystick(event) {
        const dx = event.clientX - joystickCenter.x;
        const dy = event.clientY - joystickCenter.y;
        const radius = 43;
        const length = Math.hypot(dx, dy);
        const scale = length > radius ? radius / length : 1;
        const x = dx * scale;
        const y = dy * scale;
        mobileStick.style.transform = `translate(${x}px, ${y}px)`;
        for (const control of mobileMoveControls) mobileKeys.delete(control);
        if (-y > 13) mobileKeys.add('forward');
        if (y > 13) mobileKeys.add('back');
        if (-x > 13) mobileKeys.add('left');
        if (x > 13) mobileKeys.add('right');
    }

    function resetMobileJoystick() {
        joystickPointerId = null;
        mobileStick.style.transform = '';
        for (const control of mobileMoveControls) mobileKeys.delete(control);
    }

    mobileJoystick.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' || inventoryOpen || gameMenuOpen || dead) return;
        event.preventDefault();
        joystickPointerId = event.pointerId;
        const rect = mobileJoystick.getBoundingClientRect();
        joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        mobileJoystick.setPointerCapture(event.pointerId);
        updateMobileJoystick(event);
    });
    mobileJoystick.addEventListener('pointermove', event => {
        if (event.pointerId === joystickPointerId) { event.preventDefault(); updateMobileJoystick(event); }
    });
    mobileJoystick.addEventListener('pointerup', event => { if (event.pointerId === joystickPointerId) resetMobileJoystick(); });
    mobileJoystick.addEventListener('pointercancel', resetMobileJoystick);

    canvas.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' || event.clientX < innerWidth * 0.38 ||
            inventoryOpen || gameMenuOpen || chatOpen || dead) return;
        event.preventDefault();
        lookPointerId = event.pointerId;
        lastTouchLook = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
        if (event.pointerId !== lookPointerId) return;
        event.preventDefault();
        const deltaX = event.clientX - lastTouchLook.x;
        const deltaY = event.clientY - lastTouchLook.y;
        lastTouchLook = { x: event.clientX, y: event.clientY };
        const sensitivity = 0.0045 + mouseSensitivity * 0.006;
        const deltaYaw = -deltaX * sensitivity;
        const deltaPitch = deltaY * sensitivity * (invertMouse ? -1 : 1);
        yaw += deltaYaw;
        pitch = Math.max(-1.5, Math.min(1.5, pitch + deltaPitch));
        handLookDeltaYaw += deltaYaw;
        handLookDeltaPitch += deltaPitch;
    });
    const stopMobileLook = event => { if (event.pointerId === lookPointerId) lookPointerId = null; };
    canvas.addEventListener('pointerup', stopMobileLook);
    canvas.addEventListener('pointercancel', stopMobileLook);

    function mobileMouseAction(button, down) {
        if (inventoryOpen || gameMenuOpen || chatOpen || dead) return;
        mobileActionDispatch = true;
        canvas.dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', {
            bubbles: true, cancelable: true, button, buttons: down ? (button === 0 ? 1 : 2) : 0
        }));
        mobileActionDispatch = false;
    }
    function bindMobileHold(button, controlId, actionButton = null) {
        button.addEventListener('pointerdown', event => {
            if (event.pointerType === 'mouse') return;
            event.preventDefault();
            button.setPointerCapture(event.pointerId);
            if (controlId) mobileKeys.add(controlId);
            legacyAudio.unlock();
            button.classList.add('active');
            if (actionButton !== null) mobileMouseAction(actionButton, true);
        });
        const release = () => {
            if (controlId) mobileKeys.delete(controlId);
            button.classList.remove('active');
            if (actionButton !== null) mobileMouseAction(actionButton, false);
        };
        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
        button.addEventListener('lostpointercapture', release);
    }
    bindMobileHold(mobileAttack, null, 0);
    bindMobileHold(mobileUse, null, 2);
    bindMobileHold(mobileJump, 'jump');
    bindMobileHold(mobileSneak, 'sneak');
    mobileInventory.addEventListener('click', () => { if (!dead && !gameMenuOpen) openInventory(); });
    mobilePause.addEventListener('click', () => { if (!dead && !inventoryOpen && !gameMenuOpen) openGameMenu(); });

    // Toque em um dos nove espaços seleciona diretamente a hotbar.
    document.querySelector('#hotbar').addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' || !mobileControls || inventoryOpen) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const slot = Math.max(0, Math.min(8, Math.floor((event.clientX - rect.left) / (rect.width / 9))));
        inventory.changeCurrentItem(slot - inventory.currentItem);
        updateHotbar();
    });

    window.addEventListener('blur', () => {
        resetMobileJoystick();
        mobileKeys.clear();
        for (const button of [mobileAttack, mobileUse, mobileJump, mobileSneak]) button.classList.remove('active');
    });
    controlBindings.forEach((binding, index) => {
        const entry = document.createElement('div');
        entry.className = 'mc-control-entry';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mc-option-control';
        button.addEventListener('click', () => { waitingForControl = index; updateOptionLabels(); });
        const name = document.createElement('span');
        name.className = 'mc-control-name';
        setMinecraftText(name, binding.name, minecraftFont);
        entry.append(button, name);
        controlsList.append(entry);
    });
    function openOptions() {
        optionsOpen = true; gameMenuOpen = false;
        gameMenu.classList.remove('open'); gameMenu.setAttribute('aria-hidden','true');
        optionsScreen.classList.add('open'); optionsScreen.setAttribute('aria-hidden','false');
        musicSlider.value = String(Math.round(musicVolume*100));
        soundSlider.value = String(Math.round(soundVolume*100));
        sensitivitySlider.value = String(Math.round(mouseSensitivity*100));
        fovSlider.value = String(fieldOfView === 70 ? 0 : Math.round((fieldOfView-70)/0.4));
        placeOptionsControls(); updateOptionLabels();
    }
    function closeOptions() {
        if (!optionsOpen) return;
        optionsOpen = false; optionsScreen.classList.remove('open');
        optionsScreen.setAttribute('aria-hidden','true'); openGameMenu();
    }
    function openSubOptions(screen) {
        optionsScreen.classList.remove('open'); optionsScreen.setAttribute('aria-hidden','true');
        screen.classList.add('open'); screen.setAttribute('aria-hidden','false');
    }
    function closeSubOptions(screen) {
        screen.classList.remove('open'); screen.setAttribute('aria-hidden','true');
        optionsScreen.classList.add('open'); optionsScreen.setAttribute('aria-hidden','false');
    }
    optionsButton.addEventListener('click', openOptions);
    optionsDoneButton.addEventListener('click', closeOptions);
    musicSlider.addEventListener('input', () => { musicVolume = Number(musicSlider.value)/100; legacyAudio.setMusicVolume(musicVolume); updateOptionLabels(); });
    soundSlider.addEventListener('input', () => { soundVolume = Number(soundSlider.value)/100; legacyAudio.setSoundVolume(soundVolume); updateOptionLabels(); });
    sensitivitySlider.addEventListener('input', () => { mouseSensitivity = Number(sensitivitySlider.value)/100; updateOptionLabels(); });
    invertButton.addEventListener('click', () => { invertMouse = !invertMouse; updateOptionLabels(); });
    fovSlider.addEventListener('input', () => { fieldOfView = 70 + Number(fovSlider.value)*0.4; updateOptionLabels(); });
    difficultyButton.addEventListener('click', () => { difficulty = (difficulty+1)%4; updateOptionLabels(); });
    renderDistanceButton.addEventListener('click', () => {
        renderDistance = (renderDistance + 1) % renderDistanceNames.length;
        chunkRadius = renderDistanceRadii[renderDistance];
        lastCenterX = NaN;
        lastCenterZ = NaN;
        updateChunks();
        saveVideoOptions();
        updateOptionLabels();
    });
    smoothLightingButton.addEventListener('click', () => {
        smoothLighting = !smoothLighting;
        for (const key of loadedChunks.keys()) pendingChunkMeshes.add(key);
        saveVideoOptions();
        updateOptionLabels();
    });
    viewBobbingButton.addEventListener('click', () => {
        viewBobbing = !viewBobbing;
        saveVideoOptions();
        updateOptionLabels();
    });
    videoOptionsButton.addEventListener('click', () => openSubOptions(videoOptionsScreen));
    controlsOptionsButton.addEventListener('click', () => openSubOptions(controlsScreen));
    videoOptionsDone.addEventListener('click', () => closeSubOptions(videoOptionsScreen));
    controlsDone.addEventListener('click', () => closeSubOptions(controlsScreen));
    window.addEventListener('resize', () => { if (optionsOpen) placeOptionsControls(); });

    window.addEventListener('mousedown', event => {
        if (!controlsScreen.classList.contains('open') || waitingForControl < 0) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        setControlBinding(waitingForControl, `Mouse${event.button}`);
    }, true);

    window.addEventListener('keydown', event => {
        if (chatOpen) {
            if (event.code === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                chatInput.value = '';
                closeChat();
            } else if (event.code === 'Enter') {
                event.preventDefault();
                event.stopImmediatePropagation();
                submitChat();
            }
            return;
        }
        if (controlsScreen.classList.contains('open') && waitingForControl >= 0) {
            event.preventDefault(); event.stopImmediatePropagation();
            if (event.code === 'Escape') { waitingForControl = -1; updateOptionLabels(); }
            else setControlBinding(waitingForControl, event.code);
            return;
        }
        if (!event.repeat && !dead && !gameMenuOpen && !optionsOpen && !inventoryOpen && event.code === getControlCode('inventory')) {
            event.preventDefault();
            openInventory();
            return;
        }
        if (!event.repeat && !dead && !gameMenuOpen && !optionsOpen && !inventoryOpen && event.code === getControlCode('drop')) {
            event.preventDefault();
            const dropped = inventory.removeStackFromSlot(inventory.currentItem, 1);
            if (dropped) {
                itemEntities.push(createPlayerDrop(dropped, {
                    x: cameraPosition[0],
                    y: cameraPosition[1] - 0.3,
                    z: cameraPosition[2],
                    yaw,
                    pitch
                }));
                updateHotbar();
            }
            return;
        }
        if (event.code === 'Escape' && videoOptionsScreen.classList.contains('open')) { event.preventDefault(); closeSubOptions(videoOptionsScreen); return; }
        if (event.code === 'Escape' && controlsScreen.classList.contains('open')) { event.preventDefault(); closeSubOptions(controlsScreen); return; }
        if (event.code === 'Escape' && optionsOpen) { event.preventDefault(); closeOptions(); return; }
        if (event.code === 'Escape' && inventoryOpen) {
            event.preventDefault();
            closeInventory();
            return;
        }
        if (event.code === 'Escape' && !dead) {
            event.preventDefault();
            if (gameMenuOpen) closeGameMenu();
            else openGameMenu();
        }
    });

    function setSprite(element, u, v) {
        element.style.backgroundPosition = `-${u}px -${v}px`;
    }

// qd.java (Minecraft 1.0): desenha primeiro o fundo/borda e depois
// o preenchimento transparente por cima, sem apagar o contorno.
function setMeterSprites(element, baseU, fillU, v) {
    const sprite = `url("${window.mcAssetUrl("./public/assets/mc10/gui/icons.png")}")`;
    element.style.backgroundImage = fillU === null
        ? sprite
        : `${sprite}, ${sprite}`;
    element.style.backgroundPosition = fillU === null
        ? `-${baseU}px -${v}px`
        : `-${fillU}px -${v}px, -${baseU}px -${v}px`;
    element.style.backgroundRepeat = 'no-repeat';
}


    function renderMeter(container, value, kind) {
        container.replaceChildren();

        if (kind === 'air') {
            // qd.java: air bubbles are ceil((air-2)*10/300) full bubbles,
            // with only ceil(air*10/300) bubbles shown in total.
            const full = Math.max(0, Math.min(10, Math.ceil((value - 2) * 10 / 300)));
            const total = Math.max(0, Math.min(10, Math.ceil(value * 10 / 300)));
            for (let i = 0; i < total; i++) {
                const icon = document.createElement('span');
                icon.className = 'mc-gui-icon';
                setSprite(icon, i < full ? 16 : 25, 18);
                icon.style.right = `${i * 8}px`;
                container.append(icon);
            }
            return;
        }

        for (let i = 0; i < 10; i++) {
            const icon = document.createElement('span');
            icon.className = 'mc-gui-icon';
            const baseU = 16;
            const fillU = 52;
            const v = kind === 'health' ? 0 : 27;
            const points = value - i * 2;

            const foregroundU = points >= 2
                ? fillU
                : points > 0 ? fillU + 9 : null;
            setMeterSprites(icon, baseU, foregroundU, v);

            const position = getMinecraft10HudIconPosition(
                kind,
                i,
                window.innerWidth,
                window.innerHeight
            );
            if (kind === 'health') {
                icon.style.left = `${position.x - (window.innerWidth / 2 - 91)}px`;
            } else {
                icon.style.right = `${window.innerWidth / 2 + 91 - position.x - 9}px`;
            }
            container.append(icon);
        }
    }

    function updateSurvivalHud() {
        renderMeter(healthIcons, health, 'health');
        renderMeter(foodIcons, foodStats.foodLevel, 'food');
        renderMeter(airIcons, air, 'air');
        airIcons.style.display = headUnderwater() ? 'block' : 'none';
    }

    function drawDebugLagometer(now) {
        if (now - debugLagDrawAt < 50) return;
        debugLagDrawAt = now;
        debugLagCtx.fillStyle = '#200000';
        debugLagCtx.fillRect(0, 0, 512, 83);
        debugLagCtx.fillStyle = '#000000';
        debugLagCtx.fillRect(0, 83, 512, 83);
        for (let i = 0; i < debugTickFilled; i++) {
            const ms = debugTickSamples[i];
            const height = Math.min(166, Math.max(1, Math.round(ms * 83 / 50)));
            debugLagCtx.fillStyle = ms > 50 ? '#ff3030' : ms > 25 ? '#e0e030' : '#30e030';
            debugLagCtx.fillRect(i, 166 - height, 1, height);
        }
    }

    function debugProfilerSnapshot(now) {
        const root = debugProfRoot;
        let snapshot = null;
        if (root > 0) {
            const unspecified = Math.max(0, root - debugProfRender - debugProfTick - debugProfSound - debugProfLight);
            snapshot = [
                ['render', debugProfRender], ['tick', debugProfTick], ['sound', debugProfSound],
                ['updatelights', debugProfLight], ['unspecified', unspecified]
            ].map(([name, ms]) => ({ name, share: ms * 100 / root }))
                .sort((a, b) => b.share - a.share);
            if (now - debugProfWindowAt >= 1000) {
                debugProfShown = snapshot;
                debugProfWindowAt = now;
                debugProfRoot = debugProfRender = debugProfTick = debugProfSound = debugProfLight = 0;
            }
        }
        return debugProfShown ?? snapshot;
    }

    function drawDebugProfiler(now) {
        if (!debugProfilerVisible || now - debugProfilerDrawAt < 250) return;
        debugProfilerDrawAt = now;
        const rows = debugProfilerSnapshot(now);
        const ctx = debugProfilerCtx;
        ctx.clearRect(0, 0, DEBUG_PIE_W, DEBUG_PIE_H);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.784)';
        ctx.fillRect(0, 0, DEBUG_PIE_W, DEBUG_PIE_H);
        const k = DEBUG_PIE_X, l = DEBUG_PIE_Y, j = DEBUG_PIE_R;
        let start = 0;
        for (const row of rows ?? []) {
            const steps = Math.floor(row.share / 4) + 1;
            const color = debugProfColor(row.name);
            const point = step => {
                const f = (start + row.share * step / steps) * Math.PI * 2 / 100;
                return [k + Math.sin(f) * j, l - Math.cos(f) * j * 0.5];
            };
            ctx.beginPath();
            ctx.moveTo(k, l);
            for (let step = steps; step >= 0; step--) ctx.lineTo(...point(step));
            ctx.closePath();
            ctx.fillStyle = debugHex(color);
            ctx.fill();
            ctx.beginPath();
            for (let step = steps; step >= 0; step--) ctx.lineTo(...point(step));
            for (let step = 0; step <= steps; step++) {
                const [px, py] = point(step);
                ctx.lineTo(px, py + 10);
            }
            ctx.closePath();
            ctx.fillStyle = debugHex((color & 0xFEFEFE) >> 1);
            ctx.fill();
            start += row.share;
        }
        const setText = (el, text, color = '#ffffff') => {
            el.style.color = color;
            setMinecraftText(el, text, minecraftFont, { scale: 1 });
        };
        setText(debugProfHeaderName, '[0] root');
        setText(debugProfHeaderShare, debugPercent(100));
        debugProfRows.forEach((cells, index) => {
            const row = rows?.[index];
            for (const cell of [cells.name, cells.share, cells.global]) cell.style.display = row ? 'block' : 'none';
            if (!row) return;
            const color = debugHex(debugProfColor(row.name));
            setText(cells.name, `[${index + 1}] ${row.name}`, color);
            setText(cells.share, debugPercent(row.share), color);
            setText(cells.global, debugPercent(row.share), color);
        });
    }

    function updateDebugOverlay(now) {
        if (!debugInfo || dead || chatOpen || inventoryOpen || gameMenuOpen) return;
        debugFrameCount++;
        if (now - debugLastUpdate >= 1000) {
            debugFps = Math.round(debugFrameCount * 1000 / (now - debugLastUpdate));
            debugChunkUpdatesShown = debugChunkUpdatesCount;
            debugChunkUpdatesCount = 0;
            debugFrameCount = 0;
            debugLastUpdate = now;
        }
        drawDebugLagometer(now);
        drawDebugProfiler(now);
        if (now - debugOverlayRenderAt < 100) return;
        debugOverlayRenderAt = now;

        const x = cameraPosition[0];
        // O jar mostra posY (olhos) com yOffset float 1.62F; replica o mesmo número.
        const y = cameraPosition[1] + (Math.fround(PLAYER_EYE_HEIGHT) - PLAYER_EYE_HEIGHT);
        const z = cameraPosition[2];
        const facing = Math.round((((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2)) % 4;

        // RenderGlobal.getDebugInfoRenders: C (desenhados) / total, F (fora do frustum), O (oclusão), E (vazios).
        const visible = new Set(visibleRenderEntries);
        let drawn = 0, clipped = 0, occluded = 0, empty = 0, total = 0;
        for (const entry of loadedChunks.values()) {
            if (!entry.gpu) continue;
            const filled = entry.sectionsNonEmpty ?? 8;
            total += 8;
            empty += 8 - filled;
            if (visible.has(entry)) drawn += filled;
            else clipped += filled;
        }

        // RenderGlobal.getDebugInfoEntities: E renderizadas/total, B escondidas, I invisíveis.
        const entityTotal = 1 + itemEntities.length;
        const entityRendered = (cameraMode !== 0 ? 1 : 0) + itemEntities.length;
        const entityHidden = 0;
        const entityInvisible = entityTotal - entityHidden - entityRendered;

        const lines = [
            `Minecraft 1.0.0 (${debugFps} fps, ${debugChunkUpdatesShown} chunk updates)`,
            `C: ${drawn}/${total}. F: ${clipped}, O: ${occluded}, E: ${empty}`,
            `E: ${entityRendered}/${entityTotal}. B: ${entityHidden}, I: ${entityInvisible}`,
            `P: ${particleEngine.count}. T: All: ${entityTotal}`,
            `ServerChunkCache: ${loadedChunks.size} Drop: 0`,
            `x: ${debugJavaDouble(x)}`,
            `y: ${debugJavaDouble(y)}`,
            `z: ${debugJavaDouble(z)}`,
            `f: ${facing}`,
            `Seed: ${worldSeed}`
        ];
        const scale = Number(getComputedStyle(document.documentElement).getPropertyValue('--hud-scale')) || 1;
        lines.forEach((line, index) => setMinecraftText(debugLeftLines[index], line, minecraftFont, { scale }));

        // Memória do heap JS (Chromium/Electron), no formato do Runtime do Java.
        const memory = performance.memory;
        if (memory) {
            const max = memory.jsHeapSizeLimit, allocated = memory.totalJSHeapSize;
            const used = memory.usedJSHeapSize;
            const mb = bytes => Math.floor(bytes / 1024 / 1024);
            setMinecraftText(debugRightLines[0],
                `Used memory: ${Math.floor(used * 100 / max)}% (${mb(used)}MB) of ${mb(max)}MB`, minecraftFont, { scale });
            setMinecraftText(debugRightLines[1],
                `Allocated memory: ${Math.floor(allocated * 100 / max)}% (${mb(allocated)}MB)`, minecraftFont, { scale });
        }
    }

    function updateHudScale() {
        const scale = Math.max(
            1,
            Math.min(4, Math.floor(
                Math.min(window.innerWidth / 320, window.innerHeight / 240)
            ))
        );
        document.documentElement.style.setProperty('--hud-scale', scale);
        setMinecraftText(document.querySelector('#death-title'), 'You died!', minecraftFont, { scale: 2 * scale });
        setMinecraftText(document.querySelector('#death-score'), 'Score: 0', minecraftFont, { scale });
        setMinecraftText(respawnButton, 'Respawn', minecraftFont);
    }

    window.addEventListener('resize', () => {
        updateHudScale();
        updateSurvivalHud();
        if (inventoryOpen) {
            inventoryPreview?.render();
            renderInventoryScreen();
        }
    });
    updateHudScale();
    updateHotbar();
    updateSurvivalHud();

    window.addEventListener('keydown', event => {
        if (inventoryOpen || gameMenuOpen) return;
        const slot = Number(event.key);
        if (slot >= 1 && slot <= 9) {
            inventory.selectHotbar(slot - 1);
            updateHotbar();
        }
    });

    function respawnPlayer() {
        if (!dead || !spawnPoint) return;
        cameraPosition[0] = spawnPoint[0];
        cameraPosition[1] = spawnPoint[1];
        cameraPosition[2] = spawnPoint[2];
        health = 20;
        foodStats = new FoodStatsMC10();
        air = 300;
        hurtTicks = 0;
        previousDamage = 0;
        fallDistance = 0;
        verticalVelocity = 0;
        grounded = false;
        inWater = false;
        dead = false;
        deathCause = '';
        deathScreen.classList.remove('visible');
        updateSurvivalHud();
        updateChunks();
    }

    respawnButton.addEventListener('click', respawnPlayer);
    window.addEventListener('keydown', event => {
        if (event.code === 'KeyR' && dead) {
            event.preventDefault();
            respawnPlayer();
        }
    });

    function getWorldBlock(x, y, z) {
        if (y < 0 || y >= 128) return null;

        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        const entry = loadedChunks.get(`${cx},${cz}`);

        if (!entry) return null;

        const lx = x - cx * 16;
        const lz = z - cz * 16;

        return entry.chunk.blocks[lx * 2048 + lz * 128 + y];
    }

    const particleColorCache = new Map();
    const particleEngine = createMinecraft10ParticleEngine({
        getBlock: getWorldBlock,
        getBlockMetadata: getWorldMetadata,
        getPlayerPosition: () => cameraPosition,
        // Bounding boxes do JAR 1.0 usadas por EntityDiggingFX ao bater no bloco.
        getBlockBounds: (x, y, z, blockId, metadata) => {
            switch (blockId) {
                case 44: return { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 0.5, maxZ: 1 };
                case 78: return { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 2 * (1 + (metadata & 7)) / 16, maxZ: 1 };
                case 60: return { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 15 / 16, maxZ: 1 };
                case 81: return { minX: 1 / 16, minY: 0, minZ: 1 / 16, maxX: 15 / 16, maxY: 1, maxZ: 15 / 16 };
                case 26: return { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 9 / 16, maxZ: 1 };
                case 54: return { minX: 1 / 16, minY: 0, minZ: 1 / 16, maxX: 15 / 16, maxY: 14 / 16, maxZ: 15 / 16 };
                case 85: return { minX: 0.375, minY: 0, minZ: 0.375, maxX: 0.625, maxY: 1, maxZ: 0.625 };
                case 50: return { minX: 0.4, minY: 0, minZ: 0.4, maxX: 0.6, maxY: 0.6, maxZ: 0.6 };
                case 37: case 38: return { minX: 0.3, minY: 0, minZ: 0.3, maxX: 0.7, maxY: 0.6, maxZ: 0.7 };
                case 39: case 40: return { minX: 0.3, minY: 0, minZ: 0.3, maxX: 0.7, maxY: 0.4, maxZ: 0.7 };
                case 6: case 31: return { minX: 0.1, minY: 0, minZ: 0.1, maxX: 0.9, maxY: 0.8, maxZ: 0.9 };
                case 59: return { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 0.25, maxZ: 1 };
                case 83: return { minX: 0.125, minY: 0, minZ: 0.125, maxX: 0.875, maxY: 1, maxZ: 0.875 };
                case 55: case 70: case 72: return { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 0.0625, maxZ: 1 };
                case 66: case 27: case 28: return { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 0.125, maxZ: 1 };
                default: return null;
            }
        },
        getBlockColor: (blockId, metadata, x, z) => {
            if (![18, 31, 106].includes(blockId)) return 0xffffff;
            const bx = Math.floor(x);
            const bz = Math.floor(z);
            const key = String(bx) + ',' + String(bz);
            let climateCell = particleColorCache.get(key);
            if (!climateCell) {
                climateCell = climate.at(bx, bz);
                if (particleColorCache.size > 256) particleColorCache.clear();
                particleColorCache.set(key, climateCell);
            }
            if (blockId === 31) {
                return climateCell.grass ?? grassColor(grassPixels, climateCell.temperature, climateCell.rainfall);
            }
            const colorIndex = grassColorIndex(climateCell.temperature, climateCell.rainfall).index;
            return foliagePixels[colorIndex] & 0xffffff;
        }
    });

    // randomDisplayTick dos blocos do JAR 1.0: agw (líquidos),
    // wj (fogo), kw (redstone), sc (portal) e sy (mesa de encantamento).
    function tickMinecraft10ParticleSources() {
        const baseX = Math.floor(cameraPosition[0]);
        const baseY = Math.floor(cameraPosition[1]);
        const baseZ = Math.floor(cameraPosition[2]);
        const isFluid = id => id === 8 || id === 9 || id === 10 || id === 11;
        const isSolid = id => id !== null && id !== 0 && !isFluid(id);
        const isOpaque = id => isSolid(id) && ![18,20,31,37,38,39,40,50,51,55,75,76,78,83,90,106,111].includes(id);
        const flammable = new Set([5,17,18,31,35,46,47,53,85,106]);

        const randomOffset = () => Math.floor(Math.random() * 16) - Math.floor(Math.random() * 16);
        for (let sample = 0; sample < 1000; sample++) {
            const x = baseX + randomOffset();
            const y = baseY + randomOffset();
            const z = baseZ + randomOffset();
            const blockId = getWorldBlock(x, y, z);
            if (blockId === 0 && Math.floor(Math.random() * 8) > y) {
                particleEngine.spawn('depthsuspend', x + Math.random(), y + Math.random(), z + Math.random());
            }
            if (blockId === null) continue;
            const metadata = getWorldMetadata(x, y, z);

            // bg.b() no Minecraft 1.0: tochas emitem fumaça e chama.
            if (blockId === 50) {
                const direction = metadata & 7;
                const px = x + 0.5;
                const py = y + 0.7;
                const pz = z + 0.5;
                const offset = 0.27;
                let sx = px, sy = py, sz = pz;
                if (direction === 1) sx -= offset;
                else if (direction === 2) sx += offset;
                else if (direction === 3) sz -= offset;
                else if (direction === 4) sz += offset;
                else sy = y;
                particleEngine.spawn('smoke', sx, sy, sz);
                particleEngine.spawn('flame', sx, sy, sz);
                continue;
            }

            if (blockId === 110 && Math.floor(Math.random() * 10) === 0) {
                particleEngine.spawn('townaura', x + Math.random(), y + 1.1, z + Math.random());
            }

            if (blockId === 8 || blockId === 9 || blockId === 10 || blockId === 11) {
                if ((blockId === 8 || blockId === 9) &&
                    Math.floor(Math.random() * 10) === 0 &&
                    (metadata <= 0 || metadata >= 8)) {
                    particleEngine.spawn(
                        'suspended',
                        x + Math.random(), y + Math.random(), z + Math.random()
                    );
                }

                if ((blockId === 10 || blockId === 11) &&
                    getWorldBlock(x, y + 1, z) === 0 &&
                    Math.floor(Math.random() * 100) === 0) {
                    particleEngine.spawn('lava', x + Math.random(), y + 1, z + Math.random());
                }

                const below = getWorldBlock(x, y - 1, z);
                const belowTwo = getWorldBlock(x, y - 2, z);
                if (Math.floor(Math.random() * 10) === 0 &&
                    isSolid(below) && !isOpaque(belowTwo)) {
                    particleEngine.spawn(
                        blockId === 8 || blockId === 9 ? 'dripWater' : 'dripLava',
                        x + Math.random(), y - 1.05, z + Math.random()
                    );
                }
                continue;
            }

            if (blockId === 51) {
                const below = getWorldBlock(x, y - 1, z);
                if (isSolid(below)) {
                    for (let i = 0; i < 3; i++) {
                        particleEngine.spawn(
                            'largesmoke',
                            x + Math.random(),
                            y + Math.random() * 0.5 + 0.5,
                            z + Math.random()
                        );
                    }
                } else {
                    const sides = [
                        [x - 1, y, z, x + Math.random() * 0.1, y + Math.random(), z + Math.random()],
                        [x + 1, y, z, x + 1 - Math.random() * 0.1, y + Math.random(), z + Math.random()],
                        [x, y, z - 1, x + Math.random(), y + Math.random(), z + Math.random() * 0.1],
                        [x, y, z + 1, x + Math.random(), y + Math.random(), z + 1 - Math.random() * 0.1],
                        [x, y + 1, z, x + Math.random(), y + 1 - Math.random() * 0.1, z + Math.random()]
                    ];
                    for (const [sx, sy, sz, px, py, pz] of sides) {
                        if (!flammable.has(getWorldBlock(sx, sy, sz))) continue;
                        for (let i = 0; i < 2; i++) {
                            particleEngine.spawn('largesmoke', px, py, pz);
                        }
                    }
                }
                continue;
            }

            if (blockId === 55 && metadata > 0) {
                const power = metadata / 15;
                const red = power * 0.6 + 0.4;
                const green = Math.max(0, power * power * 0.7 - 0.5);
                const blue = Math.max(0, power * power * 0.6 - 0.7);
                particleEngine.spawn(
                    'reddust',
                    x + 0.5 + (Math.random() - 0.5) * 0.2,
                    y + 0.0625,
                    z + 0.5 + (Math.random() - 0.5) * 0.2,
                    red, green, blue
                );
                continue;
            }

            if (blockId === 90) {
                for (let i = 0; i < 4; i++) {
                    let px = x + Math.random();
                    const py = y + Math.random();
                    let pz = z + Math.random();
                    let vx = (Math.random() - 0.5) * 0.5;
                    const vy = (Math.random() - 0.5) * 0.5;
                    let vz = (Math.random() - 0.5) * 0.5;
                    const direction = Math.floor(Math.random() * 2) * 2 - 1;
                    if (getWorldBlock(x - 1, y, z) === 90 ||
                        getWorldBlock(x + 1, y, z) === 90) {
                        pz = z + 0.5 + 0.25 * direction;
                        vz = Math.random() * 2 * direction;
                    } else {
                        px = x + 0.5 + 0.25 * direction;
                        vx = Math.random() * 2 * direction;
                    }
                    particleEngine.spawn('portal', px, py, pz, vx, vy, vz);
                }
                continue;
            }

            if (blockId === 116) {
                for (let sx = x - 2; sx <= x + 2; sx++) {
                    for (let sz = z - 2; sz <= z + 2; sz++) {
                        if (sx > x - 2 && sx < x + 2 && sz === z - 1) {
                            sz = z + 2;
                        }
                        if (Math.floor(Math.random() * 16) !== 0) continue;
                        for (let sy = y; sy <= y + 1; sy++) {
                            if (getWorldBlock(sx, sy, sz) !== 47) continue;
                            const midX = Math.floor((sx + x) / 2);
                            const midY = sy;
                            const midZ = Math.floor((sz + z) / 2);
                            if (getWorldBlock(midX, midY, midZ) !== 0) continue;
                            particleEngine.spawn(
                                'enchantmenttable',
                                x + 0.5, y + 2, z + 0.5,
                                sx - x + Math.random() - 0.5,
                                sy - y - Math.random() - 1,
                                sz - z + Math.random() - 0.5
                            );
                        }
                    }
                }
            }
        }
    }

    // Usa os níveis reais de sky light e block light calculados no chunk,
    // incluindo luz ambiente propagada lateralmente em cavernas e construções.
    function getFirstPersonLightLevels() {
        const blockX = Math.floor(cameraPosition[0]);
        const blockY = Math.max(0, Math.min(127, Math.floor(cameraPosition[1])));
        const blockZ = Math.floor(cameraPosition[2]);
        const chunkX = Math.floor(blockX / 16);
        const chunkZ = Math.floor(blockZ / 16);
        const entry = loadedChunks.get(`${chunkX},${chunkZ}`);
        if (!entry) return { sky: 15, block: 0 };

        const localX = blockX - chunkX * 16;
        const localZ = blockZ - chunkZ * 16;
        const index = localX * 2048 + localZ * 128 + blockY;
        return {
            sky: entry.chunk.skyLight?.[index] ?? 15,
            block: entry.chunk.blockLight?.[index] ?? 0
        };
    }

    // O JAR usa um nibble (4 bits) por bloco. Índice: x*2048 + z*128 + y.
    function readChunkMetadata(entry, index) {
        const data = entry.chunk.metadata;
        if (!data) return 0;
        const byte = data[index >> 1] ?? 0;
        return (index & 1) ? ((byte >> 4) & 15) : (byte & 15);
    }

    function writeChunkMetadata(entry, index, value) {
        entry.chunk.metadata ??= new Uint8Array(16384);
        const data = entry.chunk.metadata;
        const byteIndex = index >> 1;
        const nibble = value & 15;
        if (index & 1) {
            data[byteIndex] = (data[byteIndex] & 0x0f) | (nibble << 4);
        } else {
            data[byteIndex] = (data[byteIndex] & 0xf0) | nibble;
        }
    }

    function rememberChunkBlock(chunkX, chunkZ, index, blockId, metadata = 0) {
        const key = `${chunkX},${chunkZ}`;
        let changes = modifiedChunkBlocks.get(key);
        if (!changes) {
            changes = new Map();
            modifiedChunkBlocks.set(key, changes);
        }
        changes.set(index, { blockId, metadata: metadata & 15 });
    }

    function restoreChunkBlocks(entry) {
        const changes = modifiedChunkBlocks.get(`${entry.chunkX},${entry.chunkZ}`);
        if (!changes) return;
        for (const [index, change] of changes) {
            entry.chunk.blocks[index] = change.blockId;
            writeChunkMetadata(entry, index, change.metadata);
        }
    }

    function getWorldMetadata(x, y, z) {
        if (y < 0 || y >= 128) return 0;
        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        const entry = loadedChunks.get(`${cx},${cz}`);
        if (!entry) return 0;
        const lx = x - cx * 16;
        const lz = z - cz * 16;
        return readChunkMetadata(entry, lx * 2048 + lz * 128 + y);
    }

    // Escrita interna usada pela física; o callback onChanged reconstrói a malha.
    function setWorldCell(x, y, z, blockId, metadata = 0) {
        if (y < 0 || y >= 128) return false;
        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        const entry = loadedChunks.get(`${cx},${cz}`);
        if (!entry) return false;
        const lx = x - cx * 16;
        const lz = z - cz * 16;
        const index = lx * 2048 + lz * 128 + y;
        entry.chunk.blocks[index] = blockId;
        writeChunkMetadata(entry, index, metadata);
        rememberChunkBlock(cx, cz, index, blockId, metadata);
        markLocalLighting(cx, cz);
        rebuildNearbyMeshes(cx, cz);
        return true;
    }



    const droppedItemGpuCache = new Map();
    const droppedItemTextures = {
        3: [2, 2, 2, 2, 2, 2],
        4: [16, 16, 16, 16, 16, 16],
        5: [4, 4, 4, 4, 4, 4],
        5: [4, 4, 4, 4, 4, 4],
        12: [18, 18, 18, 18, 18, 18],
        13: [19, 19, 19, 19, 19, 19],
        17: [21, 21, 20, 20, 20, 20],
        318: [19, 19, 19, 19, 19, 19]
    };

    function getDroppedItemGpu(itemId, metadata = 0) {
        if (!droppedItemTextures[itemId]) return null;
        const variant = itemId === 17 && (metadata & 3) === 2 ? 2 : 0;
        const cacheKey = variant ? `${itemId}:${variant}` : String(itemId);
        if (droppedItemGpuCache.has(cacheKey)) return droppedItemGpuCache.get(cacheKey);
        const textures = variant ? [21, 21, 117, 117, 117, 117] : droppedItemTextures[itemId];

        const mesh = buildBlockMesh(spec, {
            // UVs do atlas são calculados a partir de bounds 0..1.
            // Centraliza a geometria depois, sem alterar as coordenadas UV.
            bounds: {
                minX: 0, maxX: 1,
                minY: 0, maxY: 1,
                minZ: 0, maxZ: 1
            },
            textureIndex: textures
        });
        for (let vertex = 0; vertex < mesh.vertexCount; vertex++) {
            mesh.positions[vertex * 3] -= 0.5;
            mesh.positions[vertex * 3 + 1] -= 0.5;
            mesh.positions[vertex * 3 + 2] -= 0.5;
        }
        mesh.colors = new Float32Array(mesh.vertexCount * 3).fill(1);
        const gpu = createGpuMesh(mesh);
        droppedItemGpuCache.set(cacheKey, gpu);
        return gpu;
    }

    // Block-held item rendering follows zr.java (third-person right arm item).
    const heldBlockGpuCache = new Map();
    const heldBlockTextures = {
        1: [1, 1, 1, 1, 1, 1],
        2: [2, 0, 3, 3, 3, 3],
        3: [2, 2, 2, 2, 2, 2],
        4: [16, 16, 16, 16, 16, 16],
        5: [4, 4, 4, 4, 4, 4],
        7: [17, 17, 17, 17, 17, 17],
        12: [18, 18, 18, 18, 18, 18],
        13: [19, 19, 19, 19, 19, 19],
        17: [21, 21, 20, 20, 20, 20],
        18: [52, 52, 52, 52, 52, 52],
        24: [208, 176, 192, 192, 192, 192],
        79: [67, 67, 67, 67, 67, 67],
        110: [2, 78, 77, 77, 77, 77]
    };

    function getHeldBlockGpu(itemId, metadata = 0) {
        const baseTextures = heldBlockTextures[itemId];
        if (!baseTextures) return null;
        const variant = itemId === 17 && (metadata & 3) === 2 ? 2 : 0;
        const cacheKey = variant ? `${itemId}:${variant}` : String(itemId);
        if (heldBlockGpuCache.has(cacheKey)) return heldBlockGpuCache.get(cacheKey);
        const textures = variant ? [21, 21, 117, 117, 117, 117] : baseTextures;

        const mesh = buildBlockMesh(spec, {
            bounds: {
                minX: 0, maxX: 1,
                minY: 0, maxY: 1,
                minZ: 0, maxZ: 1
            },
            textureIndex: textures
        });
        mesh.colors = new Float32Array(mesh.vertexCount * 3).fill(1);
        const gpu = createGpuMesh(mesh);
        heldBlockGpuCache.set(cacheKey, gpu);
        return gpu;
    }

    function drawHeldBlock(itemId, itemMvp, model, underwaterState = false, viewPosition = [0, 0, 0], metadata = 0) {
        const gpu = getHeldBlockGpu(itemId, metadata);
        if (!gpu) return;
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniformMatrix4fv(mvpLocation, false, itemMvp);
        gl.uniformMatrix4fv(modelLocation, false, model);
        gl.uniform3f(offsetLocation, 0, 0, 0);
        gl.uniform1f(alphaMultiplierLocation, 1.0);
        gl.uniform1f(alphaTestLocation, 0.0);
        gl.uniform1f(underwaterLocation, underwaterState ? 1.0 : 0.0);
        gl.uniform3f(cameraPositionLocation, viewPosition[0], viewPosition[1], viewPosition[2]);
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        // The negative Y scale is part of zr.java's original item transform.
        // Render without face culling so the mirrored winding stays visible.
        gl.disable(gl.CULL_FACE);
        gl.bindVertexArray(gpu.vao);
        gl.drawElements(gl.TRIANGLES, gpu.indexCount, gl.UNSIGNED_SHORT, 0);
        gl.bindVertexArray(null);
        gl.enable(gl.CULL_FACE);
        gl.uniformMatrix4fv(modelLocation, false, identityModel);
        gl.uniform1f(underwaterLocation, underwaterState ? 1.0 : 0.0);
        gl.uniform3f(cameraPositionLocation, viewPosition[0], viewPosition[1], viewPosition[2]);
    }

    function damagePlayer(amount, cause = 'generic') {
        if (dead || amount <= 0 || health <= 0) return false;

        let applied = amount;
        if (hurtTicks > 10) {
            if (amount <= previousDamage) return false;
            applied = amount - previousDamage;
            previousDamage = amount;
        } else {
            previousDamage = amount;
            hurtTicks = 20;
        }

        if (applied <= 0) return false;
        health = Math.max(0, health - applied);
        updateSurvivalHud();

        if (health <= 0) {
            dead = true;
            deathCause = cause;

            // vi.a(pm): InventoryPlayer.g() solta os 36 slots + armadura.
            for (const stack of inventory.takeAllStacks()) {
                itemEntities.push(createPlayerDrop(stack, {
                    x: cameraPosition[0],
                    y: cameraPosition[1] - 0.3,
                    z: cameraPosition[2],
                    yaw,
                    pitch
                }));
            }
            updateHotbar();
            deathScreen.classList.add('visible');
            document.exitPointerLock?.();
            console.log(`Jogador morreu: ${cause}`);
        }
        return true;
    }

    function healPlayer(amount) {
        if (health <= 0 || dead) return;
        health = Math.min(health + amount, 20);
        updateSurvivalHud();
    }

    function headUnderwater() {
        const id = getWorldBlock(
            Math.floor(cameraPosition[0]),
            Math.floor(cameraPosition[1]),
            Math.floor(cameraPosition[2])
        );
        return id === 8 || id === 9;
    }

    function spawnBlockDrop(blockId, x, y, z, metadata = 0) {
        const stack = getMinecraft10BlockDrop(blockId, Math.random, metadata);
        if (!stack) return false;
        itemEntities.push(createBlockDrop(stack, x, y, z));
        return true;
    }

    function rebuildNearbyMeshes(chunkX, chunkZ) {
        // Só o chunk alterado e os vizinhos que compartilham suas quatro
        // bordas podem ter faces afetadas. O Set evita trabalho duplicado.
        queueChunkMesh(chunkX, chunkZ, true);
        queueChunkMesh(chunkX - 1, chunkZ);
        queueChunkMesh(chunkX + 1, chunkZ);
        queueChunkMesh(chunkX, chunkZ - 1);
        queueChunkMesh(chunkX, chunkZ + 1);
    }

    function setWorldBlock(x, y, z, blockId, metadata = 0) {
        if (y < 0 || y >= 128) return false;

        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        const entry = loadedChunks.get(`${cx},${cz}`);
        if (!entry) return false;

        const lx = x - cx * 16;
        const lz = z - cz * 16;
        const index = lx * 2048 + lz * 128 + y;

        entry.chunk.blocks[index] = blockId;
        writeChunkMetadata(entry, index, metadata);
        rememberChunkBlock(cx, cz, index, blockId, metadata);
        // Atualiza a luz solar direta da coluna imediatamente. O recálculo
        // propagado continua incremental, mas não deixa a sombra antiga presa
        // enquanto a tarefa de iluminação dos chunks termina.
        refreshSkyLightColumn(entry.chunk, lx, lz);
        waterSimulation.notifyBlockChange(x, y, z);
        // Alterações de blocos recalculam a iluminação apenas na vizinhança
        // afetada, em vez de reiniciar o cálculo de todos os chunks carregados.
        // Cancela tarefas antigas para impedir que buffers desatualizados sejam publicados.
        lightingTask = null;
        markLocalLighting(cx, cz);
        rebuildNearbyMeshes(cx, cz);
        return true;
    }

    function raycastBlock(maxDistance = 6) {
        const raycastStartedAt = performance.now();
        raycastWindowCalls++;
        const direction = [
            -Math.sin(yaw) * Math.cos(pitch),
            -Math.sin(pitch),
            -Math.cos(yaw) * Math.cos(pitch)
        ];

        const [ox, oy, oz] = cameraPosition;
        const [dx, dy, dz] = direction;

        let x = Math.floor(ox);
        let y = Math.floor(oy);
        let z = Math.floor(oz);

        const stepX = dx >= 0 ? 1 : -1;
        const stepY = dy >= 0 ? 1 : -1;
        const stepZ = dz >= 0 ? 1 : -1;

        const deltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
        const deltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
        const deltaZ = dz === 0 ? Infinity : Math.abs(1 / dz);

        let maxX = dx > 0 ? (x + 1 - ox) / dx :
                   dx < 0 ? (ox - x) / -dx : Infinity;

        let maxY = dy > 0 ? (y + 1 - oy) / dy :
                   dy < 0 ? (oy - y) / -dy : Infinity;

        let maxZ = dz > 0 ? (z + 1 - oz) / dz :
                   dz < 0 ? (oz - z) / -dz : Infinity;

        let previous = null;
        let face = 1;
        let distance = 0;

        for (let i = 0; i < 128 && distance <= maxDistance; i++) {
            const blockId = getWorldBlock(x, y, z);

            if (blockId !== null && blockId !== 0 && blockId !== 8 && blockId !== 9) {
                raycastWindowMs += performance.now() - raycastStartedAt;
                return { x, y, z, blockId, previous, face };
            }

            previous = { x, y, z };

            if (maxX < maxY && maxX < maxZ) {
                distance = maxX;
                maxX += deltaX;
                x += stepX;
                face = stepX > 0 ? 4 : 5;
            } else if (maxY < maxZ) {
                distance = maxY;
                maxY += deltaY;
                y += stepY;
                face = stepY > 0 ? 0 : 1;
            } else {
                distance = maxZ;
                maxZ += deltaZ;
                z += stepZ;
                face = stepZ > 0 ? 2 : 3;
            }
        }

        raycastWindowMs += performance.now() - raycastStartedAt;
        return null;
    }

    canvas.addEventListener('contextmenu', event => {
        event.preventDefault();
    });

    canvas.addEventListener('mousedown', event => {
        if (controlsScreen.classList.contains('open') && waitingForControl >= 0) {
            event.preventDefault();
            setControlBinding(waitingForControl, `Mouse${event.button}`);
            return;
        }
        if (document.pointerLockElement !== canvas && !mobileActionDispatch) return;
        if (event.button !== 0 && event.button !== 2) return;

        const now = performance.now();

        if (event.button === 0) {
            // Minecraft 1.0: o balanço do braço é acionado pelo ataque,
            // não pela ação de usar/colocar bloco com o botão direito.
            startArmSwing(now);
            leftMouseDown = true;
            const hit = raycastBlock(6);

            if (!hit || getBareHandMiningProgressPerTick(hit.blockId, {
                inWater: headUnderwater(),
                onGround: grounded
            }) <= 0) {
                miningTarget = null;
                return;
            }

            miningTarget = {
                x: hit.x,
                y: hit.y,
                z: hit.z,
                blockId: hit.blockId,
                progress: 0,
                nextTickAt: now + MINE_TICK_MS
            };
            particleEngine.spawnBlockHit(
                hit.x, hit.y, hit.z, hit.blockId,
                getWorldMetadata(hit.x, hit.y, hit.z), hit.face
            );
            nextMiningSwingAt = now + ARM_SWING_DURATION;
            return;
        }

        const hit = raycastBlock(6);
        if (!hit) return;

        // Botão direito: colocar no bloco adjacente.
        if (!hit.previous) return;

        const target = hit.previous;

        const heldStack = inventory.getCurrentItem();
        if (!heldStack || heldStack.count <= 0) return;
        selectedBlockId = heldStack.id;

        // Impede colocar blocos dentro do volume do jogador.
        const feetY = cameraPosition[1] - PLAYER_EYE_HEIGHT;

        // Ao agachar na borda, a posição pode ficar até 0,05 bloco
        // antes do limite por causa dos passos do sneak-edge. Compensa
        // essa margem pequena ao validar a colocação, sem permitir que
        // o bloco seja colocado dentro do volume real do jogador.
        const placementRadius = isControlDown('sneak')
            ? PLAYER_RADIUS - 0.05
            : PLAYER_RADIUS;
        const overlapsPlayer =
            target.x < cameraPosition[0] + placementRadius - 0.001 &&
            target.x + 1 > cameraPosition[0] - placementRadius + 0.001 &&
            target.y < feetY + PLAYER_HEIGHT - 0.001 &&
            target.y + 1 > feetY + 0.001 &&
            target.z < cameraPosition[2] + placementRadius - 0.001 &&
            target.z + 1 > cameraPosition[2] - placementRadius + 0.001;

        if (overlapsPlayer) return;

        // Permite substituir água por um bloco.
        const targetBlock = getWorldBlock(target.x, target.y, target.z);
        if (targetBlock !== 0 && targetBlock !== 8 && targetBlock !== 9) return;

        if (setWorldBlock(
            target.x,
            target.y,
            target.z,
            selectedBlockId,
            heldStack.damage ?? 0
        )) {
            // Minecraft 1.0: após colocar o bloco com sucesso, o player
            // executa o mesmo swing de braço usado no ataque (vi.m_()).
            startArmSwing(now);
            legacyAudio.placeBlock(selectedBlockId);
            inventory.consumeSelected(1);
            updateHotbar();
            console.log(`Bloco colocado: ${selectedBlockId}`);
        }
    });

    window.addEventListener('mousedown', event => {
        if (event.button === 2) {
            rightMouseDown = true;
            nextBlockPlacementAt = performance.now() + MINE_TICK_MS * 4;
        }
    });

    window.addEventListener('mouseup', event => {
        if (event.button === 0) {
            leftMouseDown = false;
            miningTarget = null;
        } else if (event.button === 2) {
            rightMouseDown = false;
        }
    });

    // O jogo não deve acumular tempo de mineração enquanto a aba está oculta.
    document.addEventListener('visibilitychange', () => {
        if (miningTarget) {
            miningTarget.nextTickAt = performance.now() + MINE_TICK_MS;
        }
        if (rightMouseDown) nextBlockPlacementAt = performance.now() + MINE_TICK_MS * 4;
    });

    function bodyInWater() {
        const x = Math.floor(cameraPosition[0]);
        const z = Math.floor(cameraPosition[2]);
        const feetY = cameraPosition[1] - PLAYER_EYE_HEIGHT;

        const lowerBlock = getWorldBlock(x, Math.floor(feetY + 0.2), z);
        const middleBlock = getWorldBlock(
            x,
            Math.floor(feetY + PLAYER_HEIGHT * 0.55),
            z
        );

        return [8, 9].includes(lowerBlock) || [8, 9].includes(middleBlock);
    }

    function collidesAt(px, eyeY, pz) {
        const feetY = eyeY - PLAYER_EYE_HEIGHT;

        const minX = Math.floor(px - PLAYER_RADIUS + 0.001);
        const maxX = Math.floor(px + PLAYER_RADIUS - 0.001);
        const minY = Math.floor(feetY + 0.001);
        const maxY = Math.floor(feetY + PLAYER_HEIGHT - 0.001);
        const minZ = Math.floor(pz - PLAYER_RADIUS + 0.001);
        const maxZ = Math.floor(pz + PLAYER_RADIUS - 0.001);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const block = getWorldBlock(x, y, z);

                    // Chunks não carregados bloqueiam a passagem.
                    if (block === null) return true;

                    // Água ainda não possui física nesta versão.
                    if (block !== 0 && block !== 8 && block !== 9) return true;
                }
            }
        }

        return false;
    }

    // Entity.moveEntity do Minecraft 1.0: ao agachar no chão, não
    // permite deslocamento horizontal se a caixa do jogador perder apoio.
    function hasSneakSupportAt(px, pz) {
        const feetY = cameraPosition[1] - PLAYER_EYE_HEIGHT;
        const supportY = Math.floor(feetY - 0.05);
        const minX = Math.floor(px - PLAYER_RADIUS + 0.001);
        const maxX = Math.floor(px + PLAYER_RADIUS - 0.001);
        const minZ = Math.floor(pz - PLAYER_RADIUS + 0.001);
        const maxZ = Math.floor(pz + PLAYER_RADIUS - 0.001);

        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                const block = getWorldBlock(x, supportY, z);
                if (block !== null && block !== 0 && block !== 8 && block !== 9) {
                    return true;
                }
            }
        }
        return false;
    }

    function render(now = 0) {
        const frameWorkStartedAt = performance.now();
        debugFrameTickMs = 0;
        debugFrameSoundMs = 0;
        debugFrameLightMs = 0;
        debugRafDispatchMs = frameWorkStartedAt - now;
        const raycastNow = performance.now();
        if (!raycastWindowStartedAt) raycastWindowStartedAt = raycastNow;
        if (raycastNow - raycastWindowStartedAt >= 1000) {
            debugRaycastMs = raycastWindowMs;
            debugRaycastCalls = raycastWindowCalls;
            raycastWindowMs = 0;
            raycastWindowCalls = 0;
            raycastWindowStartedAt = raycastNow;
        }
        const elapsedTime = previousFrameTime
            ? Math.max(0, (now - previousFrameTime) / 1000)
            : 0;
        const deltaTime = Math.min(elapsedTime, 0.05);

        previousFrameTime = now;

        // ItemRenderer.a() do Minecraft 1.0: baixa o item antigo e só
        // substitui o stack quando a equipProgress chega perto de zero.
        const selectedHeldItem = inventory.getCurrentItem();
        const sameHeldItem = (renderedHeldItem?.id ?? null) === (selectedHeldItem?.id ?? null)
            && (renderedHeldItem?.damage ?? 0) === (selectedHeldItem?.damage ?? 0);
        if (!sameHeldItem && equippedProgress > 0.1) {
            equippedProgress = Math.max(0, equippedProgress - elapsedTime * 8);
        } else {
            if (!sameHeldItem) {
                renderedHeldItem = selectedHeldItem ? { ...selectedHeldItem } : null;
            }
            equippedProgress = Math.min(1, equippedProgress + elapsedTime * 8);
        }

        if (gameMenuOpen) {
            requestAnimationFrame(render);
            return;
        }

        // Consultas de tempo da GPU são instrumentação do F3, não trabalho
        // necessário ao jogo. Mantê-las desligadas evita overhead em todo frame.
        if (gpuTimerExtension && debugInfo) {
            const disjoint = gl.getParameter(gpuTimerExtension.GPU_DISJOINT_EXT);
            while (gpuTimerQueries.length) {
                const pending = gpuTimerQueries[0];
                if (!gl.getQueryParameter(pending, gl.QUERY_RESULT_AVAILABLE)) break;
                gpuTimerQueries.shift();
                if (!disjoint) {
                    debugGpuMs = gl.getQueryParameter(pending, gl.QUERY_RESULT) / 1e6;
                }
                gl.deleteQuery(pending);
            }
            activeGpuTimerQuery = gl.createQuery();
            gl.beginQuery(gpuTimerExtension.TIME_ELAPSED_EXT, activeGpuTimerQuery);
        }

        musicTickAccumulator += elapsedTime * 1000;
        debugParticleTickMs = 0;
        while (musicTickAccumulator >= MINE_TICK_MS) {
            // adt.d() do JAR: passeio aleatório amortecido do flicker das tochas.
            torchFlickerVelocity +=
                (Math.random() - Math.random()) *
                Math.random() * Math.random();
            torchFlickerVelocity *= 0.9;
            torchFlicker += torchFlickerVelocity - torchFlicker;
            updateMinecraft10Lightmap();

            const soundTickStartedAt = performance.now();
            legacyAudio.tickMusic();
            debugFrameSoundMs += performance.now() - soundTickStartedAt;
            const particleTickStartedAt = performance.now();
            particleEngine.tick();
            debugParticleTickMs += performance.now() - particleTickStartedAt;
            debugFrameTickMs += performance.now() - particleTickStartedAt;
            musicTickAccumulator -= MINE_TICK_MS;
        }

        const waterTickStartedAt = performance.now();
        waterSimulation.tick(now);
        debugFrameTickMs += performance.now() - waterTickStartedAt;
        updateWaterTextureAnimation(now);

        // Durante o streaming inicial, mantém o jogador suspenso no ponto
        // provisório. A física só começa depois de encontrar um spawn seguro.
        if (!survivalSpawnInitialized) {
            updateChunks();
            requestAnimationFrame(render);
            return;
        }

        if (dead) rightMouseDown = false;
        if (!dead && rightMouseDown && now >= nextBlockPlacementAt) {
            canvas.dispatchEvent(new MouseEvent('mousedown', {
                button: 2,
                bubbles: true,
                cancelable: true
            }));
            nextBlockPlacementAt = now + MINE_TICK_MS * 4;
        }

        let miningStage = -1;
        if (dead) {
            miningTarget = null;
            leftMouseDown = false;
        }
        if (!dead && leftMouseDown && !miningTarget) {
            const hit = raycastBlock(6);
            if (hit && getBareHandMiningProgressPerTick(hit.blockId, {
                inWater: headUnderwater(),
                onGround: grounded
            }) > 0) {
                miningTarget = {
                    x: hit.x,
                    y: hit.y,
                    z: hit.z,
                    blockId: hit.blockId,
                    progress: 0,
                    soundTicks: 0,
                    nextTickAt: now + MINE_TICK_MS
                };
                nextMiningSwingAt = now;
            }
        }

        if (!dead && miningTarget && leftMouseDown) {
            const currentHit = raycastBlock(6);
            const stillAimingAtTarget = currentHit &&
                currentHit.x === miningTarget.x &&
                currentHit.y === miningTarget.y &&
                currentHit.z === miningTarget.z &&
                currentHit.blockId === miningTarget.blockId;

            if (!stillAimingAtTarget) {
                miningTarget = null;
            } else {
                if (now >= nextMiningSwingAt) {
                    startArmSwing(now);
                    nextMiningSwingAt = now + ARM_SWING_DURATION + 80;
                }

                // O original acumula dano uma vez por tick de 50 ms (20 TPS).
                while (now >= miningTarget.nextTickAt && miningTarget.progress < 1) {
                    const damage = getBareHandMiningProgressPerTick(miningTarget.blockId, {
                        inWater: headUnderwater(),
                        onGround: grounded
                    });

                    if (damage <= 0) break;

                    // Java 1.0 usa float, não double, no acumulador.
                    miningTarget.progress = Math.fround(miningTarget.progress + damage);
                    miningTarget.soundTicks++;
                    if (miningTarget.soundTicks % 4 === 0) {
                        legacyAudio.mineTick(miningTarget.blockId);
                    }
                    miningTarget.nextTickAt += MINE_TICK_MS;
                }

                if (miningTarget.progress >= 1) {
                    const { x, y, z, blockId } = miningTarget;
                    const metadata = getWorldMetadata(x, y, z);
                    if (getWorldBlock(x, y, z) === blockId && setWorldBlock(x, y, z, 0)) {
                        particleEngine.spawnBlockBreak(x, y, z, blockId, metadata);
                        spawnBlockDrop(blockId, x, y, z, metadata);
                        legacyAudio.breakBlock(blockId);
                        console.log(`Bloco removido: ${blockId}`);
                    }
                    miningTarget = null;
                } else {
                    miningStage = getMiningCrackStage(miningTarget.progress);
                }
            }
        } else if (!leftMouseDown) {
            miningTarget = null;
        }

        const armSwingProgress = getArmSwingProgress(now);

        // Atualiza o contato com a água antes de calcular a física deste frame.
        inWater = bodyInWater();

        if (!flying && inWater && now >= nextWaterAmbientAt) {
            legacyAudio.waterAmbient();
            nextWaterAmbientAt = now + 8000 + Math.random() * 12000;
        }

        const frameStartX = cameraPosition[0];
        const frameStartY = cameraPosition[1];
        const frameStartZ = cameraPosition[2];
        const wasGrounded = grounded;
        const previousVerticalVelocity = verticalVelocity;
        const wasInWater = inWater;

        const cp = Math.cos(pitch);

        const forwardX = -Math.sin(yaw) * cp;
        const forwardY = -Math.sin(pitch);
        const forwardZ = -Math.cos(yaw) * cp;

        const rightX = Math.cos(yaw);
        const rightZ = -Math.sin(yaw);

        const forwardInput =
            (isControlDown('forward') ? 1 : 0) -
            (isControlDown('back') ? 1 : 0);

        const strafeInput =
            (isControlDown('right') ? 1 : 0) -
            (isControlDown('left') ? 1 : 0);

        let moveX;
        let moveZ;

        if (dead) {
            verticalVelocity = 0;
            grounded = false;
        } else if (flying) {
            moveX = forwardX * forwardInput + rightX * strafeInput;
            moveZ = forwardZ * forwardInput + rightZ * strafeInput;

            const length = Math.hypot(moveX, moveZ);

            if (length > 1) {
                moveX /= length;
                moveZ /= length;
            }

            const speed = 12;

            cameraPosition[0] +=
                moveX * speed * deltaTime;

            cameraPosition[1] +=
                forwardY * forwardInput * speed * deltaTime;

            cameraPosition[2] +=
                moveZ * speed * deltaTime;

            if (isControlDown('jump')) {
                cameraPosition[1] += speed * deltaTime;
            }

            if (
                isControlDown('sneak')
            ) {
                cameraPosition[1] -= speed * deltaTime;
            }

            verticalVelocity = 0;
            grounded = false;
        } else {
            // Movimento horizontal independente da inclinação da câmera.
            moveX =
                -Math.sin(yaw) * forwardInput +
                rightX * strafeInput;

            moveZ =
                -Math.cos(yaw) * forwardInput +
                rightZ * strafeInput;

            const length = Math.hypot(moveX, moveZ);

            if (length > 1) {
                moveX /= length;
                moveZ /= length;
            }

            const sneaking =
                isControlDown('sneak');
            const isSprinting =
                sprinting && forwardInput > 0 && !sneaking &&
                foodStats.foodLevel > 6 && !inWater;
            if (sprinting && (sneaking || foodStats.foodLevel <= 6 || inWater)) {
                sprinting = false;
            }
            const speed = (inWater ? 3.0 : (isSprinting ? 5.612 : 4.317)) *
                (sneaking ? 0.3 : 1);

            if (inWater) {
                // nq.d(float, float) + ia.a(...) do JAR:
                // aceleração 0,02 bloco/tick², arrasto 0,8/tick.
                // Velocidade terminal: 0,1 bloco/tick = 2 blocos/s.
                const waterDrag = Math.pow(0.8, deltaTime * 20);
                const swimAcceleration = speed * (1 - waterDrag);
                horizontalVelocityX += moveX * swimAcceleration;
                horizontalVelocityZ += moveZ * swimAcceleration;

                const nextX = cameraPosition[0] + horizontalVelocityX * deltaTime;
                if (!collidesAt(nextX, cameraPosition[1], cameraPosition[2])) {
                    cameraPosition[0] = nextX;
                } else {
                    horizontalVelocityX = 0;
                }

                const nextZ = cameraPosition[2] + horizontalVelocityZ * deltaTime;
                if (!collidesAt(cameraPosition[0], cameraPosition[1], nextZ)) {
                    cameraPosition[2] = nextZ;
                } else {
                    horizontalVelocityZ = 0;
                }

                if (isControlDown('jump')) {
                    // Mantém impulso suficiente para alcançar a superfície,
                    // mesmo com o arrasto e a gravidade da água.
                    verticalVelocity = Math.max(
                        verticalVelocity + 24 * deltaTime,
                        4
                    );
                }

                const nextY = cameraPosition[1] + verticalVelocity * deltaTime;
                if (!collidesAt(cameraPosition[0], nextY, cameraPosition[2])) {
                    cameraPosition[1] = nextY;
                } else {
                    verticalVelocity = 0;
                }

                horizontalVelocityX *= waterDrag;
                horizontalVelocityZ *= waterDrag;
                // nq.d(): arrasto 0,8/tick e gravidade de -0,02 bloco/tick².
                // Conversão para blocos/s: -0,4 por tick = -8 por segundo.
                verticalVelocity = verticalVelocity * waterDrag - 8 * deltaTime;
                grounded = false;
            } else if (grounded) {
                // Mantém o embalo ao sair de uma borda e começar a cair.
                horizontalVelocityX = moveX * speed;
                horizontalVelocityZ = moveZ * speed;

                let moveStepX = moveX * speed * deltaTime;
                let moveStepZ = moveZ * speed * deltaTime;

                // Sneak-edge: reduz cada eixo em passos de 0,05 até manter apoio.
                if (sneaking) {
                    while (moveStepX !== 0 &&
                        !hasSneakSupportAt(cameraPosition[0] + moveStepX, cameraPosition[2])) {
                        moveStepX = Math.abs(moveStepX) <= 0.05
                            ? 0
                            : moveStepX - Math.sign(moveStepX) * 0.05;
                    }
                    while (moveStepZ !== 0 &&
                        !hasSneakSupportAt(cameraPosition[0] + moveStepX, cameraPosition[2] + moveStepZ)) {
                        moveStepZ = Math.abs(moveStepZ) <= 0.05
                            ? 0
                            : moveStepZ - Math.sign(moveStepZ) * 0.05;
                    }
                }

                const nextX = cameraPosition[0] + moveStepX;
                const blockedX = collidesAt(nextX, cameraPosition[1], cameraPosition[2]);
                if (!blockedX) cameraPosition[0] = nextX;

                const nextZ = cameraPosition[2] + moveStepZ;
                const blockedZ = collidesAt(cameraPosition[0], cameraPosition[1], nextZ);
                if (!blockedZ) cameraPosition[2] = nextZ;

                // No Minecraft 1.0, bater de frente em um bloco cancela o sprint.
                if (isSprinting && forwardInput > 0 && (blockedX || blockedZ)) {
                    sprinting = false;
                }
            } else {
                // ia.a(...): aceleração aérea de 0,02 por tick.
                const airAcceleration = 0.02 * 20 * deltaTime;
                horizontalVelocityX += moveX * airAcceleration;
                horizontalVelocityZ += moveZ * airAcceleration;

                // nq.d(...): atrito horizontal de 0,91 por tick no ar.
                const airDrag = Math.pow(0.91, deltaTime * 20);
                horizontalVelocityX *= airDrag;
                horizontalVelocityZ *= airDrag;

                const nextX = cameraPosition[0] + horizontalVelocityX * deltaTime;
                if (!collidesAt(nextX, cameraPosition[1], cameraPosition[2])) {
                    cameraPosition[0] = nextX;
                } else {
                    horizontalVelocityX = 0;
                }

                const nextZ = cameraPosition[2] + horizontalVelocityZ * deltaTime;
                if (!collidesAt(cameraPosition[0], cameraPosition[1], nextZ)) {
                    cameraPosition[2] = nextZ;
                } else {
                    horizontalVelocityZ = 0;
                }
            }

            const jumpPressed = isControlDown('jump');

            if (jumpPressed && grounded) {
                const sprintingJump = isSprinting;
                verticalVelocity = 8.5;
                // Preserva a velocidade de corrida no instante da decolagem.
                horizontalVelocityX = moveX * speed;
                horizontalVelocityZ = moveZ * speed;
                if (sprintingJump) {
                    // nq.ak() no JAR: +0,2 blocos/tick na direção do yaw.
                    // O port usa segundos, então 0,2 * 20 = 4 unidades/s.
                    horizontalVelocityX += -Math.sin(yaw) * 4;
                    horizontalVelocityZ += -Math.cos(yaw) * 4;
                }
                grounded = false;
                foodStats.addExhaustion(sprintingJump ? 0.8 : 0.2);
            }

            jumpKeyWasDown = jumpPressed;

            // A água já atualiza a posição vertical no ramo de natação.
            // A gravidade normal só roda fora da água.
            if (!inWater) {
                verticalVelocity = Math.max(
                    verticalVelocity - 24 * deltaTime,
                    -40
                );

                const nextY =
                    cameraPosition[1] + verticalVelocity * deltaTime;

                if (!collidesAt(cameraPosition[0], nextY, cameraPosition[2])) {
                    cameraPosition[1] = nextY;
                    grounded = false;
                } else {
                    grounded = verticalVelocity < 0;
                    verticalVelocity = 0;
                    if (grounded) {
                        horizontalVelocityX = 0;
                        horizontalVelocityZ = 0;
                    }
                }
            }
        }

        inWater = bodyInWater();

        // ia.w() do Minecraft 1.0: enquanto sprinta, emite tilecrack
        // do bloco sob os pés a cada tick de entidade (20 vezes/s).
        if (sprinting && !dead && !flying && !inWater) {
            sprintParticleAccumulator += deltaTime;
            while (sprintParticleAccumulator >= 0.05) {
                sprintParticleAccumulator -= 0.05;
                const feetY = cameraPosition[1] - PLAYER_EYE_HEIGHT;
                const blockX = Math.floor(cameraPosition[0]);
                const blockY = Math.floor(feetY - 0.2);
                const blockZ = Math.floor(cameraPosition[2]);
                const blockId = getWorldBlock(blockX, blockY, blockZ);
                if (blockId > 0) {
                    particleEngine.spawn(
                        `tilecrack_${blockId}`,
                        cameraPosition[0] + (Math.random() - 0.5) * (PLAYER_RADIUS * 2),
                        feetY + 0.1,
                        cameraPosition[2] + (Math.random() - 0.5) * (PLAYER_RADIUS * 2),
                        -horizontalVelocityX * 4,
                        1.5,
                        -horizontalVelocityZ * 4
                    );
                }
            }
        } else {
            sprintParticleAccumulator = 0;
        }

        if (!dead && deltaTime > 0) {
            const dx = cameraPosition[0] - frameStartX;
            const dy = cameraPosition[1] - frameStartY;
            const dz = cameraPosition[2] - frameStartZ;
            const moved3d = Math.hypot(dx, dy, dz);
            const movedHorizontal = Math.hypot(dx, dz);

            // vi.j(): 0.015/m nadando; 0.01/m andando; 0.1/m sprintando.
            if (inWater && moved3d > 0) {
                const centimeters = Math.round(moved3d * 100);
                foodStats.addExhaustion(0.015 * centimeters * 0.01);
            } else if (grounded && movedHorizontal > 0) {
                const isSprinting = sprinting &&
                    isControlDown('forward') &&
                    !isControlDown('sneak') &&
                    foodStats.foodLevel > 6 && !inWater;
                const centimeters = Math.round(movedHorizontal * 100);
                foodStats.addExhaustion((isSprinting ? 0.1 : 0.01) * centimeters * 0.01);
            }

            // A água interrompe e zera a distância de queda acumulada.
            // Sem isso, uma queda anterior à entrada na água pode causar
            // dano depois que o jogador sai dela.
            if (inWater || wasInWater) {
                fallDistance = 0;
            } else {
                // nq.c(float): dano = ceil(distância de queda - 3).
                if (wasGrounded && !grounded) fallDistance = 0;
                if (!grounded) {
                    fallDistance += Math.max(0, frameStartY - cameraPosition[1]);
                }
            }
            if (!wasGrounded && grounded) {
                if (!wasInWater && !inWater) {
                    fallDistance += Math.max(0, frameStartY - cameraPosition[1]);
                    const fallDamage = Math.ceil(fallDistance - 3);
                    if (fallDamage > 0) damagePlayer(fallDamage, 'fall');
                }
                fallDistance = 0;
            }
        }

        // nq.w(): Air starts at 300; water subtracts one per tick and
        // at -20 resets to 0 and applies 2 points of drowning damage.
        survivalTickAccumulator += elapsedTime * 1000;
        while (survivalTickAccumulator >= 50) {
            survivalTickAccumulator -= 50;
            survivalWorldTicks++;
            tickMinecraft10ParticleSources();
            if (hurtTicks > 0) hurtTicks--;

            if (!dead) {
                if (headUnderwater()) {
                    air--;
                    if (air <= -20) {
                        air = 0;
                        damagePlayer(2, 'drown');
                    }
                } else {
                    air = 300;
                }

                foodStats.tick({
                    health,
                    difficulty,
                    heal: healPlayer,
                    damage: damagePlayer
                });

                // vi.c(): peaceful difficulty regenerates one health each second.
                if (difficulty === 0 && health < 20 && survivalWorldTicks % 20 === 0) {
                    healPlayer(1);
                }
            }

            const feet = [
                cameraPosition[0],
                cameraPosition[1] - PLAYER_EYE_HEIGHT,
                cameraPosition[2]
            ];
            let inventoryChanged = false;
            for (const item of itemEntities) {
                const countBefore = item.stack.count;
                item.tick({
                    getBlock: getWorldBlock,
                    inventory,
                    playerFeet: feet,
                    playerRadius: PLAYER_RADIUS,
                    playerHeight: PLAYER_HEIGHT,
                    allowPickup: !dead
                });
                if (item.stack.count !== countBefore) inventoryChanged = true;
            }
            itemEntities = itemEntities.filter(item => !item.dead);
            if (inventoryChanged) updateHotbar();
            updateSurvivalHud();
        }

        if (!flying && now >= nextWaterSplashAt) {
            if (!wasInWater && inWater) {
                const feetY = Math.floor(cameraPosition[1] - PLAYER_EYE_HEIGHT);
                const particleY = feetY + 1;
                for (let i = 0; i < 13; i++) {
                    const px = cameraPosition[0] + (Math.random() * 2 - 1) * 0.6;
                    const pz = cameraPosition[2] + (Math.random() * 2 - 1) * 0.6;
                    particleEngine.spawn(
                        'bubble', px, particleY, pz,
                        horizontalVelocityX,
                        verticalVelocity - Math.random() * 0.2,
                        horizontalVelocityZ
                    );
                    particleEngine.spawn(
                        'splash', px, particleY, pz,
                        horizontalVelocityX, verticalVelocity, horizontalVelocityZ
                    );
                }
                const impactSpeed = Math.abs(previousVerticalVelocity);
                const splashVolume = Math.max(0.25, Math.min(0.9, impactSpeed / 18));
                const hardSplash = impactSpeed >= 8;
                legacyAudio.splash(
                    splashVolume,
                    0.9 + Math.random() * 0.2,
                    hardSplash
                );
                nextWaterSplashAt = now + 650;
            } else if (wasInWater && !inWater) {
                legacyAudio.splash(0.3, 0.95 + Math.random() * 0.2, false);
                nextWaterSplashAt = now + 650;
            }
        }

        if (!flying && !wasGrounded && grounded && !inWater) {
            legacyAudio.land(previousVerticalVelocity);
        }

        const horizontalDistance = Math.hypot(
            cameraPosition[0] - frameStartX,
            cameraPosition[2] - frameStartZ
        );

        const bodyRotation = updatePlayerBodyRotation({
            bodyYaw,
            headYaw: yaw,
            deltaX: cameraPosition[0] - frameStartX,
            deltaZ: cameraPosition[2] - frameStartZ,
            deltaTime: Math.max(deltaTime, 1 / 240)
        });
        bodyYaw = bodyRotation.bodyYaw;

        if (!flying) {
            viewBobWalkDistance += horizontalDistance * 0.6;
        }

        if (deltaTime > 0) {
            limbSwing += horizontalDistance * 4.0;
            const targetWalkAmount = Math.min(
                1,
                (horizontalDistance / deltaTime) / 4.317
            );
            limbSwingAmount += (targetWalkAmount - limbSwingAmount) *
                Math.min(1, deltaTime * 10);

            // vi.c() no JAR 1.0: bG converge 40% por tick para
            // min(0.1, sqrt(motionX² + motionZ²)). O port usa blocos/segundo.
            const horizontalSpeedPerTick = (horizontalDistance / deltaTime) / 20;
            const bobTarget = !flying && grounded && health > 0
                ? Math.min(0.1, horizontalSpeedPerTick)
                : 0;
            // O JAR calcula o balanço vertical usando a velocidade por tick.
            const pitchTarget = !flying && !grounded && health > 0
                ? Math.atan(-(verticalVelocity / 20) * 0.2) * 15
                : 0;
            const bobSmoothing = 1 - Math.pow(0.6, deltaTime * 20);
            const pitchSmoothing = 1 - Math.pow(0.2, deltaTime * 20);
            viewBobAmount += (bobTarget - viewBobAmount) * bobSmoothing;
            viewBobPitch += (pitchTarget - viewBobPitch) * pitchSmoothing;
        }

        if (!flying && grounded) {
            footstepDistance += horizontalDistance;

            if (footstepDistance >= 1.8) {
                footstepDistance %= 1.8;

                const footY = Math.floor(
                    cameraPosition[1] - PLAYER_EYE_HEIGHT - 0.05
                );

                const blockId = getWorldBlock(
                    Math.floor(cameraPosition[0]),
                    footY,
                    Math.floor(cameraPosition[2])
                );

                if (!inWater) {
                legacyAudio.step(blockId);
            }
            }
        } else if (flying) {
            footstepDistance = 0;
        }

        updateChunks();

        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const ratio = window.devicePixelRatio || 1;

        if (
            canvas.width !== Math.round(width * ratio) ||
            canvas.height !== Math.round(height * ratio)
        ) {
            canvas.width = Math.round(width * ratio);
            canvas.height = Math.round(height * ratio);
        }

        const playerWaterBlock = getWorldBlock(
            Math.floor(cameraPosition[0]),
            Math.floor(cameraPosition[1]),
            Math.floor(cameraPosition[2])
        );
        const playerUnderwater = playerWaterBlock === 8 || playerWaterBlock === 9;
        legacyAudio.setUnderwater(playerUnderwater);

        let eye = cameraPosition;
        let target = [
            eye[0] + forwardX,
            eye[1] + forwardY,
            eye[2] + forwardZ
        ];

        if (cameraMode !== 0) {
            const side = cameraMode === 1 ? -1 : 1;
            let distance = 4.0;

            // Aproximar a câmera da entidade quando houver um bloco sólido atrás/à frente.
            for (let sample = 0.25; sample <= 4.0; sample += 0.25) {
                const testX = cameraPosition[0] + forwardX * side * sample;
                const testY = cameraPosition[1] + forwardY * side * sample;
                const testZ = cameraPosition[2] + forwardZ * side * sample;
                const block = getWorldBlock(
                    Math.floor(testX),
                    Math.floor(testY),
                    Math.floor(testZ)
                );

                if (block === null || (block !== 0 && block !== 8 && block !== 9)) {
                    distance = Math.max(0.25, sample - 0.25);
                    break;
                }
            }

            eye = [
                cameraPosition[0] + forwardX * side * distance,
                cameraPosition[1] + forwardY * side * distance,
                cameraPosition[2] + forwardZ * side * distance
            ];
            target = [...cameraPosition];
        }

        const viewWaterBlock = getWorldBlock(
            Math.floor(eye[0]),
            Math.floor(eye[1]),
            Math.floor(eye[2])
        );
        const underwater = viewWaterBlock === 8 || viewWaterBlock === 9;

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(
            underwater ? 0.015 : 0.45,
            underwater ? 0.08 : 0.68,
            underwater ? 0.16 : 0.9,
            1
        );
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const projection = perspective(
            fieldOfView * Math.PI / 180,
            canvas.width / canvas.height,
            0.1,
            100
        );

        const viewBobbingMatrix = viewBobbing
            ? createViewBobbingMatrix(viewBobWalkDistance, viewBobAmount, viewBobPitch)
            : identityModel;
        const view = multiply(
            viewBobbingMatrix,
            lookAt(eye, target, [0, 1, 0])
        );
        const mvp = multiply(projection, view);

        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.uniformMatrix4fv(mvpLocation, false, mvp);
        gl.uniformMatrix4fv(modelLocation, false, identityModel);
        gl.uniform1f(alphaTestLocation, 0.0);
        gl.uniform1f(underwaterLocation, underwater ? 1.0 : 0.0);
        gl.uniform3f(
            cameraPositionLocation,
            eye[0],
            eye[1],
            eye[2]
        );

        const terrainWorkStartedAt = performance.now();
        if (renderEntriesDirty) {
            renderEntriesCache = [...loadedChunks.values()];
            renderEntriesDirty = false;
            waterSortCenterX = NaN;
            waterSortCenterZ = NaN;
        }
        const entries = renderEntriesCache;
        // Cone horizontal conservador: descarta chunks atrás da câmera ou
        // claramente fora do FOV antes de emitir chamadas WebGL.
        const viewDX = target[0] - eye[0];
        const viewDZ = target[2] - eye[2];
        const viewLength = Math.hypot(viewDX, viewDZ) || 1;
        const cullForwardX = viewDX / viewLength;
        const cullForwardZ = viewDZ / viewLength;
        const halfFov = Math.atan(Math.tan(fieldOfView * Math.PI / 360) * (canvas.width / canvas.height));
        const viewSpread = Math.tan(halfFov);
        const chunkCullRadius = 19.32;
        const visibleEntries = visibleRenderEntries;
        visibleEntries.length = 0;
        for (const entry of entries) {
            if (!entry.gpu) continue;
            const dx = entry.chunkX * 16 + 8 - eye[0];
            const dz = entry.chunkZ * 16 + 8 - eye[2];
            const forward = dx * cullForwardX + dz * cullForwardZ;
            if (forward < -chunkCullRadius) continue;
            const lateral = dx * -cullForwardZ + dz * cullForwardX;
            const lateralLimit = Math.max(0, forward) * viewSpread + chunkCullRadius;
            if (lateral * lateral <= lateralLimit * lateralLimit) {
                visibleEntries.push(entry);
            }
        }

        // A lista visível é calculada uma vez e reutilizada nas passagens
        // opaca e transparente, evitando testar todos os chunks duas vezes.

        // Terreno sólido e folhas com recorte alpha do atlas original.
        gl.disable(gl.BLEND);
        gl.depthMask(true);
        gl.uniform1f(alphaTestLocation, 1.0);
        gl.uniform1f(alphaMultiplierLocation, 1.0);

        for (const entry of visibleEntries) {
            gl.bindVertexArray(entry.gpu.solid.vao);

            gl.uniform3f(
                offsetLocation,
                entry.chunkX * 16,
                0,
                entry.chunkZ * 16
            );

            gl.drawElements(
                gl.TRIANGLES,
                entry.gpu.solid.indexCount,
                gl.UNSIGNED_INT,
                0
            );
        }

        // EntityItem (ih): itens no chão, com gravidade e pickup delay.
        if (itemEntities.length) {
            gl.useProgram(program);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.disable(gl.BLEND);
            gl.enable(gl.DEPTH_TEST);
            gl.depthMask(true);
            gl.enable(gl.CULL_FACE);
            gl.uniformMatrix4fv(mvpLocation, false, mvp);
            gl.uniformMatrix4fv(modelLocation, false, identityModel);
            gl.uniform1f(alphaTestLocation, 0.0);
            gl.uniform1f(alphaMultiplierLocation, 1.0);
            gl.uniform1f(underwaterLocation, underwater ? 1.0 : 0.0);

            for (const item of itemEntities) {
                const gpu = getDroppedItemGpu(item.stack.id, item.stack.damage ?? 0);
                if (!gpu) continue;
                const c = Math.cos(item.spin);
                const sn = Math.sin(item.spin);
                // iw.a(...) do JAR aplica escala 0.25 ao cubo depois
                // da rotação. A geometria fica unitária para preservar o UV.
                const itemScale = 0.25;
                const rotation = new Float32Array([
                    c * itemScale, 0, -sn * itemScale, 0,
                    0, itemScale, 0, 0,
                    sn * itemScale, 0, c * itemScale, 0,
                    0, 0, 0, 1
                ]);
                gl.uniformMatrix4fv(modelLocation, false, rotation);
                gl.uniform3f(
                    offsetLocation,
                    item.x,
                    item.y + 0.125 + Math.sin(item.spin * 2) * 0.025,
                    item.z
                );
                gl.bindVertexArray(gpu.vao);
                gl.drawElements(
                    gl.TRIANGLES,
                    gpu.indexCount,
                    gl.UNSIGNED_SHORT,
                    0
                );
            }
            gl.bindVertexArray(null);
            gl.uniformMatrix4fv(modelLocation, false, identityModel);
            gl.uniform3f(offsetLocation, 0, 0, 0);
        }

        // Steve: desenhar apenas em terceira pessoa, entre sólidos e água.
        if (cameraMode !== 0) {
            gl.useProgram(program);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, steveSkinTexture);
            gl.disable(gl.BLEND);
            gl.depthMask(true);
            gl.disable(gl.CULL_FACE);
            gl.uniform3f(offsetLocation, 0, 0, 0);
            gl.uniform1f(alphaMultiplierLocation, 1.0);
            gl.uniform1f(alphaTestLocation, 1.0);

            const steveMatrices = createStevePartMatrices({
                feet: [
                    cameraPosition[0],
                    cameraPosition[1] - PLAYER_EYE_HEIGHT,
                    cameraPosition[2]
                ],
                // A rotação raiz ocorre antes do espelhamento do modelo;
                // por isso o tronco usa o yaw direto. A cabeça gira localmente
                // depois do espelhamento e precisa do sinal inverso.
                yaw: bodyYaw,
                headYaw: -bodyRotation.headYaw,
                walkPhase: limbSwing,
                walkAmount: limbSwingAmount,
                ageTicks: now * 0.02,
                swingProgress: armSwingProgress,
                headPitch: pitch,
                sneaking: !flying && (
                    isControlDown('sneak')
                )
            });

            for (const partName of STEVE_PART_ORDER) {
                const gpu = steveGpuParts[partName];
                const model = steveMatrices[partName];
                gl.bindVertexArray(gpu.vao);
                gl.uniformMatrix4fv(modelLocation, false, model);
                gl.drawElements(
                    gl.TRIANGLES,
                    gpu.indexCount,
                    gl.UNSIGNED_SHORT,
                    0
                );
            }

            const heldThirdPerson = inventory.getCurrentItem();
            if (heldThirdPerson && heldThirdPerson.count > 0) {
                drawHeldBlock(
                    heldThirdPerson.id,
                    mvp,
                    createThirdPersonHeldBlockMatrix(steveMatrices.rightArm),
                    underwater,
                    eye
                );
            }

            gl.bindVertexArray(null);
            gl.enable(gl.CULL_FACE);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniformMatrix4fv(modelLocation, false, identityModel);
            gl.uniform1f(alphaTestLocation, 0.0);
        }

        // A ordem da água só muda ao entrar em outro chunk; evita ordenar
        // centenas de entradas em todos os frames.
        const sortCenterX = Math.floor(cameraPosition[0] / 16);
        const sortCenterZ = Math.floor(cameraPosition[2] / 16);
        if (sortCenterX !== waterSortCenterX || sortCenterZ !== waterSortCenterZ) {
            const compareWaterDistance = (a, b) => {
                const ax = a.chunkX - sortCenterX;
                const az = a.chunkZ - sortCenterZ;
                const bx = b.chunkX - sortCenterX;
                const bz = b.chunkZ - sortCenterZ;
                return (bx * bx + bz * bz) - (ax * ax + az * az);
            };
            entries.sort(compareWaterDistance);
            visibleEntries.sort(compareWaterDistance);
            waterSortCenterX = sortCenterX;
            waterSortCenterZ = sortCenterZ;
        }

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.uniformMatrix4fv(modelLocation, false, identityModel);
        gl.uniform1f(alphaTestLocation, 0.0);
        gl.uniform1f(alphaMultiplierLocation, 1.0);

        for (const entry of visibleEntries) {
            if (entry.gpu.water.indexCount === 0) continue;

            gl.bindVertexArray(entry.gpu.water.vao);

            gl.uniform3f(
                offsetLocation,
                entry.chunkX * 16,
                0,
                entry.chunkZ * 16
            );

            gl.drawElements(
                gl.TRIANGLES,
                entry.gpu.water.indexCount,
                gl.UNSIGNED_INT,
                0
            );
        }

        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.bindVertexArray(null);

        debugTerrainMs = performance.now() - terrainWorkStartedAt;

        // EffectRenderer (f.java): camadas 0..3, cada uma usando o atlas do JAR.
        const particleWorkStartedAt = performance.now();
        const particleMeshes = particleEngine.buildMeshes(
            musicTickAccumulator / MINE_TICK_MS, yaw, pitch
        );

        function drawParticleMesh(gpu, mesh, atlas) {
            if (!mesh.indices.length) return;
            const [positionsBuffer, uvBuffer, normalBuffer, colorBuffer, alphaBuffer, indexBuffer] = gpu.buffers;
            gl.bindBuffer(gl.ARRAY_BUFFER, positionsBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.positions);
            gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.uvs);
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.normals);
            gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.colors);
            gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.alphas);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, mesh.indices);
            gl.useProgram(program);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, atlas);
            gl.uniformMatrix4fv(mvpLocation, false, mvp);
            gl.uniformMatrix4fv(modelLocation, false, identityModel);
            gl.uniform3f(offsetLocation, 0, 0, 0);
            gl.uniform3f(cameraPositionLocation, eye[0], eye[1], eye[2]);
            gl.uniform1f(handLightingLocation, 0.0);
            gl.uniform1f(handLightLocation, 1.0);
            gl.uniform1f(applyLightmapLocation, 0.0);
            gl.uniform1f(alphaTestLocation, 0.0);
            gl.uniform1f(alphaMultiplierLocation, 1.0);
            gl.uniform1f(underwaterLocation, underwater ? 1.0 : 0.0);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.depthMask(false);
            gl.disable(gl.CULL_FACE);
            gl.bindVertexArray(gpu.vao);
            gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
            gl.bindVertexArray(null);
            gl.depthMask(true);
            gl.disable(gl.BLEND);
            gl.enable(gl.CULL_FACE);
        }

        const particleAtlases = [
            particlesTexture,
            texture,
            itemsParticleTexture,
            footprintTexture
        ];
        for (let layer = 0; layer < 4; layer++) {
            drawParticleMesh(particleGpuLayers[layer], particleMeshes.layers[layer], particleAtlases[layer]);
            if (layer === 0) {
                drawParticleMesh(particleExplosionGpu, particleMeshes.explosions, explosionTexture);
            }
        }
        gl.uniform1f(applyLightmapLocation, 1.0);
        debugParticlesMs = performance.now() - particleWorkStartedAt;

        // Crack overlay: Minecraft 1.0 damage stages 0..9 (terrain tiles 240..249).
        if (miningTarget && miningStage >= 0) {
            const crackGpu = breakStageGpu[miningStage];
            gl.useProgram(program);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniformMatrix4fv(mvpLocation, false, mvp);
            gl.uniformMatrix4fv(modelLocation, false, identityModel);
            gl.uniform3f(offsetLocation, miningTarget.x, miningTarget.y, miningTarget.z);
            gl.uniform1f(alphaMultiplierLocation, 0.92);
            gl.uniform1f(alphaTestLocation, 1.0);
            gl.uniform1f(underwaterLocation, underwater ? 1.0 : 0.0);
            gl.disable(gl.CULL_FACE);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.depthMask(false);
            gl.bindVertexArray(crackGpu.vao);
            gl.drawElements(
                gl.TRIANGLES,
                crackGpu.indexCount,
                gl.UNSIGNED_SHORT,
                0
            );
            gl.depthMask(true);
            gl.disable(gl.BLEND);
            gl.enable(gl.CULL_FACE);
            gl.bindVertexArray(null);
            gl.uniform1f(alphaMultiplierLocation, 1.0);
            gl.uniform1f(alphaTestLocation, 0.0);
        }

        // Contorno do bloco selecionado pela mira.
        const aimedBlock = raycastBlock(6);

        if (aimedBlock && aimedBlock.blockId !== 9) {
            gl.useProgram(outlineProgram);
            gl.bindVertexArray(outlineVao);

            gl.uniformMatrix4fv(outlineMvpLocation, false, mvp);
            gl.uniform3f(
                outlineOffsetLocation,
                aimedBlock.x,
                aimedBlock.y,
                aimedBlock.z
            );
            gl.uniform4f(outlineColorLocation, 0.02, 0.02, 0.02, 1.0);

            gl.depthMask(false);
            gl.drawElements(gl.LINES, 24, gl.UNSIGNED_SHORT, 0);
            gl.depthMask(true);

            gl.bindVertexArray(null);
            gl.useProgram(program);
        }

        // Mão direita do Steve em primeira pessoa, desenhada em espaço de câmera.
        if (cameraMode === 0) {
            const armModel = createSteveFirstPersonArmMatrix({
                swingProgress: armSwingProgress,
                ageTicks: now * 0.02
            });

            gl.useProgram(program);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, steveSkinTexture);
            // A mão usa FOV 70° como no Minecraft 1.0; com 60° ela sai quase toda da tela.
            const handProjection = perspective(
                70 * Math.PI / 180,
                canvas.width / canvas.height,
                0.05,
                100
            );
            // n.a(float) no JAR: a mão acompanha 10% da diferença de
        // orientação da câmera, mesmo quando o jogador está parado.
        const handLookMatrix = [
            rotationXMatrix(handLookDeltaPitch * 0.1),
            rotationYMatrix(handLookDeltaYaw * 0.1)
        ].reduce((matrix, transform) => multiply(matrix, transform));
        handLookDeltaYaw = 0;
        handLookDeltaPitch = 0;
        const handViewMatrix = multiply(viewBobbingMatrix, handLookMatrix);
        const handMvp = multiply(handProjection, handViewMatrix);
            gl.uniformMatrix4fv(mvpLocation, false, handMvp);
            gl.uniformMatrix4fv(modelLocation, false, armModel);
            gl.uniform3f(offsetLocation, 0, 0, 0);
            gl.uniform1f(alphaMultiplierLocation, 1.0);
            gl.uniform1f(alphaTestLocation, 1.0);
            gl.uniform1f(underwaterLocation, 0.0);
            gl.uniform1f(handLightingLocation, 1.0);
            const handLight = getFirstPersonLightLevels();
            // O lightmap do JAR usa X=block light e Y=sky light.
            gl.uniform2f(
                handLightUvLocation,
                (handLight.block + 0.5) / 16,
                (handLight.sky + 0.5) / 16
            );
            // RenderHelper.enableStandardItemLighting() do Minecraft 1.0
            // usa iluminação fixa de duas direções, independente da luz do mundo.
            gl.uniform1f(handLightLocation, 1.0);
            // Depth limpo e ligado: sem isso as faces do braço se sobrepõem fora de ordem.
            gl.disable(gl.CULL_FACE);
            gl.disable(gl.BLEND);
            gl.clear(gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST);
            gl.depthMask(true);

            const heldFirstPerson = renderedHeldItem;
            const hasHeldBlock = heldFirstPerson && heldFirstPerson.count > 0;

            // No Minecraft 1.0, o braço só aparece com a mão vazia.
            if (!hasHeldBlock) {
                const armGpu = steveGpuParts.rightArm;
                gl.bindVertexArray(armGpu.vao);
                gl.drawElements(
                    gl.TRIANGLES,
                    armGpu.indexCount,
                    gl.UNSIGNED_SHORT,
                    0
                );
            } else {
                drawHeldBlock(
                    heldFirstPerson.id,
                    handMvp,
                    createHeldBlockMatrix(armSwingProgress, equippedProgress),
                    false,
                    [0, 0, 0],
                    heldFirstPerson.damage ?? 0
                );
            }

            gl.depthMask(true);
            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.CULL_FACE);
            gl.bindVertexArray(null);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniformMatrix4fv(mvpLocation, false, mvp);
            gl.uniformMatrix4fv(modelLocation, false, identityModel);
            gl.uniform1f(alphaTestLocation, 0.0);
            gl.uniform1f(underwaterLocation, underwater ? 1.0 : 0.0);
            gl.uniform1f(handLightingLocation, 0.0);
            gl.uniform1f(handLightLocation, 1.0);
        }

        if (gpuTimerExtension && debugInfo && activeGpuTimerQuery) {
            gl.endQuery(gpuTimerExtension.TIME_ELAPSED_EXT);
            gpuTimerQueries.push(activeGpuTimerQuery);
            activeGpuTimerQuery = null;
            while (gpuTimerQueries.length > 8) {
                gl.deleteQuery(gpuTimerQueries.shift());
            }
        }

        debugFrameTimeMs = elapsedTime * 1000;
        debugWorkTimeMs = performance.now() - frameWorkStartedAt;
        if (now - debugSpikeWindowAt >= 1000) {
            debugFrameSpikes = 0;
            debugSpikeWindowAt = now;
        }
        if (debugFrameTimeMs >= 25) debugFrameSpikes++;
        if (debugInfo) {
            debugProfRoot += Math.max(debugFrameTimeMs, debugWorkTimeMs);
            debugProfTick += debugFrameTickMs;
            debugProfSound += debugFrameSoundMs;
            debugProfLight += debugFrameLightMs;
            debugProfRender += Math.max(0, debugWorkTimeMs - debugFrameTickMs - debugFrameSoundMs - debugFrameLightMs);
            // Uma amostra por tick de 50 ms: o pior tempo de CPU de frame dentro da janela.
            debugTickWindowMax = Math.max(debugTickWindowMax, debugWorkTimeMs);
            if (now - debugTickWindowAt >= MINE_TICK_MS) {
                debugTickSamples[debugTickCursor] = debugTickWindowMax;
                debugTickCursor = (debugTickCursor + 1) % 512;
                debugTickFilled = Math.min(512, debugTickFilled + 1);
                debugTickWindowMax = 0;
                debugTickWindowAt = now;
            }
        }

        updateDebugOverlay(now);
        requestAnimationFrame(render);
    }

    console.log('Minecraft 1.0 Browser iniciado em Survival (dificuldade normal).');
    updateHotbar();
    updateSurvivalHud();
    render();
}

openWorldMenu().then(selected => {
    window.__mc10SelectedWorld = selected;
    main().catch(error => {
    console.error(error);
    document.body.innerHTML =
        `<pre style="color:white;padding:20px">${error.stack}</pre>`;
    });
}).catch(error => console.error('Menu de mundos:', error));
