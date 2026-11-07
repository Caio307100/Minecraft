// Armazenamento de mundos do port (menu "Select world" do Minecraft 1.0).
//
// Cada mundo tem dois registros no IndexedDB:
//   worlds[id] -> metadados leves (nome, seed, datas) usados na lista;
//   saves[id]  -> o save em si (jogador, inventário, blocos alterados...).
// O terreno NÃO é salvo: ele é regenerado a partir da seed e as edições do
// jogador são aplicadas por cima (mesmo mecanismo de modifiedChunkBlocks).

export const SAVE_VERSION = 1;

const DB_NAME = 'minecraft-1-browser-worlds';
const DB_VERSION = 1;
const WORLDS_STORE = 'worlds';
const SAVES_STORE = 'saves';

const MAX_NAME_LENGTH = 32;
const INT64_MIN = -(1n << 63n);
const INT64_MAX = (1n << 63n) - 1n;

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

/** String.hashCode() do Java (UTF-16), usado pelo 1.0 para seeds não numéricas. */
export function javaStringHashCode(text) {
    let hash = 0;
    for (let index = 0; index < text.length; index++) {
        hash = (Math.imul(31, hash) + text.charCodeAt(index)) | 0;
    }
    return hash;
}

export function createRandomWorldSeed(randomValues = globalThis.crypto) {
    const words = new Uint32Array(2);
    if (randomValues?.getRandomValues) {
        randomValues.getRandomValues(words);
    } else {
        words[0] = Math.floor(Math.random() * 0x100000000);
        words[1] = Math.floor(Math.random() * 0x100000000);
    }
    return BigInt.asIntN(64, (BigInt(words[0]) << 32n) | BigInt(words[1]));
}

/**
 * GuiCreateWorld (1.0): vazio => seed aleatória; número (long) => esse valor
 * (0 também sorteia); qualquer outro texto => String.hashCode().
 */
export function parseSeedText(text, random = createRandomWorldSeed) {
    const trimmed = String(text ?? '').trim();
    if (trimmed === '') return random();

    if (/^[+-]?\d+$/.test(trimmed)) {
        const value = BigInt(trimmed);
        if (value >= INT64_MIN && value <= INT64_MAX) {
            return value === 0n ? random() : value;
        }
    }

    return BigInt(javaStringHashCode(trimmed));
}

/* ------------------------------------------------------------------ */
/* Nomes e ids                                                         */
/* ------------------------------------------------------------------ */

export function sanitizeWorldName(name) {
    const cleaned = String(name ?? '').trim().slice(0, MAX_NAME_LENGTH).trim();
    return cleaned === '' ? 'World' : cleaned;
}

/** Nome da "pasta" do mundo: tira caracteres proibidos e acrescenta "-" se já existir. */
export function makeWorldId(name, existingIds) {
    const taken = existingIds instanceof Set ? existingIds : new Set(existingIds ?? []);
    let id = sanitizeWorldName(name).replace(/[/\\:*?"<>|]/g, '_');
    while (taken.has(id)) id += '-';
    return id;
}

/* ------------------------------------------------------------------ */
/* (De)serialização de blocos alterados                                */
/* ------------------------------------------------------------------ */

/** Map<"cx,cz", Map<índice, {blockId, metadata}>> -> lista compacta com typed arrays. */
export function serializeModifiedChunks(modifiedChunkBlocks) {
    const chunks = [];
    for (const [key, changes] of modifiedChunkBlocks) {
        if (!changes || changes.size === 0) continue;
        const indices = new Int32Array(changes.size);
        const ids = new Uint16Array(changes.size);
        const metadata = new Uint8Array(changes.size);
        let cursor = 0;
        for (const [index, change] of changes) {
            indices[cursor] = index;
            ids[cursor] = change.blockId;
            metadata[cursor] = change.metadata & 15;
            cursor++;
        }
        chunks.push({ key, indices, ids, metadata });
    }
    return chunks;
}

export function deserializeModifiedChunks(chunks) {
    const result = new Map();
    if (!Array.isArray(chunks)) return result;
    for (const chunk of chunks) {
        if (!chunk || typeof chunk.key !== 'string') continue;
        const { indices, ids, metadata } = chunk;
        if (!indices || !ids || !metadata) continue;
        const changes = new Map();
        for (let cursor = 0; cursor < indices.length; cursor++) {
            changes.set(indices[cursor], {
                blockId: ids[cursor],
                metadata: metadata[cursor] & 15
            });
        }
        result.set(chunk.key, changes);
    }
    return result;
}

/* ------------------------------------------------------------------ */
/* Backends                                                            */
/* ------------------------------------------------------------------ */

/** Backend em memória: usado nos testes e quando o IndexedDB não está disponível. */
export function createMemoryBackend() {
    const worlds = new Map();
    const saves = new Map();
    return {
        persistent: false,
        async listMeta() { return [...worlds.values()].map(meta => ({ ...meta })); },
        async getMeta(id) { return worlds.has(id) ? { ...worlds.get(id) } : null; },
        async getSave(id) { return saves.has(id) ? structuredClone(saves.get(id)) : null; },
        async put(meta, save) {
            worlds.set(meta.id, { ...meta });
            if (save !== undefined) saves.set(meta.id, structuredClone(save));
        },
        async remove(id) { worlds.delete(id); saves.delete(id); }
    };
}

function request(idbRequest) {
    return new Promise((resolve, reject) => {
        idbRequest.onsuccess = () => resolve(idbRequest.result);
        idbRequest.onerror = () => reject(idbRequest.error);
    });
}

function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('Transação do IndexedDB abortada.'));
    });
}

function openDatabase() {
    return new Promise((resolve, reject) => {
        const opening = indexedDB.open(DB_NAME, DB_VERSION);
        opening.onupgradeneeded = () => {
            const db = opening.result;
            if (!db.objectStoreNames.contains(WORLDS_STORE)) {
                db.createObjectStore(WORLDS_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(SAVES_STORE)) {
                db.createObjectStore(SAVES_STORE);
            }
        };
        opening.onsuccess = () => resolve(opening.result);
        opening.onerror = () => reject(opening.error);
        opening.onblocked = () => reject(new Error('Banco de mundos bloqueado por outra aba.'));
    });
}

/** Backend do IndexedDB; cai para a memória (com aviso) se o navegador não permitir abrir o banco. */
export function createIndexedDbBackend() {
    let databasePromise = null;
    let fallback = null;

    function database() {
        if (!databasePromise) {
            databasePromise = (typeof indexedDB === 'undefined'
                ? Promise.reject(new Error('IndexedDB indisponível.'))
                : openDatabase());
        }
        return databasePromise;
    }

    async function use(operation) {
        if (fallback) return operation(fallback);
        let db;
        try {
            db = await database();
        } catch (error) {
            // Só a ABERTURA do banco justifica o fallback; erros de leitura/gravação
            // (cota, transação abortada) precisam chegar ao chamador.
            console.warn('IndexedDB indisponível; os mundos desta sessão ficarão só na memória:', error);
            fallback = createMemoryBackend();
            return operation(fallback);
        }
        return operation(db);
    }

    // `db` é o backend em memória (tem listMeta) ou um IDBDatabase.
    function dispatch(db, memoryCall, idbCall) {
        return db.listMeta ? memoryCall(db) : idbCall(db);
    }

    return {
        get persistent() { return fallback === null; },
        listMeta: () => use(db => dispatch(db,
            memory => memory.listMeta(),
            idb => request(idb.transaction(WORLDS_STORE, 'readonly').objectStore(WORLDS_STORE).getAll()))),
        getMeta: id => use(db => dispatch(db,
            memory => memory.getMeta(id),
            async idb => (await request(idb.transaction(WORLDS_STORE, 'readonly').objectStore(WORLDS_STORE).get(id))) ?? null)),
        getSave: id => use(db => dispatch(db,
            memory => memory.getSave(id),
            async idb => (await request(idb.transaction(SAVES_STORE, 'readonly').objectStore(SAVES_STORE).get(id))) ?? null)),
        put: (meta, save) => use(db => dispatch(db,
            memory => memory.put(meta, save),
            async idb => {
                const transaction = idb.transaction([WORLDS_STORE, SAVES_STORE], 'readwrite');
                transaction.objectStore(WORLDS_STORE).put(meta);
                if (save !== undefined) transaction.objectStore(SAVES_STORE).put(save, meta.id);
                await transactionDone(transaction);
            })),
        remove: id => use(db => dispatch(db,
            memory => memory.remove(id),
            async idb => {
                const transaction = idb.transaction([WORLDS_STORE, SAVES_STORE], 'readwrite');
                transaction.objectStore(WORLDS_STORE).delete(id);
                transaction.objectStore(SAVES_STORE).delete(id);
                await transactionDone(transaction);
            }))
    };
}

/* ------------------------------------------------------------------ */
/* API de mundos                                                       */
/* ------------------------------------------------------------------ */

export function createWorldStorage(backend = createIndexedDbBackend()) {
    let persistenceRequested = false;

    function requestPersistentStorage() {
        if (persistenceRequested) return;
        persistenceRequested = true;
        // Evita que o navegador apague os mundos sob pressão de espaço.
        try { navigator.storage?.persist?.(); } catch { /* opcional */ }
    }

    async function listWorlds() {
        const worlds = await backend.listMeta();
        for (const meta of worlds) {
            meta.requiresNewerVersion = (meta.saveVersion ?? SAVE_VERSION) > SAVE_VERSION;
        }
        return worlds.sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0));
    }

    /** Cria o registro do mundo (sem save: o terreno nasce da seed). */
    async function createWorld({ name, seedText = '' }) {
        requestPersistentStorage();
        const existing = new Set((await backend.listMeta()).map(meta => meta.id));
        const now = Date.now();
        const meta = {
            id: makeWorldId(name, existing),
            name: sanitizeWorldName(name),
            seed: parseSeedText(seedText).toString(),
            createdAt: now,
            lastPlayed: now,
            saveVersion: SAVE_VERSION
        };
        await backend.put(meta);
        return meta;
    }

    /** Devolve { meta, save } (save é null para um mundo recém-criado). */
    async function loadWorld(id) {
        const meta = await backend.getMeta(id);
        if (!meta) throw new Error(`Mundo "${id}" não encontrado.`);
        if ((meta.saveVersion ?? SAVE_VERSION) > SAVE_VERSION) {
            throw new Error('Este mundo foi salvo por uma versão mais nova do jogo.');
        }
        return { meta, save: await backend.getSave(id) };
    }

    /** Grava o save e atualiza "last played" na mesma transação. */
    async function saveWorld(id, save) {
        const meta = await backend.getMeta(id);
        if (!meta) return false;
        requestPersistentStorage();
        meta.lastPlayed = Date.now();
        meta.saveVersion = SAVE_VERSION;
        await backend.put(meta, { ...save, version: SAVE_VERSION, savedAt: meta.lastPlayed });
        return true;
    }

    async function renameWorld(id, newName) {
        const meta = await backend.getMeta(id);
        if (!meta) return null;
        meta.name = sanitizeWorldName(newName);
        await backend.put(meta);
        return meta;
    }

    async function deleteWorld(id) {
        await backend.remove(id);
    }

    return {
        listWorlds, createWorld, loadWorld, saveWorld, renameWorld, deleteWorld,
        get persistent() { return backend.persistent !== false; }
    };
}
