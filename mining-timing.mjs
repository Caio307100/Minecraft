// Fórmula de mineração do Minecraft Java 1.0, para mão vazia.
// O jogo original acumula progresso em ticks de 50 ms usando float Java.
export const MINE_TICK_MS = 50;

const BLOCKS = Object.freeze({
    1:   { hardness: 1.5, harvestableByHand: false }, // stone: exige picareta para drops
    2:   { hardness: 0.6, harvestableByHand: true  }, // grass
    3:   { hardness: 0.5, harvestableByHand: true  }, // dirt
    4:   { hardness: 2.0, harvestableByHand: false }, // cobblestone
    5:   { hardness: 2.0, harvestableByHand: true  }, // planks
    17:  { hardness: 2.0, harvestableByHand: true  }, // log
    18:  { hardness: 0.2, harvestableByHand: true  }, // leaves
    7:   { hardness: -1,  harvestableByHand: false }, // bedrock
    12:  { hardness: 0.5, harvestableByHand: true  }, // sand
    13:  { hardness: 0.6, harvestableByHand: true  }, // gravel
    24:  { hardness: 0.8, harvestableByHand: false }, // sandstone: exige picareta para drops
    79:  { hardness: 0.5, harvestableByHand: true  }, // ice
    110: { hardness: 0.6, harvestableByHand: true  }  // mycelium
});

/**
 * Progresso por tick, equivalente a Block.getPlayerRelativeBlockHardness
 * + EntityPlayer.getCurrentPlayerStrVsBlock no caso de mão vazia.
 * @param {number} blockId
 * @param {{inWater?: boolean, onGround?: boolean}} conditions
 * @returns {number} fração de bloco por tick; 0 significa inquebrável/não mapeado.
 */
export function getBareHandMiningProgressPerTick(
    blockId,
    { inWater = false, onGround = true } = {}
) {
    const block = BLOCKS[blockId];
    if (!block || block.hardness < 0) return 0;

    // EntityPlayer 1.0: força base 1; água e estar no ar dividem a força por 5.
    let strength = 1.0;
    if (inWater) strength = Math.fround(strength / 5.0);
    if (!onGround) strength = Math.fround(strength / 5.0);

    // Java usa float nas divisões e no acumulador de dano.
    const byHardness = Math.fround(strength / block.hardness);
    return Math.fround(byHardness / (block.harvestableByHand ? 30.0 : 100.0));
}

/** Avança o acumulador como um float Java. */
export function advanceBareHandMiningProgress(progress, blockId, conditions) {
    const damage = getBareHandMiningProgressPerTick(blockId, conditions);
    return Math.fround(progress + damage);
}

/**
 * Estágio da rachadura do renderizador original: (int)(progress * 10) - 1.
 * Retorna -1 antes do primeiro estágio visível.
 */
export function getMiningCrackStage(progress) {
    if (!Number.isFinite(progress) || progress <= 0) return -1;
    return Math.max(-1, Math.min(9, Math.trunc(progress * 10) - 1));
}

/** Número de ticks observável com o acumulador float do Java. */
export function getBareHandMiningTicks(blockId, conditions = {}) {
    const damage = getBareHandMiningProgressPerTick(blockId, conditions);
    if (damage <= 0) return Infinity;

    let progress = 0;
    let ticks = 0;
    while (progress < 1 && ticks < 1_000_000) {
        progress = advanceBareHandMiningProgress(progress, blockId, conditions);
        ticks++;
    }
    return progress >= 1 ? ticks : Infinity;
}
