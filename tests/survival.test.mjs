import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createSurvivalState,
    addExhaustion,
    damagePlayer,
    tickSurvival,
    resetSurvivalState
} from '../survival.mjs';

test('jogador começa com 20 de vida, 20 de comida e 300 de ar', () => {
    const state = createSurvivalState();
    assert.equal(state.health, 20);
    assert.equal(state.food, 20);
    assert.equal(state.air, 300);
});

test('exaustão gasta saturação antes da comida', () => {
    const state = createSurvivalState();
    addExhaustion(state, 4);
    tickSurvival(state, 0.05);
    assert.equal(state.saturation, 4);
    assert.equal(state.food, 20);
    state.saturation = 0;
    addExhaustion(state, 4);
    tickSurvival(state, 0.05);
    assert.equal(state.food, 19);
});

test('dano de afogamento começa quando o ar acaba', () => {
    const state = createSurvivalState();
    tickSurvival(state, 15, { headUnderwater: true });
    assert.equal(state.air, 0);
    assert.equal(state.health, 20);
    tickSurvival(state, 1, { headUnderwater: true });
    assert.equal(state.health, 18);
});

test('fome não mata abaixo de um coração no Normal', () => {
    const state = createSurvivalState();
    state.food = 0;
    state.health = 2;
    tickSurvival(state, 8);
    assert.equal(state.health, 1);
    assert.equal(state.dead, false);
});

test('dano letal marca morte e respawn restaura os atributos', () => {
    const state = createSurvivalState();
    damagePlayer(state, 20, 'fall');
    assert.equal(state.dead, true);
    resetSurvivalState(state);
    assert.equal(state.dead, false);
    assert.equal(state.health, 20);
    assert.equal(state.food, 20);
});
