import test from 'node:test';
import assert from 'node:assert/strict';
import {
    SAVE_VERSION, javaStringHashCode, parseSeedText, makeWorldId, sanitizeWorldName,
    serializeModifiedChunks, deserializeModifiedChunks, createMemoryBackend, createWorldStorage
} from './world-storage.mjs';

const fixedRandom = () => 987654321n;

test('String.hashCode do Java', () => {
    assert.equal(javaStringHashCode(''), 0);
    assert.equal(javaStringHashCode('a'), 97);
    assert.equal(javaStringHashCode('hello'), 99162322);
});

test('seed: vazio e 0 sorteiam; número vale como long; texto vira hashCode', () => {
    assert.equal(parseSeedText('', fixedRandom), 987654321n);
    assert.equal(parseSeedText('   ', fixedRandom), 987654321n);
    assert.equal(parseSeedText('0', fixedRandom), 987654321n);
    assert.equal(parseSeedText('12345', fixedRandom), 12345n);
    assert.equal(parseSeedText(' -42 ', fixedRandom), -42n);
    assert.equal(parseSeedText('+7', fixedRandom), 7n);
    assert.equal(parseSeedText('hello', fixedRandom), 99162322n);
    // Fora do intervalo de um long: o 1.0 cai no hashCode da string.
    const huge = '99999999999999999999';
    assert.equal(parseSeedText(huge, fixedRandom), BigInt(javaStringHashCode(huge)));
    assert.equal(parseSeedText('9223372036854775807', fixedRandom), 9223372036854775807n);
    assert.equal(parseSeedText('-9223372036854775808', fixedRandom), -9223372036854775808n);
});

test('nome e id do mundo', () => {
    assert.equal(sanitizeWorldName('  '), 'World');
    assert.equal(sanitizeWorldName('  Meu mundo  '), 'Meu mundo');
    assert.equal(sanitizeWorldName('x'.repeat(100)).length, 32);
    assert.equal(makeWorldId('New World', []), 'New World');
    assert.equal(makeWorldId('New World', ['New World']), 'New World-');
    assert.equal(makeWorldId('New World', ['New World', 'New World-']), 'New World--');
    assert.equal(makeWorldId('a/b:c?', []), 'a_b_c_');
});

test('blocos alterados sobrevivem ao round-trip e ignoram chunks vazios', () => {
    const original = new Map([
        ['0,0', new Map([[10, { blockId: 3, metadata: 0 }], [99999, { blockId: 255, metadata: 15 }]])],
        ['-1,2', new Map([[5, { blockId: 0, metadata: 7 }]])],
        ['5,5', new Map()]
    ]);
    const serialized = serializeModifiedChunks(original);
    assert.equal(serialized.length, 2);
    assert.ok(serialized[0].indices instanceof Int32Array);

    const restored = deserializeModifiedChunks(structuredClone(serialized));
    assert.equal(restored.size, 2);
    assert.deepEqual(restored.get('0,0').get(99999), { blockId: 255, metadata: 15 });
    assert.deepEqual(restored.get('-1,2').get(5), { blockId: 0, metadata: 7 });
    assert.equal(restored.has('5,5'), false);
    assert.equal(deserializeModifiedChunks(null).size, 0);
    assert.equal(deserializeModifiedChunks([{ key: 'x' }, null]).size, 0);
});

test('ciclo completo: criar, listar, salvar, carregar, renomear, apagar', async () => {
    const storage = createWorldStorage(createMemoryBackend());
    assert.deepEqual(await storage.listWorlds(), []);

    const first = await storage.createWorld({ name: 'New World', seedText: '123' });
    const second = await storage.createWorld({ name: 'New World', seedText: 'abc' });
    assert.equal(first.id, 'New World');
    assert.equal(second.id, 'New World-');
    assert.equal(first.seed, '123');
    assert.equal(second.seed, String(javaStringHashCode('abc')));

    const created = await storage.loadWorld(first.id);
    assert.equal(created.save, null);

    await new Promise(resolve => setTimeout(resolve, 5));
    const payload = {
        player: { position: [1, 2, 3] },
        chunks: serializeModifiedChunks(new Map([['0,0', new Map([[1, { blockId: 4, metadata: 2 }]])]]))
    };
    assert.equal(await storage.saveWorld(first.id, payload), true);

    const loaded = await storage.loadWorld(first.id);
    assert.equal(loaded.save.version, SAVE_VERSION);
    assert.deepEqual(loaded.save.player.position, [1, 2, 3]);
    assert.equal(loaded.save.chunks[0].ids[0], 4);

    // O último jogado vai para o topo, como no GuiSelectWorld.
    const listed = await storage.listWorlds();
    assert.deepEqual(listed.map(world => world.id), ['New World', 'New World-']);

    await storage.renameWorld(first.id, 'Casa do Caio');
    assert.equal((await storage.loadWorld(first.id)).meta.name, 'Casa do Caio');
    assert.equal((await storage.loadWorld(first.id)).meta.id, 'New World');

    await storage.deleteWorld(first.id);
    await assert.rejects(() => storage.loadWorld(first.id), /não encontrado/);
    assert.equal(await storage.saveWorld(first.id, payload), false);
    assert.deepEqual((await storage.listWorlds()).map(world => world.id), ['New World-']);
});

test('save de versão futura é recusado em vez de ser sobrescrito', async () => {
    const backend = createMemoryBackend();
    await backend.put(
        { id: 'futuro', name: 'Futuro', seed: '1', lastPlayed: 1, saveVersion: SAVE_VERSION + 1 },
        { version: SAVE_VERSION + 1 }
    );
    const storage = createWorldStorage(backend);
    const [world] = await storage.listWorlds();
    assert.equal(world.requiresNewerVersion, true);
    await assert.rejects(() => storage.loadWorld('futuro'), /versão mais nova/);
});
