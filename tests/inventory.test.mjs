import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createInventory,
    addItemToInventory,
    removeItemFromSlot,
    swapInventorySlots
} from '../inventory.mjs';

test('inventário tem 36 slots vazios', () => {
    const inventory = createInventory();
    assert.equal(inventory.length, 36);
    assert.ok(inventory.every(slot => slot.id === 0 && slot.count === 0));
});

test('itens empilham até 64 e ocupam outro slot', () => {
    const inventory = createInventory();
    assert.equal(addItemToInventory(inventory, 3, 70), 70);
    assert.deepEqual(inventory[0], { id: 3, count: 64 });
    assert.deepEqual(inventory[1], { id: 3, count: 6 });
});

test('remover o último item limpa o slot', () => {
    const inventory = createInventory();
    addItemToInventory(inventory, 12, 1);
    assert.equal(removeItemFromSlot(inventory, 0), true);
    assert.deepEqual(inventory[0], { id: 0, count: 0 });
});

test('slots podem ser trocados', () => {
    const inventory = createInventory();
    addItemToInventory(inventory, 3, 2);
    addItemToInventory(inventory, 12, 5);
    assert.equal(swapInventorySlots(inventory, 0, 1), true);
    assert.deepEqual(inventory[0], { id: 12, count: 5 });
    assert.deepEqual(inventory[1], { id: 3, count: 2 });
});
