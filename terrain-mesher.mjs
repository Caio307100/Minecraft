import { buildBlockMesh } from './mine-mesher.mjs';

const TEXTURES = {
    1: [1, 1, 1, 1, 1, 1],
    2: [2, 0, 3, 3, 3, 3],
    3: [2, 2, 2, 2, 2, 2],
    5: [4, 4, 4, 4, 4, 4],
    7: [17, 17, 17, 17, 17, 17],
    8: [205, 205, 206, 206, 206, 206],
    9: [205, 205, 206, 206, 206, 206],
    12: [18, 18, 18, 18, 18, 18],
    13: [19, 19, 19, 19, 19, 19],
    17: [21, 21, 20, 20, 20, 20],
    18: [52, 52, 52, 52, 52, 52],
    24: [208, 176, 192, 192, 192, 192],
    79: [67, 67, 67, 67, 67, 67],
    110: [2, 78, 77, 77, 77, 77]
};

// yy.a(0, metadata): ícone usado por EntityDiggingFX no JAR 1.0.
export function getBlockParticleTexture(blockId, metadata = 0) {
    const textures = blockId === 17 && (metadata & 3) === 2
        ? [21, 21, 117, 117, 117, 117]
        : TEXTURES[blockId];
    return textures?.[0] ?? null;
}

const AIR = 0;
const LEAVES = 18;
const FLOWING_WATER = 8;
const WATER = 9;
const HEIGHT = 128;
const SIZE = 16;

function createBucket() {
    return {
        positions: [],
        uvs: [],
        normals: [],
        colors: [],
        lights: [],
        indices: [],
        faceCount: 0
    };
}

function finishBucket(bucket) {
    return {
        positions: new Float32Array(bucket.positions),
        uvs: new Float32Array(bucket.uvs),
        normals: new Float32Array(bucket.normals),
        colors: new Float32Array(bucket.colors),
        lights: new Float32Array(bucket.lights),
        indices: new Uint32Array(bucket.indices),
        vertexCount: bucket.positions.length / 3,
        faceCount: bucket.faceCount
    };
}

export function buildTerrainMesh(spec, chunk, neighborChunks = new Map(), options = {}) {
    if (chunk.blocks.length !== SIZE * SIZE * HEIGHT) {
        throw new Error('Chunk incompatível.');
    }

    const bounds = {
        minX: 0, maxX: 1,
        minY: 0, maxY: 1,
        minZ: 0, maxZ: 1
    };

    const solid = createBucket();
    const water = createBucket();
    const templates = new Map();

    function getTemplate(blockId, face, metadata = 0) {
        const isLiquid = blockId === WATER || blockId === FLOWING_WATER;
        const level = metadata >= 8 ? 0 : (metadata & 7);
        const key = `${blockId}:${face.side}:${isLiquid ? level : metadata}`;

        if (templates.has(key)) return templates.get(key);

        // qo.a(face, metadata) e qo.a(boolean) no Minecraft 1.0:
        // Fancy usa 52/132; Fast usa 53/133.
        const fancyLeaves = options.fancyGraphics !== false;
        const leafBase = fancyLeaves ? 52 : 53;
        const textures = blockId === LEAVES
            ? Array(6).fill(leafBase + ((metadata & 3) === 1 ? 80 : 0))
            : blockId === 17 && metadata === 2
                ? [21, 21, 117, 117, 117, 117]
                : TEXTURES[blockId];
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
    }

    // Cache dos 8 vizinhos: evita montar strings e consultar Map em cada
    // amostra de bloco/luz durante a construção da malha.
    const neighborGrid = new Array(9);
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            neighborGrid[(dz + 1) * 3 + dx + 1] =
                dx === 0 && dz === 0
                    ? chunk
                    : neighborChunks.get(`${chunk.chunkX + dx},${chunk.chunkZ + dz}`) ?? null;
        }
    }

    const blockAt = (x, y, z) => {
        if (y < 0 || y >= HEIGHT) return null;

        let dx = 0;
        let dz = 0;
        if (x < 0) { dx = -1; x += SIZE; }
        else if (x >= SIZE) { dx = 1; x -= SIZE; }
        if (z < 0) { dz = -1; z += SIZE; }
        else if (z >= SIZE) { dz = 1; z -= SIZE; }

        const source = neighborGrid[(dz + 1) * 3 + dx + 1];
        if (!source) return null;
        return source.blocks[x * 2048 + z * HEIGHT + y];
    };

    function getLocalBlockMetadata(x, z, y) {
        const index = x * 2048 + z * HEIGHT + y;
        const byte = chunk.metadata?.[index >> 1] ?? 0;
        return (index & 1) ? ((byte >> 4) & 15) : (byte & 15);
    }

    function isOpaqueBlock(blockId) {
        if (blockId === null || blockId === AIR ||
            blockId === WATER || blockId === FLOWING_WATER) return false;
        // qo.a() retorna false para folhas no Fancy Graphics.
        if (blockId === LEAVES && options.fancyGraphics !== false) return false;
        return true;
    }

    function getPackedLightAt(x, y, z) {
        if (y < 0) return 0;
        if (y >= HEIGHT) return 240;

        let dx = 0;
        let dz = 0;
        if (x < 0) { dx = -1; x += SIZE; }
        else if (x >= SIZE) { dx = 1; x -= SIZE; }
        if (z < 0) { dz = -1; z += SIZE; }
        else if (z >= SIZE) { dz = 1; z -= SIZE; }

        const source = neighborGrid[(dz + 1) * 3 + dx + 1];
        const index = x * 2048 + z * HEIGHT + y;
        const sky = source?.skyLight?.[index] ?? 0;
        const block = source?.blockLight?.[index] ?? 0;
        return (sky << 4) | block;
    }

    // Port do cálculo de iluminação por vértice de RenderBlocks (acr.java).
    // yy.f() no JAR retorna 0.2 para um bloco opaco e 1.0 para espaço aberto.
    function getLegacyBlockBrightness(blockId) {
        return isOpaqueBlock(blockId) ? 0.2 : 1.0;
    }

    function getVertexSmoothBrightness(x, y, z, face, vertexPosition) {
        const [nx, ny, nz] = face.outward_normal;
        const normalAxis = nx !== 0 ? 'x' : ny !== 0 ? 'y' : 'z';
        const tangentAxes = ['x', 'y', 'z'].filter(axis => axis !== normalAxis);
        const signs = {};
        for (const axis of tangentAxes) signs[axis] = vertexPosition[axis] <= 0.5 ? -1 : 1;
        const offset = (axis, amount) => ({ x: axis === 'x' ? amount : 0, y: axis === 'y' ? amount : 0, z: axis === 'z' ? amount : 0 });
        const a = offset(tangentAxes[0], signs[tangentAxes[0]]);
        const b = offset(tangentAxes[1], signs[tangentAxes[1]]);
        const sample = (da, db) => blockAt(x + nx + da.x + db.x, y + ny + da.y + db.y, z + nz + da.z + db.z);
        const faceNeighbor = sample({x:0,y:0,z:0}, {x:0,y:0,z:0});
        const sideA = sample(a, {x:0,y:0,z:0});
        const sideB = sample(b, {x:0,y:0,z:0});
        const useDiagonal = isOpaqueBlock(sideA) || isOpaqueBlock(sideB);
        const corner = useDiagonal ? sample(a,b) : sideA;
        const rawAoBrightness = (getLegacyBlockBrightness(faceNeighbor) + getLegacyBlockBrightness(sideA) + getLegacyBlockBrightness(sideB) + getLegacyBlockBrightness(corner)) * 0.25;
        const lightChannelsAt = (da, db) => {
            const sx=x+nx+da.x+db.x, sy=y+ny+da.y+db.y, sz=z+nz+da.z+db.z;
            if (sy < 0) return {sky:0,block:0};
            if (sy >= HEIGHT) return {sky:15,block:0};
            let tx=chunk.chunkX, tz=chunk.chunkZ, lx=sx, lz=sz;
            if(lx<0){tx--;lx+=SIZE;} else if(lx>=SIZE){tx++;lx-=SIZE;}
            if(lz<0){tz--;lz+=SIZE;} else if(lz>=SIZE){tz++;lz-=SIZE;}
            const source = tx===chunk.chunkX && tz===chunk.chunkZ ? chunk : neighborChunks.get(`${tx},${tz}`);
            const index=lx*2048+lz*HEIGHT+sy;
            return {sky:source?.skyLight?.[index]??0,block:source?.blockLight?.[index]??0};
        };
        const base=lightChannelsAt({x:0,y:0,z:0},{x:0,y:0,z:0});
        const sideALight=lightChannelsAt(a,{x:0,y:0,z:0});
        const sideBLight=lightChannelsAt(b,{x:0,y:0,z:0});
        const cornerLight=useDiagonal ? lightChannelsAt(a,b) : sideALight;
        const averageChannel = key => (base[key] + (sideALight[key] || base[key]) + (sideBLight[key] || base[key]) + (cornerLight[key] || base[key])) >> 2;
        const skyTotal=averageChannel('sky'), blockTotal=averageChannel('block');
        return { ao: rawAoBrightness, sky: skyTotal / 15, block: blockTotal / 15 };
    }

    for (let x = 0; x < SIZE; x++) {
        for (let z = 0; z < SIZE; z++) {
            const grassColor =
                chunk.grassColors?.[x + z * SIZE] ?? 0xffffff;

            for (let y = 0; y < HEIGHT; y++) {
                const blockId = blockAt(x, y, z);

                if (blockId === AIR) continue;

                const isWater = blockId === WATER || blockId === FLOWING_WATER;
                const isLeaves = blockId === LEAVES;
                const fancyLeaves = options.fancyGraphics !== false;
                const blockMeta = chunk.metadata ? getLocalBlockMetadata(x, z, y) : 0;
                const bucket = isWater ? water : solid;

                for (const face of spec.faces) {
                    const [dx, dy, dz] = face.outward_normal;
                    const neighbor = blockAt(x + dx, y + dy, z + dz);

                    if (isWater) {
                        // Água só mostra faces voltadas para ar ou fora do chunk.
                        if (neighbor !== null && neighbor !== AIR) continue;
                    } else if (isLeaves && !fancyLeaves && neighbor === LEAVES) {
                        // zt.a_(): no Fast, folhas vizinhas do mesmo bloco
                        // escondem a face compartilhada.
                        continue;
                    } else if (isOpaqueBlock(neighbor)) {
                        // yy.a_(): faces aparecem quando o vizinho não é opaco.
                        // No Fancy, folhas não bloqueiam faces de outros blocos.
                        continue;
                    }

                    const template = getTemplate(blockId, face, blockMeta);
                    const vertexBase = bucket.positions.length / 3;

                    for (let i = 0; i < template.positions.length; i += 3) {
                        bucket.positions.push(
                            template.positions[i] + x,
                            template.positions[i + 1] + y,
                            template.positions[i + 2] + z
                        );
                    }

                    bucket.uvs.push(...template.uvs);
                    bucket.normals.push(...template.normals);

                    const tinted = !isWater && (blockId === 2 && face.side !== 0 || isLeaves);
                    const r = tinted ? ((grassColor >> 16) & 255) / 255 : 1;
                    const g = tinted ? ((grassColor >> 8) & 255) / 255 : 1;
                    const b = tinted ? (grassColor & 255) / 255 : 1;

                    for (let i = 0; i < template.vertexCount; i++) {
                        const vertexPosition = { x: template.positions[i * 3], y: template.positions[i * 3 + 1], z: template.positions[i * 3 + 2] };
                        const lighting = isWater ? { ao: 1, sky: 1, block: 0 } : getVertexSmoothBrightness(x, y, z, face, vertexPosition);
                        const ao = options.smoothLighting === false ? 1 : lighting.ao;
                        bucket.colors.push(r * ao, g * ao, b * ao);
                        bucket.lights.push(lighting.sky, lighting.block);
                    }

                    for (const index of template.indices) {
                        bucket.indices.push(vertexBase + index);
                    }

                    bucket.faceCount++;
                }
            }
        }
    }

    const solidMesh = finishBucket(solid);
    const waterMesh = finishBucket(water);

    return {
        ...solidMesh,
        water: waterMesh
    };
}
