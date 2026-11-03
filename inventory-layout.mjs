/**
 * Layout do inventário do Minecraft Java 1.0 (gd.java / hw.java).
 * Coordenadas relativas ao painel original de 176x166 pixels.
 */
export const MC10_INVENTORY_WIDTH = 176;
export const MC10_INVENTORY_HEIGHT = 166;

export function getMinecraft10InventoryLayout() {
    const slots = [];

    // Armor slots: inventory indices 39..36, helmet through boots.
    for (let row = 0; row < 4; row++) {
        slots.push({
            type: 'inventory',
            area: 'armor',
            slot: 39 - row,
            x: 8,
            y: 8 + row * 18
        });
    }

    // 2x2 crafting input from gd.java.
    for (let row = 0; row < 2; row++) {
        for (let column = 0; column < 2; column++) {
            slots.push({
                type: 'crafting',
                slot: row * 2 + column,
                x: 88 + column * 18,
                y: 26 + row * 18
            });
        }
    }

    // Main inventory: indices 9..35.
    for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 9; column++) {
            slots.push({
                type: 'inventory',
                area: 'main',
                slot: 9 + row * 9 + column,
                x: 8 + column * 18,
                y: 84 + row * 18
            });
        }
    }

    // Hotbar: indices 0..8.
    for (let column = 0; column < 9; column++) {
        slots.push({
            type: 'inventory',
            area: 'hotbar',
            slot: column,
            x: 8 + column * 18,
            y: 142
        });
    }

    return slots;
}

/** Coordinates copied from qd.java: 9px icon, 8px horizontal pitch. */
export function getMinecraft10HudIconPosition(kind, index, screenWidth, screenHeight) {
    if (!['health', 'food', 'air'].includes(kind)) {
        throw new RangeError(`Tipo de HUD inválido: ${kind}`);
    }
    if (!Number.isInteger(index) || index < 0 || index >= 10) {
        throw new RangeError(`Índice de ícone inválido: ${index}`);
    }

    const centerLeft = screenWidth / 2 - 91;
    const rightAnchor = screenWidth / 2 + 91;

    if (kind === 'health') {
        return { x: centerLeft + index * 8, y: screenHeight - 39 };
    }

    return {
        x: rightAnchor - index * 8 - 9,
        y: screenHeight - (kind === 'air' ? 49 : 39)
    };
}


// Names from lang/en_US.lang in Minecraft 1.0, for items currently supported by the port.
const MC10_ITEM_NAMES = Object.freeze({
    1: 'Stone',
    2: 'Grass Block',
    3: 'Dirt',
    4: 'Cobblestone',
    7: 'Bedrock',
    12: 'Sand',
    13: 'Gravel',
    17: 'Wood',
    24: 'Sandstone',
    79: 'Ice',
    110: 'Mycelium',
    318: 'Flint'
});

export function getMinecraft10ItemTooltipName(itemId) {
    return MC10_ITEM_NAMES[itemId] ?? `Item ${itemId}`;
}
