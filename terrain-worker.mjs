import { createTerrainChunkGenerator } from './terrain-chunk.mjs';
let generator = null;
self.addEventListener('message', event => {
    const message = event.data;
    if (message.type === 'init') {
        generator = createTerrainChunkGenerator(BigInt(message.seed), { grassPixels: message.grassPixels });
        return;
    }
    if (message.type !== 'generate' || !generator) return;
    const { chunkX, chunkZ } = message;
    try {
        const chunk = generator.generateChunk(chunkX, chunkZ);
        self.postMessage({ type: 'generated', chunkX, chunkZ, chunk }, [
            chunk.blocks.buffer, chunk.metadata.buffer, chunk.biomeIds.buffer, chunk.grassColors.buffer
        ]);
    } catch (error) {
        self.postMessage({ type: 'error', chunkX, chunkZ, error: error instanceof Error ? error.message : String(error) });
    }
});
