export const INVENTORY_SIZE = 36;
export const HOTBAR_SIZE = 9;
export const MAX_STACK_SIZE = 64;

export function createInventory(size = INVENTORY_SIZE) {
    if (!Number.isInteger(size) || size < HOTBAR_SIZE) {
        throw new RangeError('Inventário precisa ter pelo menos 9 slots.');
    }
    return Array.from({ length: size }, () => ({ id: 0, count: 0 }));
}

export function addItemToInventory(slots, id, count = 1, maxStack = MAX_STACK_SIZE) {
    if (!Array.isArray(slots) || !Number.isInteger(id) || id <= 0 ||
        !Number.isInteger(count) || count <= 0) return 0;

    let remaining = count;
    for (const slot of slots) {
        if (slot.id !== id || slot.count >= maxStack) continue;
        const added = Math.min(remaining, maxStack - slot.count);
        slot.count += added;
        remaining -= added;
        if (remaining === 0) return count;
    }

    for (const slot of slots) {
        if (slot.id !== 0 || slot.count !== 0) continue;
        const added = Math.min(remaining, maxStack);
        slot.id = id;
        slot.count = added;
        remaining -= added;
        if (remaining === 0) return count;
    }

    return count - remaining;
}

export function removeItemFromSlot(slots, index, count = 1) {
    const slot = slots?.[index];
    if (!slot || !Number.isInteger(count) || count <= 0 || slot.count < count) {
        return false;
    }
    slot.count -= count;
    if (slot.count === 0) slot.id = 0;
    return true;
}

export function swapInventorySlots(slots, first, second) {
    if (!slots?.[first] || !slots?.[second]) return false;
    const firstSlot = slots[first];
    const secondSlot = slots[second];
    const saved = { id: firstSlot.id, count: firstSlot.count };
    firstSlot.id = secondSlot.id;
    firstSlot.count = secondSlot.count;
    secondSlot.id = saved.id;
    secondSlot.count = saved.count;
    return true;
}

export function clearInventory(slots) {
    for (const slot of slots) {
        slot.id = 0;
        slot.count = 0;
    }
}
