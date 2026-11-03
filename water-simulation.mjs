// Port da lógica de água do Minecraft Java 1.0: ahx, add e agw.
// IDs: 8 = flowing water; 9 = still water. Metadados: nibble 0..15.
const AIR = 0;
const FLOWING = 8;
const STILL = 9;
const HEIGHT = 128;
const SIZE = 16;
const TICK_MS = 50; // 20 ticks por segundo
const WATER_TICK_RATE = 5; // agw.d() no JAR

const HORIZONTAL = [
    [-1, 0], [1, 0], [0, -1], [0, 1]
];
const AROUND = [
    [-1, 0, 0], [1, 0, 0], [0, -1, 0],
    [0, 1, 0], [0, 0, -1], [0, 0, 1]
];
const OPPOSITE = [1, 0, 3, 2];

export function createWaterSimulation({
    getBlock,
    getMetadata,
    setCell,
    getChunks,
    onChanged
}) {
    let worldTick = 0;
    let lastTime = null;
    let accumulator = 0;
    let sequence = 0;
    const queue = [];
    const scheduled = new Map();

    const keyOf = (x, y, z, id) => `${x},${y},${z},${id}`;
    const chunkKey = (x, z) => `${Math.floor(x / SIZE)},${Math.floor(z / SIZE)}`;
    const isWater = id => id === FLOWING || id === STILL;

    // Pequena heap: eventos são processados por horário e ordem de inserção,
    // como a TreeSet de ahn no mundo original.
    function eventBefore(a, b) {
        return a.due < b.due || (a.due === b.due && a.sequence < b.sequence);
    }

    function heapPush(event) {
        queue.push(event);
        let i = queue.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (!eventBefore(queue[i], queue[parent])) break;
            [queue[i], queue[parent]] = [queue[parent], queue[i]];
            i = parent;
        }
    }

    function heapPop() {
        if (!queue.length) return null;
        const first = queue[0];
        const last = queue.pop();
        if (queue.length) {
            queue[0] = last;
            let i = 0;
            while (true) {
                const left = i * 2 + 1;
                const right = left + 1;
                let smallest = i;
                if (left < queue.length && eventBefore(queue[left], queue[smallest])) smallest = left;
                if (right < queue.length && eventBefore(queue[right], queue[smallest])) smallest = right;
                if (smallest === i) break;
                [queue[i], queue[smallest]] = [queue[smallest], queue[i]];
                i = smallest;
            }
        }
        return first;
    }

    function schedule(x, y, z, blockId, delay = WATER_TICK_RATE) {
        if (y < 0 || y >= HEIGHT) return;
        const key = keyOf(x, y, z, blockId);
        if (scheduled.has(key)) return;
        const event = { x, y, z, blockId, due: worldTick + delay, sequence: sequence++, key };
        scheduled.set(key, event);
        heapPush(event);
    }

    function mark(changed, x, z) {
        changed.add(chunkKey(x, z));
    }

    function write(x, y, z, id, metadata, changed) {
        if (!setCell(x, y, z, id, metadata & 15)) return false;
        mark(changed, x, z);
        return true;
    }

    // No JAR, l(): bloco sólido impede o líquido. Chunks ainda não carregados
    // são tratados como bloqueio para a água não sumir na borda do streaming.
    function blocksFlow(id) {
        return id === null || (id !== AIR && !isWater(id));
    }

    function replaceable(id) {
        return id === AIR;
    }

    function liquidLevel(x, y, z) {
        const id = getBlock(x, y, z);
        return isWater(id) ? (getMetadata(x, y, z) & 15) : -1;
    }

    function wakeAt(x, y, z, changed) {
        const id = getBlock(x, y, z);
        if (id === STILL) {
            const meta = getMetadata(x, y, z);
            if (write(x, y, z, FLOWING, meta, changed)) {
                schedule(x, y, z, FLOWING);
            }
        } else if (id === FLOWING) {
            schedule(x, y, z, FLOWING);
        }
    }

    function wakeNeighbors(x, y, z, changed) {
        for (const [dx, dy, dz] of AROUND) {
            wakeAt(x + dx, y + dy, z + dz, changed);
        }
    }

    function notifyBlockChange(x, y, z) {
        const changed = new Set();
        wakeAt(x, y, z, changed);
        wakeNeighbors(x, y, z, changed);
        if (changed.size) onChanged(changed);
    }

    function setFlowing(x, y, z, metadata, changed) {
        if (!replaceable(getBlock(x, y, z))) return false;
        if (!write(x, y, z, FLOWING, metadata, changed)) return false;
        schedule(x, y, z, FLOWING);
        wakeNeighbors(x, y, z, changed);
        return true;
    }

    // ahx.c(): procura a menor distância horizontal até uma queda,
    // com profundidade máxima de quatro blocos e sem voltar pelo caminho.
    function downwardPathCost(x, y, z, depth, cameFrom) {
        let best = 1000;

        for (let direction = 0; direction < 4; direction++) {
            if (cameFrom !== -1 && direction === OPPOSITE[cameFrom]) continue;

            const [dx, dz] = HORIZONTAL[direction];
            const nx = x + dx;
            const nz = z + dz;
            const neighbor = getBlock(nx, y, nz);

            if (blocksFlow(neighbor)) continue;
            if (isWater(neighbor) && liquidLevel(nx, y, nz) === 0) continue;

            if (!blocksFlow(getBlock(nx, y - 1, nz))) return depth;
            if (depth >= 4) continue;

            const cost = downwardPathCost(nx, y, nz, depth + 1, direction);
            if (cost < best) best = cost;
        }

        return best;
    }

    // ahx.k(): seleciona todas as direções que compartilham o menor custo.
    function bestFlowDirections(x, y, z) {
        const costs = [1000, 1000, 1000, 1000];
        let minimum = 1000;

        for (let direction = 0; direction < 4; direction++) {
            const [dx, dz] = HORIZONTAL[direction];
            const nx = x + dx;
            const nz = z + dz;
            const neighbor = getBlock(nx, y, nz);

            if (blocksFlow(neighbor)) continue;
            if (isWater(neighbor) && liquidLevel(nx, y, nz) === 0) continue;

            costs[direction] = !blocksFlow(getBlock(nx, y - 1, nz))
                ? 0
                : downwardPathCost(nx, y, nz, 1, direction);

            if (costs[direction] < minimum) minimum = costs[direction];
        }

        return costs.map(cost => cost === minimum);
    }

    function updateFlowingWater(x, y, z, changed) {
        if (getBlock(x, y, z) !== FLOWING) return;

        let level = getMetadata(x, y, z) & 15;

        if (level > 0) {
            let lowest = 1000;
            let sourceNeighbors = 0;

            // ahx.f(): lê os quatro vizinhos; queda vertical conta como nível 0.
            for (const [dx, dz] of HORIZONTAL) {
                let neighborLevel = liquidLevel(x + dx, y, z + dz);
                if (neighborLevel < 0) continue;
                if (neighborLevel === 0) sourceNeighbors++;
                if (neighborLevel >= 8) neighborLevel = 0;
                if (neighborLevel < lowest) lowest = neighborLevel;
            }

            let nextLevel = lowest + 1;
            if (nextLevel >= 8 || lowest < 0) nextLevel = -1;

            const aboveLevel = liquidLevel(x, y + 1, z);
            if (aboveLevel >= 0) {
                nextLevel = aboveLevel >= 8 ? aboveLevel : aboveLevel + 8;
            }

            const below = getBlock(x, y - 1, z);
            // Regeneração infinita de água: duas fontes e apoio sólido,
            // ou água-fonte logo abaixo, como ahx.a().
            if (sourceNeighbors >= 2) {
                if (blocksFlow(below)) {
                    nextLevel = 0;
                } else if (isWater(below) && level === 0) {
                    nextLevel = 0;
                }
            }

            if (nextLevel !== level) {
                level = nextLevel;
                if (level < 0) {
                    write(x, y, z, AIR, 0, changed);
                    wakeNeighbors(x, y, z, changed);
                    return;
                }

                write(x, y, z, FLOWING, level, changed);
                schedule(x, y, z, FLOWING);
                wakeNeighbors(x, y, z, changed);
            } else {
                // ahx.j(): água corrente estabilizada vira água parada,
                // preservando o metadado.
                write(x, y, z, STILL, level, changed);
            }
        } else {
            // Metadado zero é uma fonte; ahx.j() converte ID 8 em ID 9.
            write(x, y, z, STILL, level, changed);
        }

        const below = getBlock(x, y - 1, z);

        // ahx: queda vertical primeiro; metadados 8..15 codificam queda.
        if (replaceable(below)) {
            const fallingLevel = level >= 8 ? level : level + 8;
            setFlowing(x, y - 1, z, fallingLevel, changed);
            return;
        }

        if (level < 0 || (level !== 0 && !blocksFlow(below))) return;

        let nextLevel = level + 1;
        if (level >= 8) nextLevel = 1;
        if (nextLevel >= 8) return;

        const directions = bestFlowDirections(x, y, z);
        for (let direction = 0; direction < 4; direction++) {
            if (!directions[direction]) continue;
            const [dx, dz] = HORIZONTAL[direction];
            setFlowing(x + dx, y, z + dz, nextLevel, changed);
        }
    }

    function processDueEvents() {
        const changed = new Set();
        let processed = 0;

        // ry.a(boolean): o JAR limita a 1000 atualizações por tick.
        while (queue.length && processed < 1000) {
            const event = queue[0];
            if (event.due > worldTick) break;
            heapPop();
            if (scheduled.get(event.key) !== event) continue;
            scheduled.delete(event.key);

            if (getBlock(event.x, event.y, event.z) !== event.blockId) continue;
            if (event.blockId === FLOWING) {
                updateFlowingWater(event.x, event.y, event.z, changed);
            }
            // ID 9 recebe tick, mas água parada não faz updateTick no JAR.
            processed++;
        }

        if (changed.size) onChanged(changed);
    }

    function invalidate() {
        // Chunk acabou de entrar no mundo: reavaliar líquidos correntes
        // que estavam agendados antes do streaming.
        for (const entry of getChunks()) {
            const blocks = entry.chunk.blocks;
            for (let i = 0; i < blocks.length; i++) {
                if (blocks[i] !== FLOWING) continue;
                const x = entry.chunkX * SIZE + Math.floor(i / 2048);
                const remainder = i % 2048;
                const z = entry.chunkZ * SIZE + Math.floor(remainder / HEIGHT);
                const y = remainder % HEIGHT;
                schedule(x, y, z, FLOWING);
            }
        }
    }

    function tick(now) {
        if (lastTime === null) {
            lastTime = now;
            return;
        }
        const elapsed = Math.max(0, Math.min(now - lastTime, 250));
        lastTime = now;
        accumulator += elapsed;

        let catchup = 0;
        while (accumulator >= TICK_MS && catchup < 5) {
            accumulator -= TICK_MS;
            worldTick++;
            processDueEvents();
            catchup++;
        }
    }

    return { tick, invalidate, notifyBlockChange };
}
