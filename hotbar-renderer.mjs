import { buildBlockMesh } from './mine-mesher.mjs';

// Tiles used by the block items present in the Minecraft 1.0 browser project.
// Order follows yy.a(side, meta): bottom, top, north(-Z), south(+Z), west(-X), east(+X).
const TEXTURES = {
    1: [1, 1, 1, 1, 1, 1],
    2: [2, 0, 3, 3, 3, 3],
    3: [2, 2, 2, 2, 2, 2],
    4: [16, 16, 16, 16, 16, 16],
    7: [17, 17, 17, 17, 17, 17],
    12: [18, 18, 18, 18, 18, 18],
    13: [19, 19, 19, 19, 19, 19],
    17: [21, 21, 20, 20, 20, 20],
    18: [52, 52, 52, 52, 52, 52],
    24: [208, 176, 192, 192, 192, 192],
    79: [67, 67, 67, 67, 67, 67],
    110: [2, 78, 77, 77, 77, 77]
};

const GRASS_BLOCK_ID = 2; // yy.u (jb): only the top face is tinted in the inventory.

// ---------------------------------------------------------------------------
// Fixed-function OpenGL chain of the Minecraft 1.0 jar, reproduced literally.
//
//   iw.a(abe, zh, itemId, meta, icon, x, y)       (RenderItem, block branch)
//     glTranslatef(x - 2, y + 3, -3 + zLevel);
//     glScalef(10, 10, 10);
//     glTranslatef(1, 0.5, 1);
//     glScalef(1, 1, -1);
//     glRotatef(210, 1, 0, 0);
//     glRotatef(45, 0, 1, 0);
//     glRotatef(-90, 0, 1, 0);
//   acr.a(yy, meta, 1.0F)                          (RenderBlocks.renderBlockAsItem)
//     glTranslatef(-0.5, -0.5, -0.5); six quads, no per-vertex colour, glColor:
//     bottom = block colour (white for grass), top = block colour (grass: ha.a(0.5, 1.0)),
//     sides = white.
//
//   qd.a / mg.a (hotbar / container screens):
//     glDisable(GL_BLEND); glEnable(GL_RESCALE_NORMAL); rt.c();
//   rt.c() = push; glRotatef(-30, 0,1,0); glRotatef(165, 1,0,0); rt.b(); pop
//   rt.b(): GL_LIGHTING, GL_LIGHT0/1, GL_COLOR_MATERIAL(AMBIENT_AND_DIFFUSE),
//     light0 pos = normalize( 0.2, 1, -0.7), light1 pos = normalize(-0.2, 1,  0.7), w = 0,
//     diffuse 0.6, ambient 0, specular 0, GL_FLAT, GL_LIGHT_MODEL_AMBIENT 0.4.
//   Projection (GuiIngame): glOrtho(0, W, H, 0, 1000, 3000); glTranslatef(0, 0, -2000).
// ---------------------------------------------------------------------------

const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply(a, b) {
    const out = new Array(16).fill(0);
    for (let column = 0; column < 4; column++) {
        for (let row = 0; row < 4; row++) {
            let sum = 0;
            for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[column * 4 + k];
            out[column * 4 + row] = sum;
        }
    }
    return out;
}

function translate(x, y, z) {
    const m = identity();
    m[12] = x; m[13] = y; m[14] = z;
    return m;
}

function scale(x, y, z) {
    const m = identity();
    m[0] = x; m[5] = y; m[10] = z;
    return m;
}

// glRotatef(angle, x, y, z)
function rotate(degrees, x, y, z) {
    const angle = degrees * Math.PI / 180;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const length = Math.hypot(x, y, z);
    x /= length; y /= length; z /= length;
    return [
        x * x * (1 - c) + c, y * x * (1 - c) + z * s, x * z * (1 - c) - y * s, 0,
        x * y * (1 - c) - z * s, y * y * (1 - c) + c, y * z * (1 - c) + x * s, 0,
        x * z * (1 - c) + y * s, y * z * (1 - c) - x * s, z * z * (1 - c) + c, 0,
        0, 0, 0, 1
    ];
}

// glOrtho(left, right, bottom, top, near, far)
function ortho(left, right, bottom, top, near, far) {
    return [
        2 / (right - left), 0, 0, 0,
        0, 2 / (top - bottom), 0, 0,
        0, 0, -2 / (far - near), 0,
        -(right + left) / (right - left),
        -(top + bottom) / (top - bottom),
        -(far + near) / (far - near),
        1
    ];
}

function transformDirection(matrix, v) {
    return [0, 1, 2].map(row =>
        matrix[row] * v[0] + matrix[4 + row] * v[1] + matrix[8 + row] * v[2]
    );
}

function normalize(v) {
    const length = Math.hypot(v[0], v[1], v[2]);
    return v.map(value => value / length);
}

const toFloat = Math.fround;

// rt.b(): fb.b(x, y, z).c() normalises in double, rt.a(DDDD) then narrows to float.
const LIGHT_DIRECTIONS = [
    normalize([0.20000000298023224, 1, -0.699999988079071]).map(toFloat),
    normalize([-0.20000000298023224, 1, 0.699999988079071]).map(toFloat)
];

// rt.c(): the lights are stored in eye space under this rotation.
const LIGHT_MATRIX = multiply(rotate(-30, 0, 1, 0), rotate(165, 1, 0, 0));
const EYE_LIGHTS = LIGHT_DIRECTIONS.map(direction =>
    normalize(transformDirection(LIGHT_MATRIX, direction))
);

const LIGHT_DIFFUSE = 0.6;
const LIGHT_MODEL_AMBIENT = 0.4;

// Rotation/reflection part of iw.a's modelview. Normals use its inverse transpose,
// which for rotations and the (1, 1, -1) mirror is the same matrix; GL_RESCALE_NORMAL
// removes the uniform 10x scale.
const ITEM_NORMAL_MATRIX = [
    scale(1, 1, -1),
    rotate(210, 1, 0, 0),
    rotate(45, 0, 1, 0),
    rotate(-90, 0, 1, 0)
].reduce(multiply);

/** Fixed-function lighting of one face, flat shaded, material colour white. */
export function faceShade(normal) {
    const eyeNormal = normalize(transformDirection(ITEM_NORMAL_MATRIX, normal));
    let sum = 0;

    for (const light of EYE_LIGHTS) {
        const dot = eyeNormal[0] * light[0] + eyeNormal[1] * light[1] + eyeNormal[2] * light[2];
        sum += Math.max(0, dot) * LIGHT_DIFFUSE;
    }

    return Math.min(1, LIGHT_MODEL_AMBIENT + sum);
}

// Colour stored in an 8-bit colour buffer, as OpenGL does after lighting.
const quantize = value => Math.round(Math.min(1, Math.max(0, value)) * 255) / 255;

function isTopFace(normalX, normalY, normalZ) {
    return normalY > 0.5 && Math.abs(normalX) < 0.5 && Math.abs(normalZ) < 0.5;
}

/** Per-vertex colour = glColor (tint) x GL lighting of the face normal. */
function buildFaceColors(mesh, blockId, grassColor) {
    const colors = new Float32Array(mesh.vertexCount * 3);
    const tint = [
        ((grassColor >> 16) & 255) / 255,
        ((grassColor >> 8) & 255) / 255,
        (grassColor & 255) / 255
    ];

    for (let vertex = 0; vertex < mesh.vertexCount; vertex++) {
        const nx = mesh.normals[vertex * 3];
        const ny = mesh.normals[vertex * 3 + 1];
        const nz = mesh.normals[vertex * 3 + 2];
        const shade = faceShade([nx, ny, nz]);
        const material = blockId === GRASS_BLOCK_ID && isTopFace(nx, ny, nz)
            ? tint
            : [1, 1, 1];

        for (let channel = 0; channel < 3; channel++) {
            colors[vertex * 3 + channel] = quantize(material[channel] * shade);
        }
    }

    return colors;
}

/** iw.a: translate(x - 2, y + 3, -3 + zLevel) ... rotate(-90, 0, 1, 0); cube corners in [0, 1]. */
export function itemModelView(x, y, zLevel = 0) {
    return [
        translate(x - 2, y + 3, -3 + zLevel),
        scale(10, 10, 10),
        translate(1, 0.5, 1),
        scale(1, 1, -1),
        rotate(210, 1, 0, 0),
        rotate(45, 0, 1, 0),
        rotate(-90, 0, 1, 0),
        translate(-0.5, -0.5, -0.5)
    ].reduce(multiply);
}

/** GL light directions in eye space after rt.c(). */
export const EYE_LIGHT_DIRECTIONS = EYE_LIGHTS;

const VS = `#version 300 es
in vec3 a_position;
in vec2 a_uv;
in vec3 a_color;
uniform mat4 u_mvp;
uniform vec3 u_offset;
out vec2 v_uv;
out vec3 v_color;
void main() {
    gl_Position = u_mvp * vec4(a_position + u_offset, 1.0);
    v_uv = a_uv;
    v_color = a_color;
}`;

// GL_MODULATE: texture x lit colour. Blending is off in the jar (qd/mg disable it) and
// the alpha test only discards cut-out texels, so every kept texel is opaque.
const FS = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec3 v_color;
uniform sampler2D u_texture;
out vec4 outColor;
void main() {
    vec4 texel = texture(u_texture, v_uv);
    if (texel.a <= 0.1) discard;
    outColor = vec4(texel.rgb * v_color, 1.0);
}`;

function shader(gl, type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(result));
    }
    return result;
}

function makeProgram(gl) {
    const result = gl.createProgram();
    gl.attachShader(result, shader(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(result, shader(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(result);
    if (!gl.getProgramParameter(result, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(result));
    }
    return result;
}

function makeMesh(gl, program, mesh) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffers = [];

    const attributes = [
        ['a_position', mesh.positions, 3],
        ['a_uv', mesh.uvs, 2],
        ['a_color', mesh.colors, 3]
    ];

    for (const [name, data, size] of attributes) {
        const location = gl.getAttribLocation(program, name);
        const buffer = gl.createBuffer();
        buffers.push(buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    }

    const indexBuffer = gl.createBuffer();
    buffers.push(indexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: mesh.indices.length, buffers };
}

/**
 * WebGL item renderer used by the hotbar and by the 176x166 inventory panel.
 * Coordinates passed to renderItems are CSS pixels from the panel's top-left,
 * exactly the (x, y) the jar hands to iw.a(...).
 *
 * options.grassColor: 0xRRGGBB of the grass top in inventories, ha.a(0.5, 1.0) in the jar
 * (grasscolor.png pixel 127,127). Without it the grass top stays untinted.
 * The `math` argument is kept for compatibility; the jar's matrices are built here.
 */
export function createHotbarRenderer(
    canvas,
    spec,
    image,
    math,
    dimensions = {}
) {
    const logicalWidth = dimensions.width ?? 182;
    const logicalHeight = dimensions.height ?? 22;
    const grassColor = dimensions.grassColor ?? 0xffffff;
    const gl = canvas.getContext('webgl2', {
        alpha: true,
        antialias: false,
        depth: true,
        premultipliedAlpha: false
    });

    if (!gl) throw new Error('WebGL 2 indisponível para os ícones de inventário.');

    const hudScale = Math.max(
        1,
        Math.min(4, Math.floor(
            Math.min(window.innerWidth / 320, window.innerHeight / 240)
        ))
    );
    const ratio = (window.devicePixelRatio || 1) * hudScale;
    canvas.width = Math.round(logicalWidth * ratio);
    canvas.height = Math.round(logicalHeight * ratio);
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;

    const program = makeProgram(gl);
    gl.useProgram(program);

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);

    // GuiIngame: glOrtho(0, W, H, 0, 1000, 3000); glTranslatef(0, 0, -2000).
    const guiMatrix = multiply(
        ortho(0, logicalWidth, logicalHeight, 0, 1000, 3000),
        translate(0, 0, -2000)
    );
    const mvpLocation = gl.getUniformLocation(program, 'u_mvp');
    const offsetLocation = gl.getUniformLocation(program, 'u_offset');

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);

    const bounds = {
        minX: 0, maxX: 1,
        minY: 0, maxY: 1,
        minZ: 0, maxZ: 1
    };
    const meshCache = new Map();

    function getGpu(blockId, metadata = 0) {
        if (!TEXTURES[blockId]) return null;
        const variant = blockId === 17 && (metadata & 3) === 2 ? 2 : 0;
        const cacheKey = variant ? String(blockId) + ':' + variant : String(blockId);
        if (meshCache.has(cacheKey)) return meshCache.get(cacheKey);
        const textureIndex = blockId === 17 && variant
            ? [21, 21, 117, 117, 117, 117]
            : TEXTURES[blockId];
        const mesh = buildBlockMesh(spec, {
            bounds,
            textureIndex
        });
        mesh.colors = buildFaceColors(mesh, blockId, grassColor);
        const gpu = makeMesh(gl, program, mesh);
        meshCache.set(cacheKey, gpu);
        return gpu;
    }

    function renderItems(items = []) {
        gl.useProgram(program);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // acr.a's glTranslatef(-0.5, -0.5, -0.5) is already inside itemModelView.
        gl.uniform3f(offsetLocation, 0, 0, 0);

        for (const item of items) {
            const id = Number(item.id ?? 0);
            if (!id) continue;
            const gpu = getGpu(id, Number(item.metadata ?? item.damage ?? 0));
            if (!gpu) continue;

            const modelView = itemModelView(item.x ?? 0, item.y ?? 0, item.z ?? 0);
            gl.uniformMatrix4fv(mvpLocation, false, multiply(guiMatrix, modelView));
            // Later items are drawn on top, like the jar's increasing zLevel.
            gl.clear(gl.DEPTH_BUFFER_BIT);
            gl.bindVertexArray(gpu.vao);
            gl.drawElements(gl.TRIANGLES, gpu.count, gl.UNSIGNED_SHORT, 0);
        }

        gl.bindVertexArray(null);
    }

    function renderSlots(slotIds = []) {
        renderItems(slotIds.slice(0, 9).map((item, slot) => ({
            ...(typeof item === 'object' && item !== null ? item : { id: item }),
            x: 3 + slot * 20,
            y: 3
        })));
    }

    renderSlots.renderItems = renderItems;
    renderSlots.destroy = () => {
        for (const gpu of meshCache.values()) {
            gl.deleteVertexArray(gpu.vao);
            for (const buffer of gpu.buffers) gl.deleteBuffer(buffer);
        }
        gl.deleteTexture(texture);
        gl.deleteProgram(program);
    };

    renderSlots([]);
    return renderSlots;
}
