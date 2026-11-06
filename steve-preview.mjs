import {
    createSteveMeshes,
    createStevePartMatrices,
    STEVE_PART_ORDER
} from './steve.mjs';

const VERTEX_SHADER = `#version 300 es
in vec3 a_position;
in vec2 a_uv;
in vec3 a_normal;
uniform mat4 u_mvp;
uniform mat4 u_model;
out vec2 v_uv;
out vec3 v_normal;
void main() {
    gl_Position = u_mvp * u_model * vec4(a_position, 1.0);
    v_uv = a_uv;
    v_normal = mat3(u_model) * a_normal;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec3 v_normal;
uniform sampler2D u_skin;
out vec4 outColor;
void main() {
    vec4 texel = texture(u_skin, v_uv);
    if (texel.a < 0.1) discard;

    // rt.b() do Minecraft 1.0: luz ambiente 0.4 e duas luzes difusas 0.6.
    vec3 normal = normalize(v_normal);
    vec3 lightA = normalize(vec3(0.2, 1.0, -0.7));
    vec3 lightB = normalize(vec3(-0.2, 1.0, 0.7));
    float diffuse = max(dot(normal, lightA), 0.0)
                  + max(dot(normal, lightB), 0.0);
    float lighting = min(1.0, 0.4 + 0.6 * diffuse);

    outColor = vec4(texel.rgb * lighting, texel.a);
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
        ['a_uv', mesh.uvs, 2],
        ['a_normal', mesh.normals, 3]
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

function rotationX(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Float32Array([
        1, 0, 0, 0,
        0, c, s, 0,
        0, -s, c, 0,
        0, 0, 0, 1
    ]);
}

/**
 * Preview do inventário baseado nas transformações de hw.java e na
 * iluminação fixa configurada por rt.b() no Minecraft 1.0.
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

    let pointerX = 51;
    let pointerY = 75;
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

        // hw.java calcula os ângulos diretamente pela posição do cursor.
        const horizontal = Math.atan((pointerX - 51) / 40);
        const vertical = Math.atan((25 - pointerY) / 40);
        const bodyYaw = horizontal * 40 * Math.PI / 180;
        const headYaw = horizontal * 20 * Math.PI / 180;
        const headPitch = -vertical * 20 * Math.PI / 180;
        const globalPitch = rotationX(-vertical * 20 * Math.PI / 180);

        const matrices = createStevePartMatrices({
            feet: [0, 0, 0],
            yaw: Math.PI + bodyYaw,
            walkPhase: 0,
            walkAmount: 0,
            ageTicks: 0,
            headYaw,
            headPitch,
            swingProgress: 0,
            sneaking: false
        });

        for (const name of STEVE_PART_ORDER) {
            const part = parts[name];
            gl.bindVertexArray(part.vao);
            const local = matrices[name] ?? identity;
            const model = math.multiply(globalPitch, local);
            gl.uniformMatrix4fv(modelLocation, false, model);
            gl.drawElements(gl.TRIANGLES, part.indexCount, gl.UNSIGNED_SHORT, 0);
        }
        gl.bindVertexArray(null);
        return pixelRatio;
    }

    function setLook(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        pointerX = x;
        pointerY = y;
        render();
    }

    render();
    return { render, setLook };
}
