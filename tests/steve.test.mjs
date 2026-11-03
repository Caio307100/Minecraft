import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createSteveMeshes,
    createStevePartMatrices,
    createSteveFirstPersonArmMatrix,
    updatePlayerBodyRotation,
    STEVE_PART_ORDER
} from '../steve.mjs';

function transformPoint(matrix, point) {
    const [x, y, z] = point;
    return [
        matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
        matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
        matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
    ];
}

test('modelo do Steve contém as sete partes esperadas', () => {
    const meshes = createSteveMeshes();
    assert.deepEqual(Object.keys(meshes).sort(), [...STEVE_PART_ORDER].sort());

    for (const [name, mesh] of Object.entries(meshes)) {
        assert.equal(mesh.positions.length, 24 * 3, `${name}: posições`);
        assert.equal(mesh.uvs.length, 24 * 2, `${name}: UVs`);
        assert.equal(mesh.normals.length, 24 * 3, `${name}: normais`);
        assert.equal(mesh.colors.length, 24 * 3, `${name}: cores`);
        assert.equal(mesh.indices.length, 36, `${name}: índices`);
        assert.ok([...mesh.positions, ...mesh.uvs, ...mesh.normals].every(Number.isFinite));
        assert.ok(mesh.uvs.every(value => value >= 0 && value <= 1));
    }
});

test('matrizes do Steve são finitas e têm 4x4', () => {
    const matrices = createStevePartMatrices({
        feet: [3, 12, -4],
        yaw: 1.1,
        walkPhase: 2.5,
        walkAmount: 0.8,
        ageTicks: 100,
        headPitch: 0.3,
        sneaking: true
    });

    for (const name of STEVE_PART_ORDER) {
        assert.equal(matrices[name].length, 16);
        assert.ok([...matrices[name]].every(Number.isFinite));
    }
});

test('a cabeça acompanha o olhar antes de o tronco começar a girar', () => {
    const smallTurn = updatePlayerBodyRotation({
        bodyYaw: 0, headYaw: 30 * Math.PI / 180
    });
    assert.equal(smallTurn.bodyYaw, 0);
    assert.ok(Math.abs(smallTurn.headYaw - 30 * Math.PI / 180) < 1e-12);

    const largeTurn = updatePlayerBodyRotation({
        bodyYaw: 0, headYaw: 60 * Math.PI / 180
    });
    assert.ok(Math.abs(largeTurn.bodyYaw - 12 * Math.PI / 180) < 1e-12);
    assert.ok(Math.abs(largeTurn.headYaw - 48 * Math.PI / 180) < 1e-12);
});

test('a cabeça não ultrapassa 75 graus em relação ao tronco', () => {
    const rotation = updatePlayerBodyRotation({
        bodyYaw: 0, headYaw: 120 * Math.PI / 180
    });
    assert.ok(Math.abs(rotation.headYaw - 60 * Math.PI / 180) < 1e-12);
    assert.ok(Math.abs(rotation.bodyYaw - 60 * Math.PI / 180) < 1e-12);
});

test('o tronco acompanha gradualmente a direção do movimento', () => {
    const rotation = updatePlayerBodyRotation({
        bodyYaw: 0,
        headYaw: 0,
        deltaX: 0.1,
        deltaZ: 0,
        deltaTime: 1 / 20
    });
    assert.ok(rotation.bodyYaw < 0);
    assert.ok(Math.abs(rotation.headYaw) > 0);
});

test('agachar não reutiliza a rotação de pernas da pose de montaria', () => {
    const standing = createStevePartMatrices({
        feet: [0, 0, 0], walkPhase: 1.7, walkAmount: 0.6, sneaking: false
    });
    const sneaking = createStevePartMatrices({
        feet: [0, 0, 0], walkPhase: 1.7, walkAmount: 0.6, sneaking: true
    });

    // O sneak original só muda os pivôs das pernas; não força pitch/yaw de montaria.
    assert.deepEqual([...sneaking.rightLeg.slice(0, 12)], [...standing.rightLeg.slice(0, 12)]);
    assert.deepEqual([...sneaking.leftLeg.slice(0, 12)], [...standing.leftLeg.slice(0, 12)]);
    assert.notDeepEqual([...sneaking.rightLeg.slice(12, 15)], [...standing.rightLeg.slice(12, 15)]);
    assert.notDeepEqual([...sneaking.leftLeg.slice(12, 15)], [...standing.leftLeg.slice(12, 15)]);
});

test('altura dos pés e da cabeça respeita a transformação do RenderLiving', () => {
    const meshes = createSteveMeshes();
    const matrices = createStevePartMatrices({ feet: [0, 10, 0] });

    const legY = [];
    for (let i = 1; i < meshes.rightLeg.positions.length; i += 3) {
        const vertex = [
            meshes.rightLeg.positions[i - 1],
            meshes.rightLeg.positions[i],
            meshes.rightLeg.positions[i + 1]
        ];
        legY.push(transformPoint(matrices.rightLeg, vertex)[1]);
    }

    const headY = [];
    for (let i = 1; i < meshes.head.positions.length; i += 3) {
        const vertex = [
            meshes.head.positions[i - 1],
            meshes.head.positions[i],
            meshes.head.positions[i + 1]
        ];
        headY.push(transformPoint(matrices.head, vertex)[1]);
    }

    assert.ok(Math.min(...legY) > 10 && Math.min(...legY) < 10.02);
    assert.ok(Math.max(...headY) > 11.85 && Math.max(...headY) < 11.9);
});


test('golpe altera a pose do braço direito em terceira pessoa', () => {
    const idle = createStevePartMatrices({ feet: [0, 0, 0], swingProgress: 0 });
    const swing = createStevePartMatrices({ feet: [0, 0, 0], swingProgress: 0.5 });

    assert.notDeepEqual([...idle.rightArm], [...swing.rightArm]);
    assert.notDeepEqual([...idle.body], [...swing.body]);
});

test('braço em primeira pessoa gera matriz finita e reage ao golpe', () => {
    const idle = createSteveFirstPersonArmMatrix({ swingProgress: 0 });
    const swing = createSteveFirstPersonArmMatrix({ swingProgress: 0.5 });

    assert.equal(idle.length, 16);
    assert.ok([...idle].every(Number.isFinite));
    assert.ok([...swing].every(Number.isFinite));
    assert.notDeepEqual([...idle], [...swing]);
});
