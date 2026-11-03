import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MC10_INVENTORY_WIDTH,
    MC10_INVENTORY_HEIGHT,
    getMinecraft10InventoryLayout,
    getMinecraft10HudIconPosition,
    getMinecraft10ItemTooltipName
} from '../inventory-layout.mjs';

test('hw.java: painel original de inventário tem 176x166', () => {
    assert.equal(MC10_INVENTORY_WIDTH, 176);
    assert.equal(MC10_INVENTORY_HEIGHT, 166);
});

test('gd.java: layout contém quatro slots de armadura, crafting, 27 slots e hotbar', () => {
    const layout = getMinecraft10InventoryLayout();
    const armor = layout.filter(slot => slot.area === 'armor');
    const main = layout.filter(slot => slot.area === 'main');
    const hotbar = layout.filter(slot => slot.area === 'hotbar');
    const crafting = layout.filter(slot => slot.type === 'crafting');

    assert.equal(armor.length, 4);
    assert.deepEqual(armor.map(slot => slot.slot), [39, 38, 37, 36]);
    assert.deepEqual(armor.map(slot => [slot.x, slot.y]), [
        [8, 8], [8, 26], [8, 44], [8, 62]
    ]);
    assert.equal(crafting.length, 4);
    assert.deepEqual(crafting.map(slot => [slot.x, slot.y]), [
        [88, 26], [106, 26], [88, 44], [106, 44]
    ]);
    assert.equal(main.length, 27);
    assert.equal(hotbar.length, 9);
    assert.deepEqual([main[0].slot, main[0].x, main[0].y], [9, 8, 84]);
    assert.deepEqual([main[26].slot, main[26].x, main[26].y], [35, 152, 120]);
    assert.deepEqual([hotbar[0].slot, hotbar[0].x, hotbar[0].y], [0, 8, 142]);
    assert.deepEqual([hotbar[8].slot, hotbar[8].x, hotbar[8].y], [8, 152, 142]);
});

test('qd.java: corações e fome usam 9px com passo de 8px em y=altura-39', () => {
    const width = 1280;
    const height = 720;
    assert.deepEqual(getMinecraft10HudIconPosition('health', 0, width, height), {
        x: 549, y: 681
    });
    assert.deepEqual(getMinecraft10HudIconPosition('health', 9, width, height), {
        x: 621, y: 681
    });
    assert.deepEqual(getMinecraft10HudIconPosition('food', 0, width, height), {
        x: 722, y: 681
    });
    assert.deepEqual(getMinecraft10HudIconPosition('food', 9, width, height), {
        x: 650, y: 681
    });
});

test('qd.java: bolhas ficam 10px acima dos corações', () => {
    assert.deepEqual(getMinecraft10HudIconPosition('air', 0, 1280, 720), {
        x: 722, y: 671
    });
    assert.deepEqual(getMinecraft10HudIconPosition('air', 9, 1280, 720), {
        x: 650, y: 671
    });
});


test('mg.java: tooltip usa os nomes localizados dos itens do Minecraft 1.0', () => {
    assert.equal(getMinecraft10ItemTooltipName(2), 'Grass Block');
    assert.equal(getMinecraft10ItemTooltipName(4), 'Cobblestone');
    assert.equal(getMinecraft10ItemTooltipName(318), 'Flint');
    assert.equal(getMinecraft10ItemTooltipName(999), 'Item 999');
});
