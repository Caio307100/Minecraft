from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path.cwd()
main_path = ROOT / 'main.js'
mesh_path = ROOT / 'terrain-mesher.mjs'
water_path = ROOT / 'water-simulation.mjs'

for path in (main_path, mesh_path):
    if not path.is_file():
        raise SystemExit(f'Arquivo não encontrado: {path.name}. Execute na pasta do projeto.')

main = main_path.read_text()
mesh = mesh_path.read_text()


def once(text, pattern, replacement, label, flags=0):
    result, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'{label}: esperado 1 trecho, encontrado {count}. Nenhum arquivo foi gravado.')
    return result


# --- main.js: módulo e metadados nibble-packed ---
water_import = "import { createWaterSimulation } from './water-simulation.mjs';"
if water_import not in main:
    main = once(
        main,
        r"(import\s*\{\s*createLegacyAudio\s*\}\s*from\s*['\"]\./legacy-audio\.mjs['\"];)",
        r"\1\n" + water_import,
        'Importação da simulação'
    )

# Cada chunk recebe 4 bits por bloco, como a classe up do JAR.
if 'chunk.metadata ??= new Uint8Array(16384);' not in main:
    main = once(
        main,
        r"(const chunk = chunkGenerator\.generateChunk\(\s*position\.x,\s*position\.z\s*\);)",
        r"\1\n\n            chunk.metadata ??= new Uint8Array(16384);",
        'Inicialização dos metadados dos chunks',
        re.S
    )

# Replace the former approximate BFS constructor, retaining the existing chunk mesh callback.
constructor = r'''    const waterSimulation = createWaterSimulation({
        getBlock: getWorldBlock,
        getMetadata: getWorldMetadata,
        setCell: setWorldCell,
        getChunks: () => loadedChunks.values(),
        onChanged(chunkKeys) {
            for (const key of chunkKeys) {
                const [cx, cz] = key.split(',').map(Number);
                rebuildNearbyMeshes(cx, cz);
            }
        }
    });'''
main = once(
    main,
    r"    const waterSimulation = createWaterSimulation\(\{[\s\S]*?^    \}\);",
    constructor,
    'Integração antiga da água',
    re.M
)

# Add metadata accessors after getWorldBlock.
metadata_helpers = r'''

    // O JAR usa um nibble (4 bits) por bloco. Índice: x*2048 + z*128 + y.
    function readChunkMetadata(entry, index) {
        const data = entry.chunk.metadata;
        if (!data) return 0;
        const byte = data[index >> 1] ?? 0;
        return (index & 1) ? ((byte >> 4) & 15) : (byte & 15);
    }

    function writeChunkMetadata(entry, index, value) {
        entry.chunk.metadata ??= new Uint8Array(16384);
        const data = entry.chunk.metadata;
        const byteIndex = index >> 1;
        const nibble = value & 15;
        if (index & 1) {
            data[byteIndex] = (data[byteIndex] & 0x0f) | (nibble << 4);
        } else {
            data[byteIndex] = (data[byteIndex] & 0xf0) | nibble;
        }
    }

    function getWorldMetadata(x, y, z) {
        if (y < 0 || y >= 128) return 0;
        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        const entry = loadedChunks.get(`${cx},${cz}`);
        if (!entry) return 0;
        const lx = x - cx * 16;
        const lz = z - cz * 16;
        return readChunkMetadata(entry, lx * 2048 + lz * 128 + y);
    }

    // Escrita interna usada pela física; o callback onChanged reconstrói a malha.
    function setWorldCell(x, y, z, blockId, metadata = 0) {
        if (y < 0 || y >= 128) return false;
        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        const entry = loadedChunks.get(`${cx},${cz}`);
        if (!entry) return false;
        const lx = x - cx * 16;
        const lz = z - cz * 16;
        const index = lx * 2048 + lz * 128 + y;
        entry.chunk.blocks[index] = blockId;
        writeChunkMetadata(entry, index, metadata);
        return true;
    }
'''
main = once(
    main,
    r"(    function getWorldBlock\(x, y, z\) \{[\s\S]*?\n    \})",
    r"\1" + metadata_helpers,
    'Funções de metadados',
    re.M
)

# Replace manual block writes so metadata is cleared and neighboring liquids receive a block update.
set_world_block = r'''    function setWorldBlock(x, y, z, blockId) {
        if (y < 0 || y >= 128) return false;

        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        const entry = loadedChunks.get(`${cx},${cz}`);
        if (!entry) return false;

        const lx = x - cx * 16;
        const lz = z - cz * 16;
        const index = lx * 2048 + lz * 128 + y;

        entry.chunk.blocks[index] = blockId;
        writeChunkMetadata(entry, index, 0);
        waterSimulation.notifyBlockChange(x, y, z);
        rebuildNearbyMeshes(cx, cz);
        return true;
    }'''
main = once(
    main,
    r"    function setWorldBlock\(x, y, z, blockId\) \{[\s\S]*?\n    \}",
    set_world_block,
    'Função de alteração de bloco',
    re.M
)

if 'waterSimulation.tick(now);' not in main:
    raise RuntimeError('Loop de renderização não chama waterSimulation.tick(now). Nenhum arquivo foi gravado.')
if 'waterSimulation.invalidate();' not in main:
    raise RuntimeError('Carregamento de chunks não invalida a simulação. Nenhum arquivo foi gravado.')

# --- terrain-mesher.mjs: altura da superfície baseada no metadado ---
if 'const FLOWING_WATER = 8;' not in mesh or 'const WATER = 9;' not in mesh:
    raise RuntimeError('IDs 8 e 9 da água não estão declarados em terrain-mesher.mjs. Nenhum arquivo foi gravado.')
if not re.search(r'\b8\s*:\s*\[205,\s*205,\s*206,\s*206,\s*206,\s*206\]', mesh):
    mesh = once(
        mesh,
        r"(const TEXTURES = \{)",
        r"\1\n    8: [205, 205, 206, 206, 206, 206],",
        'Textura da água corrente'
    )

# Read nibble metadata from the current chunk.
if 'function getLocalBlockMetadata' not in mesh:
    mesh = once(
        mesh,
        r"(    const blockAt = \(x, y, z\) => \{[\s\S]*?\n    \};)",
        r'''\1

    function getLocalBlockMetadata(x, z, y) {
        const index = x * 2048 + z * HEIGHT + y;
        const byte = chunk.metadata?.[index >> 1] ?? 0;
        return (index & 1) ? ((byte >> 4) & 15) : (byte & 15);
    }''',
        'Leitura de metadados na malha',
        re.M
    )

# Cache separate templates per liquid level; top and side vertices follow liquid height.
get_template = r'''    function getTemplate(blockId, face, metadata = 0) {
        const isLiquid = blockId === WATER || blockId === FLOWING_WATER;
        const level = metadata >= 8 ? 0 : (metadata & 7);
        const key = `${blockId}:${face.side}:${isLiquid ? level : 0}`;

        if (templates.has(key)) return templates.get(key);

        const textures = TEXTURES[blockId];
        if (!textures) {
            throw new Error(`Textura não mapeada: bloco ${blockId}`);
        }

        // agw.e(meta): meta 8..15 usa nível 0; altura = 1 - (nível+1)/9.
        const liquidBounds = isLiquid
            ? { ...bounds, maxY: 1 - (level + 1) / 9 }
            : bounds;

        const template = buildBlockMesh(spec, {
            bounds: liquidBounds,
            textureIndex: textures[face.side],
            shouldRenderFace: f => f.side === face.side
        });

        templates.set(key, template);
        return template;
    }'''
mesh = once(
    mesh,
    r"    function getTemplate\(blockId, face\) \{[\s\S]*?\n    \}",
    get_template,
    'Template da malha líquida',
    re.M
)

if 'const blockMeta = isWater ? getLocalBlockMetadata(x, z, y) : 0;' not in mesh:
    mesh = once(
        mesh,
        r"(            const isWater = blockId === WATER \|\| blockId === FLOWING_WATER;\n)",
        r"\1            const blockMeta = isWater ? getLocalBlockMetadata(x, z, y) : 0;\n",
        'Metadado do bloco de água'
    )
mesh = once(
    mesh,
    r"const template = getTemplate\(blockId, face\);",
    "const template = getTemplate(blockId, face, blockMeta);",
    'Uso do metadado na geometria'
)

# Verify existing block-face culling still treats both liquid IDs as transparent neighbors.
if 'neighbor !== FLOWING_WATER' not in mesh:
    raise RuntimeError('Culling de água corrente não encontrado. Nenhum arquivo foi gravado.')

# --- Original 1.0 liquid update algorithm (ahx/add/agw) ---
water_module = r'''// Port da lógica de água do Minecraft Java 1.0: ahx, add e agw.
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
'''

# All transformations succeeded in memory. Create backups and write atomically.
main_backup = ROOT / 'main.js.before-mc10-water-port.bak'
mesh_backup = ROOT / 'terrain-mesher.before-mc10-water-port.bak'
water_backup = ROOT / 'water-simulation.before-mc10-water-port.mjs'

shutil.copy2(main_path, main_backup)
shutil.copy2(mesh_path, mesh_backup)
if water_path.exists():
    shutil.copy2(water_path, water_backup)

for path, content in (
    (main_path, main),
    (mesh_path, mesh),
    (water_path, water_module),
):
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(content)
    temp.replace(path)

# Syntax-check JavaScript files when Node is available.
for name in ('main.js', 'terrain-mesher.mjs', 'water-simulation.mjs'):
    result = subprocess.run(['node', '--check', str(ROOT / name)], capture_output=True, text=True)
    if result.returncode:
        raise SystemExit(f'Erro de sintaxe em {name}:\n{result.stderr}')

print('Port da água 1.0 instalado.')
print('Metadados: 4 bits por bloco (compatível com up.java).')
print('Ticks: 20 TPS; água: 5 ticks por atualização (250 ms).')
print('Física: ahx.java + agw.java; fontes: add.java.')
print('Superfície: altura calculada pelo metadado 0..7 / 8..15.')
print('Backups criados: main.js.before-mc10-water-port.bak e terrain-mesher.before-mc10-water-port.bak')
