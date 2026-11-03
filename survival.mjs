export const MAX_HEALTH = 20;
export const MAX_FOOD = 20;
export const MAX_AIR = 300;
export const EXHAUSTION_PER_POINT = 4;

export function createSurvivalState() {
    return {
        health: MAX_HEALTH,
        food: MAX_FOOD,
        saturation: 5,
        exhaustion: 0,
        air: MAX_AIR,
        drownTimer: 0,
        regenTimer: 0,
        starvationTimer: 0,
        dead: false
    };
}

export function resetSurvivalState(state) {
    Object.assign(state, createSurvivalState());
    return state;
}

export function addExhaustion(state, amount) {
    if (!Number.isFinite(amount) || amount <= 0 || state.dead) return;
    state.exhaustion = Math.min(40, state.exhaustion + amount);
}

export function damagePlayer(state, amount, cause = 'unknown', nonLethal = false) {
    if (state.dead || !Number.isFinite(amount) || amount <= 0) {
        return { type: 'damage', amount: 0, cause, dead: state.dead };
    }

    const previousHealth = state.health;
    const floor = nonLethal ? 1 : 0;
    state.health = Math.max(floor, state.health - Math.ceil(amount));
    if (state.health <= 0) state.dead = true;

    return {
        type: 'damage',
        amount: previousHealth - state.health,
        cause,
        dead: state.dead
    };
}

export function healPlayer(state, amount = 1) {
    if (state.dead || !Number.isFinite(amount) || amount <= 0) return 0;
    const previousHealth = state.health;
    state.health = Math.min(MAX_HEALTH, state.health + Math.ceil(amount));
    return state.health - previousHealth;
}

/**
 * Atualiza fome, regeneração e oxigênio. `distance` está em blocos.
 * O consumo segue o acumulador de exaustão: a cada 4 pontos, gasta
 * primeiro 1 ponto de saturação e depois 1 ponto de comida.
 */
export function tickSurvival(state, deltaSeconds, {
    distance = 0,
    sprinting = false,
    jumped = false,
    headUnderwater = false
} = {}) {
    const events = [];
    if (state.dead || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
        return events;
    }

    if (distance > 0) {
        addExhaustion(state, distance * (sprinting ? 0.1 : 0.01));
    }
    if (jumped) addExhaustion(state, sprinting ? 0.2 : 0.05);

    while (state.exhaustion >= EXHAUSTION_PER_POINT) {
        state.exhaustion -= EXHAUSTION_PER_POINT;
        if (state.saturation > 0) {
            state.saturation = Math.max(0, state.saturation - 1);
        } else if (state.food > 0) {
            state.food = Math.max(0, state.food - 1);
            events.push({ type: 'food', food: state.food });
        }
    }

    if (headUnderwater) {
        const airSecondsRemaining = state.air / 20;
        state.air = Math.max(0, state.air - deltaSeconds * 20);
        const timeWithoutAir = Math.max(0, deltaSeconds - airSecondsRemaining);
        if (state.air <= 0 && timeWithoutAir > 0) {
            state.drownTimer += timeWithoutAir;
            while (state.drownTimer >= 1 && !state.dead) {
                state.drownTimer -= 1;
                events.push(damagePlayer(state, 2, 'drowning'));
            }
        }
    } else {
        state.air = Math.min(MAX_AIR, state.air + deltaSeconds * 20);
        state.drownTimer = 0;
    }

    if (state.food >= 18 && state.health < MAX_HEALTH) {
        state.regenTimer += deltaSeconds;
        while (state.regenTimer >= 4 && state.health < MAX_HEALTH) {
            state.regenTimer -= 4;
            const healed = healPlayer(state, 1);
            if (healed) {
                addExhaustion(state, 3);
                events.push({ type: 'heal', amount: healed });
            }
        }
    } else {
        state.regenTimer = 0;
    }

    // No modo Normal, fome não mata diretamente: deixa o jogador com 1 HP.
    if (state.food === 0 && state.health > 1) {
        state.starvationTimer += deltaSeconds;
        while (state.starvationTimer >= 4 && state.health > 1) {
            state.starvationTimer -= 4;
            events.push(damagePlayer(state, 1, 'starvation', true));
        }
    } else {
        state.starvationTimer = 0;
    }

    return events;
}
