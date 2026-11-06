const SIZE = 16;
const HEIGHT = 128;
const VOLUME = SIZE * SIZE * HEIGHT;
const CHUNK_WIDTH = SIZE * HEIGHT;
const WATER = new Set([8, 9]);
const NON_OPAQUE = new Set([0, 6, 18, 20, 31, 32, 37, 38, 39, 40, 50, 51, 55, 59, 63, 65, 66, 68, 69, 75, 76, 78, 83, 90]);

function opacity(id) {
    if (id == null || id === 0) return 0;
    if (WATER.has(id) || id === 79) return 3;
    if (id === 18 || id === 30) return 1;
    return NON_OPAQUE.has(id) ? 0 : 15;
}

function emission(id) {
    switch (id) {
        case 10: case 11: return 15;
        case 50: return 14;
        case 51: return 15;
        case 62: return 13;
        case 74: return 9;
        case 76: return 7;
        case 89: case 91: return 15;
        case 90: return 11;
        case 94: return 9;
        default: return 0;
    }
}

const indexOf = (x, z, y) => x * CHUNK_WIDTH + z * HEIGHT + y;

// Iluminação inicial completa dentro do chunk. A luz solar entra pelo topo
// e também se propaga lateralmente por cavernas, encostas e saliências.
// O cálculo global posterior conecta a iluminação entre chunks vizinhos.
export function initializeChunkLighting(chunk) {
    const blocks = chunk.blocks;
    const sky = new Uint8Array(VOLUME);
    const block = new Uint8Array(VOLUME);
    const queue = [];

    // Luz solar direta e fontes emissoras.
    for (let x = 0; x < SIZE; x++) {
        for (let z = 0; z < SIZE; z++) {
            let level = 15;
            for (let y = HEIGHT - 1; y >= 0; y--) {
                const i = indexOf(x, z, y);
                const op = opacity(blocks[i]);
                if (op >= 15) level = 0;
                else if (op > 0) level = Math.max(0, level - op);
                if (level > sky[i]) {
                    sky[i] = level;
                    if (level > 1) queue.push(i);
                }
            }
        }
    }

    for (let i = 0; i < VOLUME; i++) {
        const level = emission(blocks[i]);
        if (level > block[i]) {
            block[i] = level;
            if (level > 1) queue.push(i);
        }
    }

    // Propaga os dois tipos de luz nos seis sentidos, sem sair deste chunk.
    const dirs = [-CHUNK_WIDTH, CHUNK_WIDTH, -HEIGHT, HEIGHT, -1, 1];
    let head = 0;
    while (head < queue.length) {
        const i = queue[head++];
        const x = Math.floor(i / CHUNK_WIDTH);
        const rem = i - x * CHUNK_WIDTH;
        const z = Math.floor(rem / HEIGHT);
        const y = rem - z * HEIGHT;
        const skyLevel = sky[i];
        const blockLevel = block[i];

        for (let d = 0; d < dirs.length; d++) {
            const nx = x + (d < 2 ? (d === 0 ? -1 : 1) : 0);
            const nz = z + (d >= 2 && d < 4 ? (d === 2 ? -1 : 1) : 0);
            const ny = y + (d >= 4 ? (d === 4 ? -1 : 1) : 0);
            if (nx < 0 || nx >= SIZE || nz < 0 || nz >= SIZE || ny < 0 || ny >= HEIGHT) continue;

            const ni = i + dirs[d];
            const op = opacity(blocks[ni]);
            if (op >= 15) continue;
            const attenuation = Math.max(1, op);
            let changed = false;

            if (skyLevel > 1) {
                const next = skyLevel - attenuation;
                if (next > sky[ni]) {
                    sky[ni] = next;
                    changed = true;
                }
            }
            if (blockLevel > 1) {
                const next = blockLevel - attenuation;
                if (next > block[ni]) {
                    block[ni] = next;
                    changed = true;
                }
            }
            if (changed) queue.push(ni);
        }
    }

    chunk.skyLight = sky;
    chunk.blockLight = block;
}

// Recalcula a luz solar direta da coluna alterada no mesmo frame da quebra.
export function refreshSkyLightColumn(chunk, localX, localZ) {
    if (!chunk.skyLight) chunk.skyLight = new Uint8Array(VOLUME);
    let level = 15;
    for (let y = HEIGHT - 1; y >= 0; y--) {
        const i = indexOf(localX, localZ, y);
        const op = opacity(chunk.blocks[i]);
        if (op >= 15) level = 0;
        else if (op > 0) level = Math.max(0, level - op);
        chunk.skyLight[i] = level;
    }
}

function locate(chunks, cx, cz, x, z) {
    if (x < 0) { cx--; x += SIZE; }
    else if (x >= SIZE) { cx++; x -= SIZE; }
    if (z < 0) { cz--; z += SIZE; }
    else if (z >= SIZE) { cz++; z -= SIZE; }
    const chunk = chunks.get(`${cx},${cz}`);
    return chunk ? { chunk, index: indexOf(x, z, 0) } : null;
}

/**
 * Tarefa incremental: processa pequenos lotes por frame para não congelar
 * a thread de renderização mesmo em distâncias grandes (Far).
 */
export function* createWorldLightingTask(entries, publishEntries = null) {
    const chunks = new Map();
    const skyBuffers = new Map();
    const blockBuffers = new Map();
    for (const entry of entries) {
        const chunk = entry.chunk ?? entry;
        chunks.set(`${chunk.chunkX},${chunk.chunkZ}`, chunk);
        // Calcula em buffers temporários: a iluminação atual continua visível
        // até que o recálculo inteiro esteja concluído.
        skyBuffers.set(chunk, new Uint8Array(VOLUME));
        blockBuffers.set(chunk, new Uint8Array(VOLUME));
    }
    if (!chunks.size) return;

    const chunkList = [...chunks.values()];
    const chunkIndex = new Map(chunkList.map((chunk, i) => [chunk, i]));
    const queue = [];
    const YIELD_EVERY = 4096;
    let work = 0;

    // Inicialização da luz solar direta e dos emissores.
    for (let ci = 0; ci < chunkList.length; ci++) {
        const chunk = chunkList[ci];
        const blocks = chunk.blocks;
        const sky = skyBuffers.get(chunk);
        const block = blockBuffers.get(chunk);
        for (let x = 0; x < SIZE; x++) {
            for (let z = 0; z < SIZE; z++) {
                let level = 15;
                for (let y = HEIGHT - 1; y >= 0; y--) {
                    const i = indexOf(x, z, y);
                    const op = opacity(blocks[i]);
                    if (op >= 15) level = 0;
                    else if (op > 0) level = Math.max(0, level - op);
                    if (level > sky[i]) {
                        sky[i] = level;
                        if (level > 1) queue.push(ci * VOLUME + i);
                    }
                    if (++work >= YIELD_EVERY) { work = 0; yield; }
                }
            }
        }
        for (let i = 0; i < VOLUME; i++) {
            const level = emission(blocks[i]);
            if (level > block[i]) {
                block[i] = level;
                if (level > 1) queue.push(ci * VOLUME + i);
            }
            if (++work >= YIELD_EVERY) { work = 0; yield; }
        }
    }

    const dirs = [[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
    let head = 0;
    while (head < queue.length) {
        const node = queue[head++];
        const ci = Math.floor(node / VOLUME);
        const i = node - ci * VOLUME;
        const chunk = chunkList[ci];
        const x = Math.floor(i / CHUNK_WIDTH);
        const rem = i - x * CHUNK_WIDTH;
        const z = Math.floor(rem / HEIGHT);
        const y = rem - z * HEIGHT;
        const skyLevel = skyBuffers.get(chunk)[i];
        const blockLevel = blockBuffers.get(chunk)[i];

        for (const [dx, dy, dz] of dirs) {
            const ny = y + dy;
            if (ny < 0 || ny >= HEIGHT) continue;
            const target = locate(chunks, chunk.chunkX, chunk.chunkZ, x + dx, z + dz);
            if (!target) continue;
            const ni = target.index + ny;
            const targetChunk = target.chunk;
            const op = opacity(targetChunk.blocks[ni]);
            if (op >= 15) continue;
            const attenuation = Math.max(1, op);
            let changed = false;
            if (skyLevel > 1) {
                const next = skyLevel - attenuation;
                const targetSky = skyBuffers.get(targetChunk);
                if (next > targetSky[ni]) {
                    targetSky[ni] = next;
                    changed = true;
                }
            }
            if (blockLevel > 1) {
                const next = blockLevel - attenuation;
                const targetBlock = blockBuffers.get(targetChunk);
                if (next > targetBlock[ni]) {
                    targetBlock[ni] = next;
                    changed = true;
                }
            }
            if (changed) queue.push(chunkIndex.get(targetChunk) * VOLUME + ni);
        }
        if (++work >= YIELD_EVERY) { work = 0; yield; }
    }

    // Publica os novos buffers de uma só vez, sem quadro com iluminação zerada.
    const publishSet = publishEntries
        ? new Set([...publishEntries].map(entry => entry.chunk ?? entry))
        : null;
    for (const chunk of chunkList) {
        if (publishSet && !publishSet.has(chunk)) continue;
        chunk.skyLight = skyBuffers.get(chunk);
        chunk.blockLight = blockBuffers.get(chunk);
    }
}

export function rebuildWorldLighting(entries) {
    const task = createWorldLightingTask(entries);
    while (!task.next().done) {}
}

export function rebuildChunkSkyLight(chunk) {
    rebuildWorldLighting([chunk]);
    return chunk.skyLight;
}
