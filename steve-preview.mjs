import {
    createSteveMeshes,
    createStevePartMatrices,
    STEVE_PART_ORDER
} from './steve.mjs';

const VERTEX_SHADER = `#version 300 es
in vec3 a_position;
in vec2 a_uv;
uniform mat4 u_mvp;
uniform mat4 u_model;
out vec2 v_uv;
void main() {
    gl_Position = u_mvp * u_model * vec4(a_position, 1.0);
    v_uv = a_uv;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_skin;
out vec4 outColor;
void main() {
    vec4 texel = texture(u_skin, v_uv);
    if (texel.a < 0.1) discard;
    outColor = texel;
}`;

function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
}

function createProgram(gl) {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
    }
    return program;
}

function createGpuPart(gl, program, mesh) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffers = [];

    const attributes = [
        ['a_position', mesh.positions, 3],
        ['a_uv', mesh.uvs, 2]
    ];

    for (const [name, data, size] of attributes) {
        const buffer = gl.createBuffer();
        buffers.push(buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        const location = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    }

    const indexBuffer = gl.createBuffer();
    buffers.push(indexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    return { vao, indexCount: mesh.indices.length, buffers };
}

/**
 * Renderiza o Steve do próprio steve.mjs em um canvas independente,
 * como o preview de personagem da tela hw.java.
 */
export function createSteveInventoryPreview(canvas, skinImage, math) {
    const gl = canvas.getContext('webgl2', {
        alpha: true,
        antialias: false,
        premultipliedAlpha: false,
        depth: true
    });
    if (!gl) throw new Error('WebGL 2 indisponível para o preview do Steve.');

    const program = createProgram(gl);
    const mvpLocation = gl.getUniformLocation(program, 'u_mvp');
    const modelLocation = gl.getUniformLocation(program, 'u_model');
    const textureLocation = gl.getUniformLocation(program, 'u_skin');
    const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);

    const parts = Object.fromEntries(
        Object.entries(createSteveMeshes()).map(([name, mesh]) => [
            name,
            createGpuPart(gl, program, mesh)
        ])
    );

    const skin = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, skin);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, skinImage);
    gl.uniform1i(textureLocation, 0);

    let yaw = Math.PI;
    let pixelRatio = 0;

    function resize() {
        const hudScale = Number.parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--hud-scale')
        ) || 1;
        const ratio = (window.devicePixelRatio || 1) * hudScale;
        const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
        const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        pixelRatio = ratio;
    }

    function render() {
        resize();
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, skin);

        const projection = math.perspective(
            34 * Math.PI / 180,
            canvas.width / canvas.height,
            0.1,
            20
        );
        const view = math.lookAt([0.0, 0.95, 4.4], [0.0, 0.9, 0.0], [0, 1, 0]);
        const mvp = math.multiply(projection, view);
        gl.uniformMatrix4fv(mvpLocation, false, mvp);

        const matrices = createStevePartMatrices({
            feet: [0, 0, 0],
            yaw,
            walkPhase: 0,
            walkAmount: 0,
            ageTicks: 0,
            headYaw: 0,
            headPitch: 0,
            swingProgress: 0,
            sneaking: false
        });

        for (const name of STEVE_PART_ORDER) {
            const part = parts[name];
            gl.bindVertexArray(part.vao);
            gl.uniformMatrix4fv(modelLocation, false, matrices[name] ?? identity);
            gl.drawElements(gl.TRIANGLES, part.indexCount, gl.UNSIGNED_SHORT, 0);
        }
        gl.bindVertexArray(null);
        return pixelRatio;
    }

    function setYaw(value) {
        if (!Number.isFinite(value)) return;
        yaw = value;
        render();
    }

    render();
    return { render, setYaw };
}
