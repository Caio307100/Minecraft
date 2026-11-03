/**
 * Port dos sistemas de sobrevivência de Minecraft Java 1.0.0.
 * Referências do JAR decompilado: eq (FoodStats), x (InventoryPlayer),
 * dk (ItemStack) e ih (EntityItem). As regras abaixo preservam as
 * operações observáveis dessas classes para os itens/blocos suportados
 * pelo projeto de navegador.
 */

const MAX_HEALTH = 20;
const MAX_FOOD = 20;
const MAX_STACK = 64;
const ITEM_DESPAWN_TICKS = 6000;
const ITEM_PICKUP_DELAY = 10; // yy.a(...): drops de bloco
const PLAYER_DROP_PICKUP_DELAY = 40; // vi.a(dk,...)

export class FoodStatsMC10 {
    constructor() {
        this.foodLevel = 20;
        this.saturationLevel = 5;
        this.exhaustionLevel = 0;
        this.foodTickTimer = 0;
        this.previousFoodLevel = 20;
    }

    /** eq.a(food, saturationModifier) */
    addFoodStats(food, saturationModifier) {
        this.foodLevel = Math.min(food + this.foodLevel, MAX_FOOD);
        this.saturationLevel = Math.fround(Math.min(
            Math.fround(
                this.saturationLevel +
                Math.fround(Math.fround(food * saturationModifier) * 2)
            ),
            this.foodLevel
        ));
    }

    /** eq.a(float): exhaustion is capped at 40. */
    addExhaustion(amount) {
        this.exhaustionLevel = Math.fround(Math.min(
            Math.fround(this.exhaustionLevel + amount),
            40
        ));
    }

    /**
     * eq.a(vi), called once per 20 TPS world tick.
     * difficulty: 0 peaceful, 1 easy, 2 normal, 3 hard.
     */
    tick({ health, difficulty = 2, heal, damage }) {
        this.previousFoodLevel = this.foodLevel;

        if (this.exhaustionLevel > 4) {
            this.exhaustionLevel -= 4;
            if (this.saturationLevel > 0) {
                this.saturationLevel = Math.max(this.saturationLevel - 1, 0);
            } else if (difficulty > 0) {
                this.foodLevel = Math.max(this.foodLevel - 1, 0);
            }
        }

        if (this.foodLevel >= 18 && health > 0 && health < MAX_HEALTH) {
            this.foodTickTimer++;
            if (this.foodTickTimer >= 80) {
                heal(1);
                this.foodTickTimer = 0;
            }
        } else if (this.foodLevel <= 0) {
            this.foodTickTimer++;
            if (this.foodTickTimer >= 80) {
                if (
                    health > 10 ||
                    difficulty >= 3 ||
                    (health > 1 && difficulty >= 2)
                ) {
                    damage(1, 'starve');
                }
                this.foodTickTimer = 0;
            }
        } else {
            this.foodTickTimer = 0;
        }
    }

    isFoodLevelNotFull() {
        return this.foodLevel < MAX_FOOD;
    }
}

export class ItemStackMC10 {
    constructor(id, count = 1, damage = 0, maxStackSize = MAX_STACK) {
        if (!Number.isInteger(id) || id <= 0 || id > 32767) {
            throw new RangeError(`ID de item inválido: ${id}`);
        }
        if (!Number.isInteger(count) || count < 0) {
            throw new RangeError(`Quantidade inválida: ${count}`);
        }
        this.id = id;
        this.count = count;
        this.damage = damage | 0;
        this.maxStackSize = maxStackSize;
    }

    copy() {
        return new ItemStackMC10(
            this.id,
            this.count,
            this.damage,
            this.maxStackSize
        );
    }

    isStackableWith(other) {
        return !!other &&
            this.id === other.id &&
            this.damage === other.damage &&
            this.maxStackSize > 1 &&
            other.maxStackSize > 1;
    }
}

/** x (InventoryPlayer): 36 main slots, 4 armor slots and selected hotbar slot. */
export class InventoryPlayerMC10 {
    constructor() {
        this.main = new Array(36).fill(null);
        this.armor = new Array(4).fill(null);
        this.currentItem = 0;
    }

    getCurrentItem() {
        return this.currentItem >= 0 && this.currentItem < 9
            ? this.main[this.currentItem]
            : null;
    }

    getStack(slot) {
        if (!Number.isInteger(slot) || slot < 0 || slot >= 40) return null;
        return slot < 36 ? this.main[slot] : this.armor[slot - 36];
    }

    setStack(slot, stack) {
        if (!Number.isInteger(slot) || slot < 0 || slot >= 40) {
            throw new RangeError(`Slot inválido: ${slot}`);
        }
        const value = stack === null ? null : stack.copy();
        if (slot < 36) this.main[slot] = value;
        else this.armor[slot - 36] = value;
    }

    /** x.a(int): scrolls the selected slot by exactly one position. */
    changeCurrentItem(direction) {
        const step = direction > 0 ? 1 : direction < 0 ? -1 : 0;
        this.currentItem = (this.currentItem - step + 9) % 9;
        return this.currentItem;
    }

    selectHotbar(slot) {
        if (!Number.isInteger(slot) || slot < 0 || slot > 8) return false;
        this.currentItem = slot;
        return true;
    }

    /** x.g(id): first matching stack in the 36 main inventory slots. */
    findSlot(id) {
        return this.main.findIndex(stack => stack?.id === id);
    }

    /** x.l(): first empty main inventory slot. */
    firstEmptySlot() {
        return this.main.findIndex(stack => stack === null || stack.count <= 0);
    }

    /** x.d(ItemStack): first compatible stack with room. */
    findMergeSlot(item) {
        return this.main.findIndex(stack =>
            stack &&
            stack.isStackableWith(item) &&
            stack.count < Math.min(stack.maxStackSize, MAX_STACK)
        );
    }

    /**
     * x.e(ItemStack) + x.a(ItemStack): merges into existing stacks first,
     * then fills empty slots. Returns true if any quantity was inserted.
     * The passed stack is reduced by the inserted amount, like dk.a.
     */
    addItemStack(item) {
        if (!(item instanceof ItemStackMC10) || item.count <= 0) return false;
        const originalCount = item.count;

        while (item.count > 0) {
            let slot = item.maxStackSize === 1
                ? this.firstEmptySlot()
                : this.findMergeSlot(item);

            if (slot < 0) slot = this.firstEmptySlot();
            if (slot < 0) break;

            if (!this.main[slot]) {
                const amount = Math.min(item.count, item.maxStackSize, MAX_STACK);
                this.main[slot] = new ItemStackMC10(
                    item.id,
                    amount,
                    item.damage,
                    item.maxStackSize
                );
                item.count -= amount;
                continue;
            }

            const target = this.main[slot];
            if (!target.isStackableWith(item)) break;

            const capacity = Math.min(target.maxStackSize, MAX_STACK) - target.count;
            const amount = Math.min(item.count, capacity);
            if (amount <= 0) break;
            target.count += amount;
            item.count -= amount;
        }

        return item.count < originalCount;
    }

    /** x.b(id): consume one item from the first matching main slot. */
    consumeItem(id) {
        const slot = this.findSlot(id);
        if (slot < 0) return false;
        const stack = this.main[slot];
        stack.count--;
        if (stack.count <= 0) this.main[slot] = null;
        return true;
    }

    consumeSelected(amount = 1) {
        const stack = this.getCurrentItem();
        if (!stack || amount <= 0 || stack.count < amount) return false;
        stack.count -= amount;
        if (stack.count <= 0) this.main[this.currentItem] = null;
        return true;
    }

    hasItem(id) {
        return this.findSlot(id) >= 0;
    }

    /** x.a(slot, amount): removes an exact amount from main/armor slots. */
    removeStackFromSlot(slot, amount) {
        const stack = this.getStack(slot);
        if (!stack || amount <= 0) return null;

        const removed = Math.min(stack.count, amount);
        const result = stack.copy();
        result.count = removed;
        stack.count -= removed;

        if (stack.count <= 0) {
            if (slot < 36) this.main[slot] = null;
            else this.armor[slot - 36] = null;
        }

        return result;
    }

    /** x.g(): extracts every stack for death drops. */
    takeAllStacks() {
        const result = [];
        for (let slot = 0; slot < 40; slot++) {
            const stack = this.removeStackFromSlot(slot, 64);
            if (stack) result.push(stack);
        }
        return result;
    }

    getTotalSlots() {
        return 40;
    }
}

/**
 * ih (EntityItem): item entity with original gravity, drag, bounce,
 * pickup delay and 6000-tick despawn age.
 */
export class DroppedItemMC10 {
    constructor(stack, position, velocity = [0, 0.2, 0], pickupDelay = ITEM_PICKUP_DELAY) {
        this.stack = stack.copy();
        this.x = position[0];
        this.y = position[1]; // bottom of the item AABB
        this.z = position[2];
        this.vx = velocity[0];
        this.vy = velocity[1];
        this.vz = velocity[2];
        this.pickupDelay = pickupDelay;
        this.age = 0;
        this.health = 5;
        this.dead = false;
        this.width = 0.25;
        this.height = 0.25;
        this.onGround = false;
        this.spin = Math.random() * Math.PI * 2;
        this.pickupAnimation = null;
    }

    tick({
        getBlock,
        inventory,
        playerFeet,
        playerRadius = 0.3,
        playerHeight = 1.8,
        allowPickup = true
    }) {
        if (this.dead) return;

        // Animação de coleta: aproxima o item suavemente antes de adicioná-lo.
        if (this.pickupAnimation) {
            const animation = this.pickupAnimation;
            animation.elapsed++;
            const t = Math.min(1, animation.elapsed / animation.duration);
            const eased = 1 - (1 - t) * (1 - t);
            this.x = animation.from[0] + (playerFeet[0] - animation.from[0]) * eased;
            this.y = animation.from[1] + (playerFeet[1] + 1.0 - animation.from[1]) * eased;
            this.z = animation.from[2] + (playerFeet[2] - animation.from[2]) * eased;
            this.spin += 0.1;
            if (t >= 1) {
                inventory.addItemStack(this.stack);
                if (this.stack.count <= 0) this.dead = true;
                else {
                    this.pickupAnimation = null;
                    this.pickupDelay = 10;
                }
            }
            return;
        }

        if (this.pickupDelay > 0) this.pickupDelay--;

        this.age++;
        if (this.age >= ITEM_DESPAWN_TICKS) {
            this.dead = true;
            return;
        }

        // ih.a(): gravity before movement.
        this.vy -= 0.04;
        this.onGround = false;

        const solidAt = (x, y, z) => {
            const id = getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
            return id !== null && id !== 0 && id !== 8 && id !== 9;
        };

        // Axis-separated movement; it mirrors the item entity's collision response.
        const nextX = this.x + this.vx;
        if (!solidAt(nextX, this.y + 0.05, this.z)) this.x = nextX;
        else this.vx = 0;

        const nextZ = this.z + this.vz;
        if (!solidAt(this.x, this.y + 0.05, nextZ)) this.z = nextZ;
        else this.vz = 0;

        const nextY = this.y + this.vy;
        if (this.vy <= 0 && solidAt(this.x, nextY - 0.001, this.z)) {
            this.y = Math.floor(nextY - 0.001) + 1.001;
            this.vy *= -0.5;
            this.onGround = true;
        } else if (this.vy > 0 && solidAt(this.x, nextY + this.height, this.z)) {
            this.y = Math.floor(nextY + this.height) - this.height - 0.001;
            this.vy = 0;
        } else {
            this.y = nextY;
        }

        let friction = 0.98;
        if (this.onGround) {
            const under = getBlock(
                Math.floor(this.x),
                Math.floor(this.y - 0.02),
                Math.floor(this.z)
            );
            const slipperiness = under === 79 ? 0.98 : 0.6;
            friction = slipperiness * 0.98;
        }

        this.vx *= friction;
        this.vy *= 0.98;
        this.vz *= friction;
        this.spin += 0.1;

        if (allowPickup && this.pickupDelay === 0) {
            const insidePlayer =
                Math.abs(this.x - playerFeet[0]) < playerRadius + 1.0 &&
                Math.abs(this.z - playerFeet[2]) < playerRadius + 1.0 &&
                this.y + this.height > playerFeet[1] &&
                this.y < playerFeet[1] + playerHeight;

            if (insidePlayer) {
                this.pickupAnimation = {
                    from: [this.x, this.y, this.z],
                    elapsed: 0,
                    duration: 7
                };
                this.vx = 0;
                this.vy = 0;
                this.vz = 0;
            }
        }
    }
}

/**
 * Block drops supported by the blocks present in this browser project.
 * Mappings are taken from each block's getItemDropped implementation:
 * gm (stone), jb (grass), agd (dirt), cj/kb (sand/gravel), ez (mycelium),
 * ahq (ice). Tool-required blocks correctly produce no drop with an empty hand.
 */
export function getMinecraft10BlockDrop(blockId, random = Math.random, metadata = 0) {
    switch (blockId) {
        case 1: // gm.a(): cobblestone; requires a harvest-capable pickaxe
        case 7: // bedrock: unbreakable in survival
        case 24: // sandstone: rock material; requires a pickaxe
        case 79: // ahq.a(Random): 0 unless silk touch
            return null;
        case 2: // jb.a(): dirt
        case 3: // agd inherits the default self-drop
            return new ItemStackMC10(3, 1);
        case 12: // sand
            return new ItemStackMC10(12, 1);
        case 17: // log: preserves the wood variant metadata
            return new ItemStackMC10(17, 1, metadata & 3);
        case 18: // leaves do not drop the leaf block without Silk Touch
            return null;
        case 13: // kb: 1/10 flint, otherwise gravel (fortune 0)
            return new ItemStackMC10(random() < 0.1 ? 318 : 13, 1);
        case 110: // ez.a(): dirt
            return new ItemStackMC10(3, 1);
        default:
            return null;
    }
}

/** vi.a(dk,false): block/player drop velocity in look direction. */
export function createPlayerDrop(stack, { x, y, z, yaw, pitch, random = Math.random }) {
    const speed = 0.3;
    const yawRad = yaw;
    const pitchRad = pitch;
    let vx = -Math.sin(yawRad) * Math.cos(pitchRad) * speed;
    // O port usa yaw=0 olhando para -Z; adapta o eixo Z do JAR.
    let vz = -Math.cos(yawRad) * Math.cos(pitchRad) * speed;
    let vy = -Math.sin(pitchRad) * speed + 0.1;

    const spread = 0.02 * random();
    const angle = random() * Math.PI * 2;
    vx += Math.cos(angle) * spread;
    vz += Math.sin(angle) * spread;
    vy += (random() - random()) * 0.1;

    // O JAR aplica essa velocidade diretamente no olhar do jogador.
    // Antecipamos a posição em um passo para o item já aparecer à frente,
    // sem ficar visualmente sobreposto ao corpo no primeiro frame.
    const spawnX = x + vx;
    const spawnY = y + vy;
    const spawnZ = z + vz;
    return new DroppedItemMC10(stack, [spawnX, spawnY, spawnZ], [vx, vy, vz], PLAYER_DROP_PICKUP_DELAY);
}

/** yy.a(world,x,y,z,stack): randomized block-drop position and 10-tick delay. */
export function createBlockDrop(stack, x, y, z, random = Math.random) {
    const spread = 0.7;
    const px = x + random() * spread + (1 - spread) * 0.5;
    const py = y + random() * spread + (1 - spread) * 0.5;
    const pz = z + random() * spread + (1 - spread) * 0.5;
    return new DroppedItemMC10(
        stack,
        [px, py, pz],
        [random() * 0.2 - 0.1, 0.2, random() * 0.2 - 0.1],
        ITEM_PICKUP_DELAY
    );
}

export const SURVIVAL_MC10_CONSTANTS = Object.freeze({
    maxHealth: MAX_HEALTH,
    maxFood: MAX_FOOD,
    maxStack: MAX_STACK,
    itemDespawnTicks: ITEM_DESPAWN_TICKS,
    itemPickupDelay: ITEM_PICKUP_DELAY,
    playerDropPickupDelay: PLAYER_DROP_PICKUP_DELAY,
    tickMilliseconds: 50,
    ticksPerSecond: 20
});
