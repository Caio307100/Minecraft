/**
 * Modelo biped do Minecraft Java 1.0 (classe fa), com UVs da classe ad.
 * As coordenadas do modelo são expressas em blocos (pixels / 16).
 */

const MODEL_SCALE = 0.9375;
const MODEL_BASE_Y = -24 / 16 - 0.0078125;
const PIXEL = 1 / 16;


function wrapRadians(angle) {
    while (angle < -Math.PI) angle += Math.PI * 2;
    while (angle >= Math.PI) angle -= Math.PI * 2;
    return angle;
}

/**
 * nq.c(): rotação do corpo acompanha o movimento; a cabeça pode olhar até
 * 75° em relação ao tronco. Acima de 50°, o tronco começa a acompanhar a cabeça.
 * Os fatores são equivalentes aos 0.3 e 0.2 aplicados por tick no Java 1.0.
 */
export function updatePlayerBodyRotation({
    bodyYaw,
    headYaw,
    deltaX = 0,
    deltaZ = 0,
    deltaTime = 1 / 20
}) {
    if (![bodyYaw, headYaw, deltaX, deltaZ, deltaTime].every(Number.isFinite) || deltaTime <= 0) {
        throw new TypeError('Ângulos, deslocamento e deltaTime precisam ser finitos; deltaTime deve ser positivo.');
    }

    const movementDistance = Math.hypot(deltaX, deltaZ);
    const distancePerTick = movementDistance * (0.05 / deltaTime);
    const movementSmoothing = 1 - Math.pow(0.7, deltaTime * 20);
    const headSmoothing = 1 - Math.pow(0.8, deltaTime * 20);

    let nextBodyYaw = bodyYaw;
    if (distancePerTick > 0.05) {
        // O eixo frontal do modelo do port aponta para -Z.
        const movementYaw = Math.atan2(-deltaX, -deltaZ);
        const movementDifference = wrapRadians(movementYaw - nextBodyYaw);
        nextBodyYaw += movementDifference * movementSmoothing;
    }

    let headDifference = wrapRadians(headYaw - nextBodyYaw);
    const headDifferenceDegrees = headDifference * 180 / Math.PI;
    const backwardsLooking = headDifferenceDegrees < -90 || headDifferenceDegrees >= 90;
    headDifference = Math.max(-75 * Math.PI / 180, Math.min(75 * Math.PI / 180, headDifference));
    nextBodyYaw = headYaw - headDifference;

    if (headDifference * headDifference > 2500 * Math.PI * Math.PI / (180 * 180)) {
        nextBodyYaw += headDifference * headSmoothing;
    }

    // A variável é mantida contínua entre -PI e PI para evitar drift numérico.
    nextBodyYaw = wrapRadians(nextBodyYaw);
    return {
        bodyYaw: nextBodyYaw,
        headYaw: wrapRadians(headYaw - nextBodyYaw),
        lookingBackwards: backwardsLooking
    };
}

export const STEVE_PART_ORDER = [
    'rightLeg',
    'leftLeg',
    'body',
    'rightArm',
    'leftArm',
    'head',
    'hat'
];

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

function translation(x, y, z) {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        x, y, z, 1
    ]);
}

function scaling(x, y, z) {
    return new Float32Array([
        x, 0, 0, 0,
        0, y, 0, 0,
        0, 0, z, 0,
        0, 0, 0, 1
    ]);
}

function rotateX(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Float32Array([
        1, 0, 0, 0,
        0, c, s, 0,
        0, -s, c, 0,
        0, 0, 0, 1
    ]);
}

function rotateY(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Float32Array([
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1
    ]);
}

function rotateZ(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Float32Array([
        c, s, 0, 0,
        -s, c, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
}

function makeFace(indices, ua, va, ub, vb) {
    return {
        indices,
        // pv.java: v0=(ub,va), v1=(ua,va), v2=(ua,vb), v3=(ub,vb)
        uvs: [
            [ub / 64, va / 32],
            [ua / 64, va / 32],
            [ua / 64, vb / 32],
            [ub / 64, vb / 32]
        ]
    };
}

function normalFor(a, b, c) {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal = [
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0]
    ];
    const length = Math.hypot(...normal);

    if (length < 1e-8) {
        throw new Error('Face degenerada no modelo do Steve.');
    }

    return normal.map(value => value / length);
}

/**
 * Replica ad.java: geometria expandida por inflação, UV por face e espelho
 * geométrico (x0/x1 trocados + ordem dos vértices invertida).
 */
function buildBox({ u, v, x, y, z, width, height, depth, inflate = 0, mirror = false }) {
    let x0 = x - inflate;
    let y0 = y - inflate;
    let z0 = z - inflate;
    let x1 = x + width + inflate;
    let y1 = y + height + inflate;
    let z1 = z + depth + inflate;

    if (mirror) [x0, x1] = [x1, x0];

    const points = [
        [x0, y0, z0], // fs2
        [x1, y0, z0], // fs3
        [x1, y1, z0], // fs4
        [x0, y1, z0], // fs5
        [x0, y0, z1], // fs6
        [x1, y0, z1], // fs7
        [x1, y1, z1], // fs8
        [x0, y1, z1]  // fs9
    ];

    const faces = [
        makeFace([5, 1, 2, 6], u + depth + width, v + depth,
            u + depth + width + depth, v + depth + height),
        makeFace([0, 4, 7, 3], u, v + depth,
            u + depth, v + depth + height),
        makeFace([5, 4, 0, 1], u + depth, v,
            u + depth + width, v + depth),
        makeFace([2, 3, 7, 6], u + depth + width, v + depth,
            u + depth + width + width, v),
        makeFace([1, 0, 3, 2], u + depth, v + depth,
            u + depth + width, v + depth + height),
        makeFace([4, 5, 6, 7], u + depth + width + depth, v + depth,
            u + depth + width + depth + width, v + depth + height)
    ];

    const positions = [];
    const uvs = [];
    const normals = [];
    const colors = [];
    const indices = [];

    for (const face of faces) {
        let vertexOrder = [...face.indices];
        let faceUvs = face.uvs.map(uv => [...uv]);

        // acf.i: pv.a() inverte a ordem dos vértices depois de associar UV.
        if (mirror) {
            vertexOrder.reverse();
            faceUvs.reverse();
        }

        const quad = vertexOrder.map(index => [
            points[index][0] * PIXEL,
            points[index][1] * PIXEL,
            points[index][2] * PIXEL
        ]);
        const normal = normalFor(quad[0], quad[1], quad[2]);
        const base = positions.length / 3;

        for (let i = 0; i < 4; i++) {
            positions.push(...quad[i]);
            uvs.push(...faceUvs[i]);
            normals.push(...normal);
            colors.push(1, 1, 1);
        }

        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }

    return {
        positions: new Float32Array(positions),
        uvs: new Float32Array(uvs),
        normals: new Float32Array(normals),
        colors: new Float32Array(colors),
        indices: new Uint16Array(indices)
    };
}

export function createSteveMeshes() {
    return {
        head: buildBox({
            u: 0, v: 0, x: -4, y: -8, z: -4,
            width: 8, height: 8, depth: 8
        }),
        hat: buildBox({
            u: 32, v: 0, x: -4, y: -8, z: -4,
            width: 8, height: 8, depth: 8, inflate: 0.5
        }),
        body: buildBox({
            u: 16, v: 16, x: -4, y: 0, z: -2,
            width: 8, height: 12, depth: 4
        }),
        rightArm: buildBox({
            u: 40, v: 16, x: -3, y: -2, z: -2,
            width: 4, height: 12, depth: 4
        }),
        leftArm: buildBox({
            u: 40, v: 16, x: -1, y: -2, z: -2,
            width: 4, height: 12, depth: 4, mirror: true
        }),
        rightLeg: buildBox({
            u: 0, v: 16, x: -2, y: 0, z: -2,
            width: 4, height: 12, depth: 4
        }),
        leftLeg: buildBox({
            u: 0, v: 16, x: -2, y: 0, z: -2,
            width: 4, height: 12, depth: 4, mirror: true
        })
    };
}

function partMatrix(root, pivot, rotation) {
    const local = multiply(
        translation(pivot[0] * PIXEL, pivot[1] * PIXEL, pivot[2] * PIXEL),
        multiply(
            rotateZ(rotation.z),
            multiply(
                rotateY(rotation.y),
                rotateX(rotation.x)
            )
        )
    );

    return multiply(root, local);
}

/**
 * Matrizes do RenderLiving + ModelBiped do Minecraft 1.0.
 * Ordem: T(feet) · Ry(yaw) · S(-.9375,-.9375,.9375) · T(base)
 *        · T(pivô) · Rz · Ry · Rx.
 */
export function createStevePartMatrices({
    feet,
    yaw = 0,
    walkPhase = 0,
    walkAmount = 0,
    ageTicks = 0,
    headYaw = 0,
    headPitch = 0,
    swingProgress = 0,
    sneaking = false
}) {
    if (!Array.isArray(feet) || feet.length !== 3 || !feet.every(Number.isFinite)) {
        throw new TypeError('feet precisa conter x, y e z finitos.');
    }

    const amount = Math.max(0, Math.min(1, walkAmount));
    const phase = walkPhase * 0.6662;
    const idleArmRoll = Math.cos(ageTicks * 0.09) * 0.05 + 0.05;
    const idleArmPitch = Math.sin(ageTicks * 0.067) * 0.05;
    const swing = Math.max(0, Math.min(1, swingProgress));
    const swingBodyYaw = Math.sin(Math.sqrt(swing) * Math.PI * 2) * 0.2;
    const swingEase = 1 - Math.pow(1 - swing, 4);
    const swingSine = Math.sin(swingEase * Math.PI);
    const swingHeadCompensation = Math.sin(swing * Math.PI) *
        -(headPitch - 0.7) * 0.75;

    let rightArmPitch = Math.cos(phase + Math.PI) * amount;
    let leftArmPitch = Math.cos(phase) * amount;
    let rightArmYaw = 0;
    let leftArmYaw = 0;
    let rightArmRoll = idleArmRoll;
    let rightArmPivot = [-5, 2, 0];
    let leftArmPivot = [5, 2, 0];

    if (swing > 0) {
        // fa.a(): the right arm leads the swing while the torso yaws slightly.
        rightArmPitch -= swingSine * 1.2 + swingHeadCompensation;
        rightArmYaw = swingBodyYaw * 3;
        // O ombro esquerdo gira junto com o tronco, mas sem o balanço do golpe.
        leftArmYaw = swingBodyYaw;
        rightArmRoll += Math.sin(swing * Math.PI) * -0.4;
        rightArmPivot = [
            -5 + Math.sin(swingBodyYaw) * 5,
            2,
            -Math.cos(swingBodyYaw) * 5
        ];
        // Compensa a rotação do tronco para manter o braço esquerdo
        // conectado ao ombro, sem aplicar a animação do golpe nele.
        leftArmPivot = [
            Math.cos(swingBodyYaw) * 5,
            2,
            -Math.sin(swingBodyYaw) * 5
        ];
    }

    let rightLegPitch = Math.cos(phase) * 1.4 * amount;
    let leftLegPitch = Math.cos(phase + Math.PI) * 1.4 * amount;

    let rightLegPivot = [-2, 12, 0];
    let leftLegPivot = [2, 12, 0];
    const headPivot = [0, sneaking ? 1 : 0, 0];

    if (sneaking) {
        rightArmPitch += 0.4;
        leftArmPitch += 0.4;
        // Sneak (fa.r): mantém a rotação normal das pernas e só desloca os pivôs.
        // Os ângulos -1.2566371 e yaw ±0.31415927 pertencem à pose de montaria (fa.b).
        rightLegPivot = [-2, 9, 4];
        leftLegPivot = [2, 9, 4];
    }

    const root = multiply(
        translation(feet[0], feet[1], feet[2]),
        multiply(
            rotateY(yaw),
            multiply(
                scaling(-MODEL_SCALE, -MODEL_SCALE, MODEL_SCALE),
                translation(0, MODEL_BASE_Y, 0)
            )
        )
    );

    return {
        rightLeg: partMatrix(root, rightLegPivot, {
            x: rightLegPitch, y: 0, z: 0
        }),
        leftLeg: partMatrix(root, leftLegPivot, {
            x: leftLegPitch, y: 0, z: 0
        }),
        body: partMatrix(root, [0, 0, 0], {
            x: sneaking ? 0.5 : 0, y: swingBodyYaw, z: 0
        }),
        rightArm: partMatrix(root, rightArmPivot, {
            x: rightArmPitch + idleArmPitch,
            y: rightArmYaw,
            z: rightArmRoll
        }),
        leftArm: partMatrix(root, leftArmPivot, {
            x: leftArmPitch - idleArmPitch,
            y: leftArmYaw,
            z: -idleArmRoll
        }),
        head: partMatrix(root, headPivot, {
            x: headPitch, y: headYaw, z: 0
        }),
        hat: partMatrix(root, headPivot, {
            x: headPitch, y: headYaw, z: 0
        })
    };
}

/**
 * Mão direita em primeira pessoa, replicando ItemRenderer (n.java, ramo sem item)
 * + RenderPlayer.b() (zr.java). Espaço de câmera: +X direita, +Y cima, -Z frente.
 * Atenção: NÃO usa o flip (-1,-1,1) do RenderLiving; a orientação do braço vem
 * inteiramente de Rz(120°) · Rx(200°) · Ry(-135°).
 * zr.b() chama fa.a(0,0,0,0,0,0.0625), que deixa o braço direito parado com
 * apenas j.h = 0.1 rad (balanço ocioso em tick 0), por isso ageTicks não entra.
 */
export function createSteveFirstPersonArmMatrix({
    swingProgress = 0,
    ageTicks = 0
} = {}) {
    void ageTicks;

    const DEG = Math.PI / 180;
    const swing = Math.max(0, Math.min(1, swingProgress));
    const sqrtSwing = Math.sqrt(swing);
    const sinLinear = Math.sin(swing * Math.PI);
    const sinSqrt = Math.sin(sqrtSwing * Math.PI);
    const sinSquared = Math.sin(swing * swing * Math.PI);
    const equipProgress = 1;

    const chain = [
        // Golpe: afasta a mão para dentro/baixo da tela.
        translation(
            -sinSqrt * 0.3,
            Math.sin(sqrtSwing * Math.PI * 2) * 0.4,
            -sinLinear * 0.4
        ),
        // Ancoragem no canto inferior direito (0.8 * (0.8, -0.75, -0.9)).
        translation(0.64, -0.6 - (1 - equipProgress) * 0.6, -0.72),
        rotateY(45 * DEG),
        rotateY(sinSqrt * 70 * DEG),
        rotateZ(-sinSquared * 20 * DEG),
        translation(-1, 3.6, 3.5),
        rotateZ(120 * DEG),
        rotateX(200 * DEG),
        rotateY(-135 * DEG),
        translation(5.6, 0, 0),
        // acf.a(): pivô do braço direito e rotação Z ociosa.
        translation(-5 * PIXEL, 2 * PIXEL, 0),
        rotateZ(0.1)
    ];

    return chain.reduce((accumulated, matrix) => multiply(accumulated, matrix));
}
