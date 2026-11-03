import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MINE_TICK_MS,
    getBareHandMiningProgressPerTick,
    getBareHandMiningTicks,
    getMiningCrackStage
} from '../mining-timing.mjs';

test('Minecraft 1.0 usa ticks de 50 ms', () => {
    assert.equal(MINE_TICK_MS, 50);
});

test('tempos de mão vazia em solo', () => {
    assert.equal(getBareHandMiningTicks(1), 151);   // pedra: float Java, 7,55 s
    assert.equal(getBareHandMiningTicks(2), 18);    // grama: 0,90 s
    assert.equal(getBareHandMiningTicks(3), 15);    // terra: 0,75 s
    assert.equal(getBareHandMiningTicks(4), 201);   // pedregulho: 10,05 s
    assert.equal(getBareHandMiningTicks(5), 61);    // tábuas: 3,05 s
    assert.equal(getBareHandMiningTicks(12), 15);   // areia: 0,75 s
    assert.equal(getBareHandMiningTicks(13), 18);   // cascalho: 0,90 s
    assert.equal(getBareHandMiningTicks(24), 81);   // arenito: 4,05 s
    assert.equal(getBareHandMiningTicks(79), 15);   // gelo: 0,75 s
    assert.equal(getBareHandMiningTicks(110), 18);  // micélio: 0,90 s
});

test('bedrock e blocos não mapeados não acumulam dano', () => {
    assert.equal(getBareHandMiningProgressPerTick(7), 0);
    assert.equal(getBareHandMiningProgressPerTick(250), 0);
    assert.equal(getBareHandMiningTicks(7), Infinity);
});

test('água e estar no ar aplicam penalidades de cinco vezes cada', () => {
    assert.equal(getBareHandMiningTicks(3, { onGround: false }), 76);
    assert.equal(getBareHandMiningTicks(3, { inWater: true }), 76);
    assert.equal(getBareHandMiningTicks(3, { inWater: true, onGround: false }), 376);
});

test('estágios de rachadura seguem (int)(progresso * 10) - 1', () => {
    assert.equal(getMiningCrackStage(0), -1);
    assert.equal(getMiningCrackStage(0.099), -1);
    assert.equal(getMiningCrackStage(0.1), 0);
    assert.equal(getMiningCrackStage(0.55), 4);
    assert.equal(getMiningCrackStage(0.99), 8);
    assert.equal(getMiningCrackStage(1), 9);
});
