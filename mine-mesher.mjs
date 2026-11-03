/**
 * Mini-mesher baseado na especificação extraída de Minecraft Java 1.0.
 * Gera geometria de um bloco em atributos separados para WebGL 2.0.
 * Não implementa culling, iluminação, lightmap ou o fallback UV ainda não
 * confirmado nas seis faces; esses comportamentos ficam fora deste módulo.
 */

const BOUND_NAMES = ['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ'];

function assertFiniteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} precisa ser um número finito.`);
  }
}

function resolveFaceValue(source, face, label) {
  if (Array.isArray(source)) return source[face.side];
  if (source && typeof source === 'object') {
    return source[face.id] ?? source[String(face.side)];
  }
  return undefined;
}

function resolveRotation(rotations, face) {
  const fieldSuffix = face.rotation_field?.split('.').at(-1);
  const raw = rotations?.[face.id]
    ?? rotations?.[face.rotation_field]
    ?? (fieldSuffix ? rotations?.[fieldSuffix] : undefined)
    ?? 0;

  if (!Number.isInteger(raw) || raw < 0 || raw > 3) {
    throw new RangeError(`Rotação inválida para ${face.id}: ${raw}. Use 0, 1, 2 ou 3.`);
  }
  return raw;
}

function evaluateUvComponent(component, bounds, epsilon, faceId, vertexIndex, axis) {
  const { bound, invert, epsilon_coef: epsilonCoef } = component;

  if (!BOUND_NAMES.includes(bound)) {
    throw new Error(`Limite UV desconhecido em ${faceId}, vértice ${vertexIndex}, ${axis}: ${bound}`);
  }

  if (typeof invert !== 'boolean' || !Number.isFinite(epsilonCoef)) {
    throw new Error(`Descritor UV inválido em ${faceId}, vértice ${vertexIndex}, ${axis}.`);
  }

  const scaled = 16 * bounds[bound];
  return (invert ? 16 - scaled : scaled) + epsilonCoef * epsilon;
}

function resolveTextureIndex(textureIndices, fallbackTextureIndex, face) {
  const value = resolveFaceValue(textureIndices, face, 'textureIndices')
    ?? resolveFaceValue(fallbackTextureIndex, face, 'textureIndex')
    ?? fallbackTextureIndex;

  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new RangeError(
      `Índice de textura inválido para ${face.id}: ${value}. ` +
      'Informe um índice inteiro entre 0 e 255.'
    );
  }

  return value;
}

/**
 * @param {object} spec JSON mc10_faces_spec.json já carregado.
 * @param {object} options
 * @param {object} options.bounds Limites minX/maxX/minY/maxY/minZ/maxZ.
 * @param {object} [options.origin] Deslocamento do bloco no mundo.
 * @param {number|number[]|object} [options.textureIndex] Textura padrão ou por face.
 * @param {number[]|object} [options.textureIndices] Texturas por face.
 * @param {object} [options.rotations] Rotações por face ou campo original.
 * @param {function} [options.shouldRenderFace] Filtro de faces.
 */
export function buildBlockMesh(spec, options = {}) {
  if (!spec || !Array.isArray(spec.faces) || spec.faces.length !== 6) {
    throw new TypeError('A especificação precisa conter exatamente seis faces.');
  }

  const {
    bounds,
    origin = {},
    textureIndex,
    textureIndices,
    rotations = {},
    shouldRenderFace = () => true,
  } = options;

  if (!bounds || typeof bounds !== 'object') {
    throw new TypeError('Informe bounds com minX/maxX, minY/maxY e minZ/maxZ.');
  }

  for (const key of BOUND_NAMES) {
    assertFiniteNumber(bounds[key], `bounds.${key}`);
  }

  for (const axis of ['x', 'y', 'z']) {
    if (origin[axis] !== undefined) {
      assertFiniteNumber(origin[axis], `origin.${axis}`);
    }
  }

  if (typeof shouldRenderFace !== 'function') {
    throw new TypeError('shouldRenderFace precisa ser uma função.');
  }

  const epsilon = spec.constants?.epsilon;
  const tilePx = spec.constants?.tile_px;
  const atlasPx = spec.constants?.atlas_px;

  if (![epsilon, tilePx, atlasPx].every(Number.isFinite) || tilePx !== 16 || atlasPx !== 256) {
    throw new Error('Constantes de atlas ausentes ou incompatíveis com Minecraft 1.0.');
  }

  const positions = [];
  const uvs = [];
  const normals = [];
  const indices = [];
  const faceRanges = [];

  for (const face of spec.faces) {
    if (!shouldRenderFace(face)) continue;

    if (!Array.isArray(face.vertices) || face.vertices.length !== 4) {
      throw new Error(`A face ${face.id} não contém exatamente quatro vértices.`);
    }

    const rotation = resolveRotation(rotations, face);
    const rotationSpec = face.uv_rotations?.find(
      (entry) => entry.rotation === rotation
    );

    if (!rotationSpec || !Array.isArray(rotationSpec.uv) || rotationSpec.uv.length !== 4) {
      throw new Error(`UV da rotação ${rotation} não encontrada para ${face.id}.`);
    }

    const tex = resolveTextureIndex(textureIndices, textureIndex, face);
    const atlasU0 = (tex & 15) << 4;
    const atlasV0 = tex & 240;

    const firstVertex = positions.length / 3;
    const firstIndex = indices.length;

    for (let i = 0; i < 4; i += 1) {
      const vertex = face.vertices[i];
      const uvSpec = rotationSpec.uv[i];

      if (!vertex?.position || !uvSpec?.u || !uvSpec?.v) {
        throw new Error(`Vértice ${i + 1} inválido na face ${face.id}.`);
      }

      for (const axis of ['x', 'y', 'z']) {
        const boundName = vertex.position[axis];

        if (!BOUND_NAMES.includes(boundName)) {
          throw new Error(`Posição inválida em ${face.id}, vértice ${i + 1}, eixo ${axis}.`);
        }

        const offset = origin[axis] ?? 0;
        positions.push(offset + bounds[boundName]);
      }

      const uPx = evaluateUvComponent(
        uvSpec.u, bounds, epsilon, face.id, i + 1, 'u'
      );

      const vPx = evaluateUvComponent(
        uvSpec.v, bounds, epsilon, face.id, i + 1, 'v'
      );

      uvs.push(
        (atlasU0 + uPx) / atlasPx,
        (atlasV0 + vPx) / atlasPx
      );

      if (!Array.isArray(face.outward_normal) || face.outward_normal.length !== 3) {
        throw new Error(`Normal inválida na face ${face.id}.`);
      }

      normals.push(...face.outward_normal);
    }

    // Dois triângulos: 1-2-3 e 1-3-4.
    indices.push(
      firstVertex, firstVertex + 1, firstVertex + 2,
      firstVertex, firstVertex + 2, firstVertex + 3,
    );

    faceRanges.push({
      id: face.id,
      side: face.side,
      textureIndex: tex,
      rotation,
      firstVertex,
      vertexCount: 4,
      firstIndex,
      indexCount: 6,
    });
  }

  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
    faceRanges,
    vertexCount: positions.length / 3,
    faceCount: faceRanges.length,
  };
}
