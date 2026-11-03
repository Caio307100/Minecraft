import test from 'node:test';
import assert from 'node:assert/strict';
import {
    FoodStatsMC10,
    ItemStackMC10,
    InventoryPlayerMC10,
    DroppedItemMC10,
    getMinecraft10BlockDrop,
    createBlockDrop,
    createPlayerDrop,
    SURVIVAL_MC10_CONSTANTS
} from '../survival-mc10.mjs';

test('FoodStats eq: valores iniciais do Minecraft 1.0', () => {
    const food = new FoodStatsMC10();
    assert.equal(food.foodLevel, 20);
    assert.equal(food.saturationLevel, 5);
    assert.equal(food.exhaustionLevel, 0);
    assert.equal(food.foodTickTimer, 0);
    assert.equal(food.previousFoodLevel, 20);
});

test('eq: addFoodStats limita fome e saturação ao máximo', () => {
    const food = new FoodStatsMC10();
    food.addFoodStats(6, 0.5);
    assert.equal(food.foodLevel, 20);
    assert.equal(food.saturationLevel, 11);
    assert.equal(food.isFoodLevelNotFull(), false);
});

test('eq: exaustão acima de 4 consome um ponto de saturação', () => {
    const food = new FoodStatsMC10();
    food.addExhaustion(4.1);
    food.tick({ health: 20, difficulty: 2, heal() {}, damage() {} });
    assert.equal(food.exhaustionLevel, Math.fround(Math.fround(4.1) - 4));
    assert.equal(food.saturationLevel, 4);
    assert.equal(food.foodLevel, 20);
});

test('eq: sem saturação, exaustão reduz a fome em dificuldade não pacífica', () => {
    const food = new FoodStatsMC10();
    food.saturationLevel = 0;
    food.foodLevel = 9;
    food.addExhaustion(4.1);
    food.tick({ health: 20, difficulty: 2, heal() {}, damage() {} });
    assert.equal(food.foodLevel, 8);
});

test('eq: regeneração natural ocorre a cada 80 ticks com fome >= 18', () => {
    const food = new FoodStatsMC10();
    let healed = 0;
    for (let i = 0; i < 79; i++) {
        food.tick({ health: 10, difficulty: 2, heal() { healed++; }, damage() {} });
    }
    assert.equal(healed, 0);
    food.tick({ health: 10, difficulty: 2, heal(amount) { healed += amount; }, damage() {} });
    assert.equal(healed, 1);
    assert.equal(food.foodTickTimer, 0);
});

test('eq: fome zero causa dano a cada 80 ticks conforme dificuldade', () => {
    const food = new FoodStatsMC10();
    food.foodLevel = 0;
    let damage = 0;
    for (let i = 0; i < 80; i++) {
        food.tick({ health: 20, difficulty: 2, heal() {}, damage(amount) { damage += amount; } });
    }
    assert.equal(damage, 1);
});

test('eq: fome zero não mata jogador com mais de 10 de vida no fácil', () => {
    const food = new FoodStatsMC10();
    food.foodLevel = 0;
    let damage = 0;
    for (let i = 0; i < 80; i++) {
        food.tick({ health: 10, difficulty: 1, heal() {}, damage(amount) { damage += amount; } });
    }
    assert.equal(damage, 0);
});

test('InventoryPlayer x: 36 slots principais + 4 slots de armadura', () => {
    const inventory = new InventoryPlayerMC10();
    assert.equal(inventory.main.length, 36);
    assert.equal(inventory.armor.length, 4);
    assert.equal(inventory.getTotalSlots(), 40);
    assert.equal(inventory.getCurrentItem(), null);
});

test('InventoryPlayer x: distribui pilhas com limite 64', () => {
    const inventory = new InventoryPlayerMC10();
    const incoming = new ItemStackMC10(3, 70);
    assert.equal(inventory.addItemStack(incoming), true);
    assert.equal(incoming.count, 0);
    assert.equal(inventory.main[0].count, 64);
    assert.equal(inventory.main[1].count, 6);
});

test('InventoryPlayer x: scroll e seleção dos nove slots', () => {
    const inventory = new InventoryPlayerMC10();
    assert.equal(inventory.currentItem, 0);
    assert.equal(inventory.changeCurrentItem(1), 8);
    assert.equal(inventory.changeCurrentItem(-1), 0);
    assert.equal(inventory.selectHotbar(5), true);
    assert.equal(inventory.currentItem, 5);
});

test('InventoryPlayer x: consumo remove a pilha quando chega a zero', () => {
    const inventory = new InventoryPlayerMC10();
    inventory.setStack(0, new ItemStackMC10(3, 1));
    assert.equal(inventory.consumeSelected(1), true);
    assert.equal(inventory.main[0], null);
});

test('InventoryPlayer x: takeAllStacks inclui armadura', () => {
    const inventory = new InventoryPlayerMC10();
    inventory.setStack(0, new ItemStackMC10(3, 4));
    inventory.setStack(36, new ItemStackMC10(298, 1, 0, 1));
    const stacks = inventory.takeAllStacks();
    assert.equal(stacks.length, 2);
    assert.equal(inventory.main[0], null);
    assert.equal(inventory.armor[0], null);
});

test('drop do JAR: grama e terra dão terra; pedra exige ferramenta', () => {
    assert.equal(getMinecraft10BlockDrop(2).id, 3);
    assert.equal(getMinecraft10BlockDrop(3).id, 3);
    assert.equal(getMinecraft10BlockDrop(1), null);
});

test('drop do JAR: cascalho produz flint a 10% com fortune zero', () => {
    assert.equal(getMinecraft10BlockDrop(13, () => 0.05).id, 318);
    assert.equal(getMinecraft10BlockDrop(13, () => 0.5).id, 13);
});

test('yy/vi: atraso de coleta é 10 ticks para bloco e 40 para jogador', () => {
    assert.equal(SURVIVAL_MC10_CONSTANTS.itemPickupDelay, 10);
    assert.equal(SURVIVAL_MC10_CONSTANTS.playerDropPickupDelay, 40);
});

test('ih: item drop só pode ser coletado depois do atraso', () => {
    const inventory = new InventoryPlayerMC10();
    const item = createBlockDrop(new ItemStackMC10(3, 1), 0, 0, 0, () => 0.5);
    const getBlock = () => 0;
    const options = {
        getBlock,
        inventory,
        playerFeet: [0, 0, 0],
        playerRadius: 0.3,
        playerHeight: 1.8
    };
    for (let i = 0; i < 9; i++) item.tick(options);
    assert.equal(item.stack.count, 1);
    item.tick(options);
    assert.equal(item.dead, false);
    assert.equal(item.pickupAnimation.elapsed, 0);
    for (let i = 0; i < 6; i++) item.tick(options);
    assert.equal(item.dead, false);
    assert.equal(item.pickupAnimation.elapsed, 6);
    item.tick(options);
    assert.equal(item.dead, true);
    assert.equal(inventory.main[0].id, 3);
});

test('ih: bloqueia coleta quando jogador está morto, mas continua envelhecendo', () => {
    const inventory = new InventoryPlayerMC10();
    const item = createBlockDrop(new ItemStackMC10(3, 1), 0, 0, 0, () => 0.5);
    item.tick({
        getBlock: () => 0,
        inventory,
        playerFeet: [0, 0, 0],
        allowPickup: false
    });
    assert.equal(item.age, 1);
    assert.equal(item.stack.count, 1);
    assert.equal(inventory.main[0], null);
});

test('ih: entidade de item desaparece aos 6000 ticks', () => {
    const item = new DroppedItemMC10(new ItemStackMC10(3), [0, 0, 0]);
    item.age = 5999;
    item.tick({ getBlock: () => 0, inventory: new InventoryPlayerMC10(), playerFeet: [50, 0, 50] });
    assert.equal(item.dead, true);
});

test('vi.a(dk,false): drop do jogador usa atraso de 40 ticks', () => {
    const item = createPlayerDrop(new ItemStackMC10(3), {
        x: 1, y: 2, z: 3, yaw: 0, pitch: 0,
        random: () => 0.5
    });
    assert.equal(item.pickupDelay, 40);
});
