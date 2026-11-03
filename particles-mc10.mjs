// Minecraft Java 1.0 — port das classes wc, mp, aca, aao, adc, ail,
// pq, jd, cn, afj, sq, ae, afy, afn, nr, o, aw, nb, adi, kz,
// ug, st, zj, ff e ub; gerenciador f e fábrica afv.
// Os coeficientes e animações abaixo seguem os métodos decompilados do 1.0.
const MAX_PER_LAYER = 4000;
const TAU = Math.PI * 2;
// Índices bL de yy.java (Minecraft 1.0); blocos com textura por face
// ou metadado recebem os índices laterais usados pelo método a(0, metadata).
// yy.k[id].a(0, metadata), executado por reflexão no 1.0.jar original.
// Valores variáveis preservam as texturas de metadados (lã, troncos, pistões etc.).
const BLOCK_BOTTOM_TEXTURE = new Map([
  [1,1],[2,2],[3,2],[4,16],[5,4],
  [6,[15,63,79,15,15,63,79,15,15,63,79,15,15,63,79,15]],
  [7,17],[8,205],[9,205],[10,237],[11,237],[12,18],[13,19],[14,32],[15,33],
  [16,34],[17,21],
  [18,[52,132,52,52,52,132,52,52,52,132,52,52,52,132,52,52]],
  [19,48],[20,49],[21,160],[22,144],[23,62],[24,208],[25,74],[26,4],
  [27,[163,163,163,163,163,163,163,163,179,179,179,179,179,179,179,179]],
  [28,195],
  [29,[106,109,108,108,108,108,106,106,110,109,108,108,108,108,106,106]],
  [30,11],
  [31,[55,39,56,39,39,39,39,39,39,39,39,39,39,39,39,39]],
  [32,55],
  [33,[107,109,108,108,108,108,107,107,110,109,108,108,108,108,107,107]],
  [34,[107,107,108,108,108,108,107,107,106,107,108,108,108,108,107,107]],
  [35,[64,210,194,178,162,146,130,114,225,209,193,177,161,145,129,113]],
  [36,0],[37,13],[38,12],[39,29],[40,28],[41,23],[42,22],
  [43,[6,208,4,16,7,54,6,6,6,6,6,6,6,6,6,6]],
  [44,[6,208,4,16,7,54,6,6,6,6,6,6,6,6,6,6]],
  [45,7],[46,10],[47,4],[48,36],[49,37],[50,80],[51,31],[52,65],[53,4],
  [54,25],[55,164],[56,50],[57,24],[58,4],
  [59,[88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103]],
  [60,2],[61,62],[62,62],[63,4],[64,97],[65,83],
  [66,[128,128,128,128,128,128,112,112,112,112,112,112,112,112,112,112]],
  [67,16],[68,4],[69,96],[70,1],[71,98],[72,4],[73,51],[74,51],[75,115],
  [76,99],[77,1],[78,66],[79,67],[80,66],[81,71],[82,72],[83,73],[84,74],
  [85,4],[86,102],[87,103],[88,104],[89,105],[90,14],[91,102],[92,124],
  [93,115],[94,99],[95,25],[96,84],
  [97,[1,16,54,1,1,1,1,1,1,1,1,1,1,1,1,1]],
  [98,[54,100,101,54,54,54,54,54,54,54,54,54,54,54,54,54]],
  [99,[142,142,142,142,142,142,142,142,142,142,142,142,142,142,126,141]],
  [100,[142,142,142,142,142,142,142,142,142,142,142,142,142,142,125,141]],
  [101,85],[102,49],[103,137],[104,111],[105,111],[106,143],[107,4],[108,7],
  [109,54],[110,2],[111,76],[112,224],[113,224],[114,224],
  [115,[226,227,227,228,228,228,228,228,228,228,228,228,228,228,228,228]],
  [116,183],[117,157],[118,155],[119,0],[120,175],[121,175],[122,167]
]);

const ITEM_ICON_INDEX = new Map([
  [256,82],[257,98],[258,114],[259,5],[260,10],[261,21],[262,37],[263,7],
  [264,55],[265,23],[266,39],[267,66],[268,64],[269,80],[270,96],[271,112],
  [272,65],[273,81],[274,97],[275,113],[276,67],[277,83],[278,99],[279,115],
  [280,53],[281,71],[282,72],[283,68],[284,84],[285,100],[286,116],[287,8],
  [288,24],[289,40],[290,128],[291,129],[292,130],[293,131],[294,132],[295,9],
  [296,25],[297,41],[298,0],[299,16],[300,32],[301,48],[302,1],[303,17],
  [304,33],[305,49],[306,2],[307,18],[308,34],[309,50],[310,3],[311,19],
  [312,35],[313,51],[314,4],[315,20],[316,36],[317,52],[318,6],[319,87],
  [320,88],[321,26],[322,11],[323,42],[324,43],[325,74],[326,75],[327,76],
  [328,135],[329,104],[330,44],[331,56],[332,14],[333,136],[334,103],[335,77],
  [336,22],[337,57],[338,27],[339,58],[340,59],[341,30],[342,151],[343,167],
  [344,12],[345,54],[346,69],[347,70],[348,73],[349,89],[350,90],[351,78],
  [352,28],[353,13],[354,29],[355,45],[356,86],[357,92],[358,60],[359,93],[360,109],[361,61],
  [362,62],[363,105],[364,106],[365,121],[366,122],[367,91],[368,107],[369,108],
  [370,123],[371,124],[372,125],[373,141],[374,140],[375,139],[376,138],[377,157],[378,173],
  [379,172],[380,156],[381,155],[382,137],
  [2256,240],[2257,241],[2258,242],[2259,243],[2260,244],[2261,245],[2262,246],
  [2263,247],[2264,248],[2265,249],[2266,250]
]);

const rand = () => Math.random();
const randInt = n => Math.floor(rand() * n);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const blockIsFluid = id => id === 8 || id === 9 || id === 10 || id === 11;

function baseParticle(x, y, z, vx, vy, vz) {
  let px = vx + (rand() * 2 - 1) * 0.4;
  let py = vy + (rand() * 2 - 1) * 0.4;
  let pz = vz + (rand() * 2 - 1) * 0.4;
  const speed = (rand() + rand() + 1) * 0.15;
  const length = Math.hypot(px, py, pz) || 1;
  px = px / length * speed * 0.4;
  py = py / length * speed * 0.4 + 0.1;
  pz = pz / length * speed * 0.4;
  const scale = (rand() * 0.5 + 0.5) * 2;
  return {
    type: 'base', x, y, z, prevX: x, prevY: y, prevZ: z,
    vx: px, vy: py, vz: pz,
    age: 0, life: Math.floor(4 / (rand() * 0.9 + 0.1)),
    gravity: 0, scale, size: 0.1 * scale,
    width: 0.2, height: 0.2,
    tile: 0, subU: rand() * 3, subV: rand() * 3,
    layer: 0, red: 1, green: 1, blue: 1, alpha: 1,
    noClip: false, dead: false, onGround: false,
    special: null, frame: 0, baseScale: scale
  };
}

function moveParticle(p, dx, dy, dz, getBlock) {
  if (p.noClip) {
    p.x += dx; p.y += dy; p.z += dz;
    p.onGround = false;
    return;
  }
  const half = p.width * 0.5;
  const box = {
    minX: p.x - half, maxX: p.x + half,
    minY: p.y, maxY: p.y + p.height,
    minZ: p.z - half, maxZ: p.z + half
  };
  const minX = Math.floor(box.minX + Math.min(dx, 0));
  const maxX = Math.floor(box.maxX + Math.max(dx, 0));
  const minY = Math.floor(box.minY + Math.min(dy, 0));
  const maxY = Math.floor(box.maxY + Math.max(dy, 0));
  const minZ = Math.floor(box.minZ + Math.min(dz, 0));
  const maxZ = Math.floor(box.maxZ + Math.max(dz, 0));
  const obstacles = [];
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
    const id = getBlock(x, y, z);
    if (id !== null && id !== 0 && !blockIsFluid(id)) {
      obstacles.push({ minX:x, maxX:x+1, minY:y, maxY:y+1, minZ:z, maxZ:z+1 });
    }
  }
  const clipY = (o, d) => {
    if (o.maxX <= box.minX || o.minX >= box.maxX || o.maxZ <= box.minZ || o.minZ >= box.maxZ) return d;
    if (d > 0 && box.maxY <= o.minY) return Math.min(d, o.minY - box.maxY);
    if (d < 0 && box.minY >= o.maxY) return Math.max(d, o.maxY - box.minY);
    return d;
  };
  const clipX = (o, d) => {
    if (o.maxY <= box.minY || o.minY >= box.maxY || o.maxZ <= box.minZ || o.minZ >= box.maxZ) return d;
    if (d > 0 && box.maxX <= o.minX) return Math.min(d, o.minX - box.maxX);
    if (d < 0 && box.minX >= o.maxX) return Math.max(d, o.maxX - box.minX);
    return d;
  };
  const clipZ = (o, d) => {
    if (o.maxX <= box.minX || o.minX >= box.maxX || o.maxY <= box.minY || o.minY >= box.maxY) return d;
    if (d > 0 && box.maxZ <= o.minZ) return Math.min(d, o.minZ - box.maxZ);
    if (d < 0 && box.minZ >= o.maxZ) return Math.max(d, o.maxZ - box.minZ);
    return d;
  };
  const wantedY = dy, wantedX = dx, wantedZ = dz;
  for (const o of obstacles) dy = clipY(o, dy);
  box.minY += dy; box.maxY += dy;
  for (const o of obstacles) dx = clipX(o, dx);
  box.minX += dx; box.maxX += dx;
  for (const o of obstacles) dz = clipZ(o, dz);
  box.minZ += dz; box.maxZ += dz;
  p.x = (box.minX + box.maxX) * 0.5;
  p.y = box.minY;
  p.z = (box.minZ + box.maxZ) * 0.5;
  p.onGround = wantedY !== dy && wantedY < 0;
  if (wantedX !== dx) p.vx = 0;
  if (wantedY !== dy) p.vy = 0;
  if (wantedZ !== dz) p.vz = 0;
}

function tickBase(p, getBlock) {
  p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
  if (p.age++ >= p.life) { p.dead = true; return; }
  p.vy -= 0.04 * p.gravity;
  moveParticle(p, p.vx, p.vy, p.vz, getBlock);
  p.vx *= 0.98; p.vy *= 0.98; p.vz *= 0.98;
  if (p.onGround) { p.vx *= 0.7; p.vz *= 0.7; }
}

function animateFrame(p, base, divisor = 8) {
  p.tile = base + (7 - Math.floor(p.age * divisor / Math.max(1, p.life)));
}

export function createMinecraft10ParticleEngine({
  getBlock = () => null,
  getBlockMetadata = () => 0,
  getBlockTexture = (id, metadata = 0) => {
    const value = BLOCK_BOTTOM_TEXTURE.get(id);
    return Array.isArray(value) ? (value[metadata & 15] ?? value[0]) : (value ?? 0);
  },
  getBlockGravity = () => 1,
  getBlockColor = () => 0xffffff,
  getItemIconIndex = (id) => ITEM_ICON_INDEX.get(id) ?? 0,
  getPlayerPosition = () => [0, 0, 0],
  particleSetting = 0
} = {}) {
  const layers = [[], [], [], []];
  const explosions = [];
  let setting = particleSetting;

  function isBelowFluidSurface(particle, id) {
    if (![8, 9, 10, 11].includes(id)) return false;
    const x = Math.floor(particle.x);
    const y = Math.floor(particle.y);
    const z = Math.floor(particle.z);
    const metadata = getBlockMetadata(x, y, z);
    const fluidHeight = metadata >= 8 ? 0 : (metadata + 1) / 9;
    const surfaceY = y + 1 - fluidHeight;
    return particle.y < surfaceY;
  }

  function add(p) {
    const list = p.special === 'explosion' ? explosions : layers[p.layer];
    if (list.length >= MAX_PER_LAYER) list.shift();
    list.push(p);
    return p;
  }

  function spawnBlockFragment(x, y, z, vx, vy, vz, blockId, metadata = 0, size = 1) {
    if (!blockId) return null;
    const p = baseParticle(x, y, z, vx, vy, vz);
    p.type = 'tilecrack';
    p.layer = 1;
    p.tile = getBlockTexture(blockId, metadata, 0);
    p.gravity = getBlockGravity(blockId);
    p.red = p.green = p.blue = 0.6;
    const rgb = getBlockColor(blockId, metadata, x, z);
    p.red *= ((rgb >> 16) & 255) / 255;
    p.green *= ((rgb >> 8) & 255) / 255;
    p.blue *= (rgb & 255) / 255;
    p.scale *= 0.5 * size;
    p.size = 0.1 * p.scale;
    p.subU = rand() * 3;
    p.subV = rand() * 3;
    return add(p);
  }

  function spawn(name, x, y, z, vx = 0, vy = 0, vz = 0, options = {}) {
    if (name.startsWith('iconcrack_')) { options = { ...options, itemId: Number(name.slice(10)) }; name = 'iconcrack'; }
    if (name.startsWith('tilecrack_')) { options = { ...options, blockId: Number(name.slice(10)) }; name = 'tilecrack'; }
    // f.b(String,...): explosões grandes são aceitas antes do corte de distância.
    if (name === 'hugeexplosion') {
      const p = baseParticle(x, y, z, 0, 0, 0);
      p.type = name; p.life = 8; p.special = 'emitter'; p.layer = 1;
      p.tickCount = 0; p.emitScale = vx;
      return add(p);
    }
    if (name === 'largeexplode') {
      const p = baseParticle(x, y, z, 0, 0, 0);
      p.type = name; p.special = 'explosion'; p.layer = 1;
      p.life = 6 + randInt(4);
      p.red = p.green = p.blue = rand() * 0.6 + 0.4;
      p.explosionScale = 1 - vx * 0.5;
      p.size = 2 * p.explosionScale;
      return add(p);
    }

    const player = getPlayerPosition();
    const dx = player[0] - x, dy = player[1] - y, dz = player[2] - z;
    if (dx * dx + dy * dy + dz * dz > 256) return null;
    if (setting > 1 || (setting === 1 && randInt(3) === 0)) return null;

    const usesInputVelocity = new Set([
      'bubble','suspended','depthsuspend','townaura','spell','instantSpell',
      'portal','enchantmenttable','explode','flame','snowshovel','tilecrack'
    ]).has(name);
    let p = baseParticle(x, y, z, usesInputVelocity ? vx : 0,
      usesInputVelocity ? vy : 0, usesInputVelocity ? vz : 0);
    p.type = name;

    switch (name) {
      case 'bubble':
        p.tile = 32; p.width = p.height = 0.02; p.size = 0.1 * p.scale;
        p.gravity = 0; p.life = Math.floor(8 / (rand() * 0.8 + 0.2));
        p.scale *= rand() * 0.6 + 0.2; p.size = 0.1 * p.scale;
        p.vx = vx * 0.2 + (rand() * 2 - 1) * 0.02;
        p.vy = vy * 0.2 + (rand() * 2 - 1) * 0.02;
        p.vz = vz * 0.2 + (rand() * 2 - 1) * 0.02;
        break;
      case 'suspended':
        p.y -= 0.125; p.red = 0.4; p.green = 0.4; p.blue = 0.7;
        p.tile = 0; p.width = p.height = 0.01; p.gravity = 0;
        p.vx = p.vy = p.vz = 0;
        p.life = Math.floor(16 / (rand() * 0.8 + 0.2));
        p.scale *= rand() * 0.6 + 0.2; p.size = 0.1 * p.scale;
        break;
      case 'depthsuspend':
      case 'townaura': {
        const c = rand() * 0.1 + 0.2;
        p.red = p.green = p.blue = c; p.tile = 0;
        p.width = p.height = 0.02; p.gravity = 0; p.noClip = true;
        p.vx *= 0.02; p.vy *= 0.02; p.vz *= 0.02;
        p.life = Math.floor(20 / (rand() * 0.8 + 0.2));
        p.scale *= rand() * 0.6 + 0.5; p.size = 0.1 * p.scale;
        break;
      }
      case 'crit':
      case 'magicCrit':
        p.vx = p.vx * 0.1 + vx * 0.4;
        p.vy = p.vy * 0.1 + vy * 0.4;
        p.vz = p.vz * 0.1 + vz * 0.4;
        p.scale *= 0.75; p.size = 0.1 * p.scale; p.baseScale = p.scale;
        p.life = Math.floor(6 / (rand() * 0.8 + 0.6));
        p.tile = 65; p.gravity = 0;
        p.red = p.green = p.blue = rand() * 0.3 + 0.6;
        if (name === 'magicCrit') {
          p.red *= 0.3; p.green *= 0.8; p.tile++;
        }
        break;
      case 'smoke':
      case 'largesmoke': {
        const multiplier = name === 'largesmoke' ? 2.5 : 1;
        p.vx = p.vx * 0.1 + vx; p.vy = p.vy * 0.1 + vy; p.vz = p.vz * 0.1 + vz;
        p.red = p.green = p.blue = rand() * 0.3;
        p.scale *= 0.75 * multiplier; p.size = 0.1 * p.scale;
        p.baseScale = p.scale;
        p.life = Math.floor(Math.floor(8 / (rand() * 0.8 + 0.2)) * multiplier);
        p.tile = 7; p.gravity = 0;
        break;
      }
      case 'mobSpell':
      case 'spell':
      case 'instantSpell':
        p.vy *= 0.2;
        if (vx === 0 && vz === 0) { p.vx *= 0.1; p.vz *= 0.1; }
        p.scale *= 0.75; p.size = 0.1 * p.scale; p.baseScale = p.scale;
        p.life = Math.floor(8 / (rand() * 0.8 + 0.2));
        p.tile = name === 'instantSpell' ? 144 : 128;
        p.gravity = 0;
        if (name === 'mobSpell') { p.vx = 0; p.vy = 0; p.vz = 0; p.red = vx; p.green = vy; p.blue = vz; }
        break;
      case 'note': {
        p.vx *= 0.01; p.vy *= 0.01; p.vz *= 0.01; p.vy += 0.2;
        const hue = vx;
        p.red = Math.sin((hue + 0) * TAU) * 0.65 + 0.35;
        p.green = Math.sin((hue + 1 / 3) * TAU) * 0.65 + 0.35;
        p.blue = Math.sin((hue + 2 / 3) * TAU) * 0.65 + 0.35;
        p.scale *= 1.5; p.size = 0.1 * p.scale; p.baseScale = p.scale;
        p.life = 6; p.tile = 64; p.gravity = 0;
        break;
      }
      case 'portal': {
        p.vx = vx; p.vy = vy; p.vz = vz;
        p.originX = p.x; p.originY = p.y; p.originZ = p.z;
        const c = rand() * 0.6 + 0.4;
        p.red = c * 0.9; p.green = c * 0.3; p.blue = c;
        p.scale = p.baseScale = rand() * 0.2 + 0.5; p.size = 0.1 * p.scale;
        p.life = Math.floor(rand() * 10) + 40; p.noClip = true;
        p.tile = randInt(8); p.gravity = 0;
        break;
      }
      case 'enchantmenttable': {
        p.vx = vx; p.vy = vy; p.vz = vz;
        p.originX = p.x; p.originY = p.y; p.originZ = p.z;
        const c = rand() * 0.6 + 0.4;
        p.red = c * 0.9; p.green = c * 0.9; p.blue = c;
        p.scale = p.baseScale = rand() * 0.5 + 0.2; p.size = 0.1 * p.scale;
        p.life = Math.floor(rand() * 10) + 30; p.noClip = true;
        p.tile = Math.floor(rand() * 26 + 225); p.gravity = 0;
        break;
      }
      case 'explode':
        p.vx = vx + (rand() * 2 - 1) * 0.05;
        p.vy = vy + (rand() * 2 - 1) * 0.05;
        p.vz = vz + (rand() * 2 - 1) * 0.05;
        p.red = p.green = p.blue = rand() * 0.3 + 0.7;
        p.scale = p.baseScale = rand() * rand() * 6 + 1; p.size = 0.1 * p.scale;
        p.life = Math.floor(16 / (rand() * 0.8 + 0.2)) + 2;
        p.tile = 7; p.gravity = 0;
        break;
      case 'flame':
        p.vx = p.vx * 0.01 + vx; p.vy = p.vy * 0.01 + vy; p.vz = p.vz * 0.01 + vz;
        p.red = p.green = p.blue = 1;
        p.life = Math.floor(8 / (rand() * 0.8 + 0.2)) + 4;
        p.tile = 48; p.noClip = true; p.gravity = 0;
        break;
      case 'lava':
        p.vx *= 0.8; p.vy = rand() * 0.4 + 0.05; p.vz *= 0.8;
        p.red = p.green = p.blue = 1;
        p.scale *= rand() * 2 + 0.2; p.baseScale = p.scale; p.size = 0.1 * p.scale;
        p.life = Math.floor(16 / (rand() * 0.8 + 0.2));
        p.tile = 49; p.gravity = 0;
        break;
      case 'footstep':
        p.layer = 3; p.special = 'footstep'; p.life = 200;
        p.vx = p.vy = p.vz = 0; p.tile = 0; p.size = 0.25;
        p.gravity = 0;
        break;
      case 'splash':
        p.tile = 20 + randInt(4); p.width = p.height = 0.01;
        p.gravity = 0.04; p.life = Math.floor(8 / (rand() * 0.8 + 0.2));
        p.vx *= 0.3; p.vz *= 0.3; p.vy = rand() * 0.2 + 0.1;
        if (vy === 0 && (vx !== 0 || vz !== 0)) { p.vx = vx; p.vy = 0.1; p.vz = vz; }
        break;
      case 'cloud': {
        p.vx = p.vx * 0.1 + vx; p.vy = p.vy * 0.1 + vy; p.vz = p.vz * 0.1 + vz;
        p.red = p.green = p.blue = 1 - rand() * 0.3;
        p.scale *= 0.75 * 2.5; p.size = 0.1 * p.scale; p.baseScale = p.scale;
        p.life = Math.floor(Math.floor(8 / (rand() * 0.8 + 0.3)) * 2.5);
        p.tile = 7; p.gravity = 0;
        break;
      }
      case 'reddust': {
        p.vx *= 0.1; p.vy *= 0.1; p.vz *= 0.1;
        const fade = rand() * 0.4 + 0.6;
        const redInput = vx === 0 ? 1 : vx;
        p.red = (rand() * 0.2 + 0.8) * redInput * fade;
        p.green = (rand() * 0.2 + 0.8) * vy * fade;
        p.blue = (rand() * 0.2 + 0.8) * vz * fade;
        p.scale *= 0.75; p.size = 0.1 * p.scale; p.baseScale = p.scale;
        p.life = Math.floor(8 / (rand() * 0.8 + 0.2));
        p.tile = 0; p.gravity = 0;
        break;
      }
      case 'tilecrack': {
        const blockId = options.blockId;
        if (!blockId) return null;
        p.layer = 1; p.tile = getBlockTexture(blockId, 0, 0);
        p.gravity = getBlockGravity(blockId);
        p.red *= 0.6; p.green *= 0.6; p.blue *= 0.6;
        const rgb = getBlockColor(blockId, 0, x, z);
        p.red *= ((rgb >> 16) & 255) / 255;
        p.green *= ((rgb >> 8) & 255) / 255;
        p.blue *= (rgb & 255) / 255;
        p.scale *= 0.5; p.size = 0.1 * p.scale;
        break;
      }
      case 'snowballpoof':
      case 'slime':
        p.layer = 2; p.tile = name === 'snowballpoof' ? 14 : 30;
        p.gravity = getBlockGravity(80);
        p.scale *= 0.5; p.size = 0.1 * p.scale;
        break;
      case 'iconcrack':
        p.layer = 2; p.tile = getItemIconIndex(options.itemId);
        p.gravity = getBlockGravity(80);
        p.vx = p.vx * 0.1 + vx; p.vy = p.vy * 0.1 + vy; p.vz = p.vz * 0.1 + vz;
        p.scale *= 0.5; p.size = 0.1 * p.scale;
        break;
      case 'dripWater':
      case 'dripLava':
        p.width = p.height = 0.01; p.vx = p.vy = p.vz = 0;
        p.red = name === 'dripWater' ? 0.2 : 1;
        p.green = name === 'dripWater' ? 0.3 : 0;
        p.blue = name === 'dripWater' ? 1 : 0;
        p.gravity = 0.06; p.life = Math.floor(64 / (rand() * 0.8 + 0.2));
        p.dripAge = 40; p.tile = 113; p.dripKind = name;
        break;
      case 'snowshovel':
        p.vx = p.vx * 0.1 + vx; p.vy = p.vy * 0.1 + vy; p.vz = p.vz * 0.1 + vz;
        p.red = p.green = p.blue = 1 - rand() * 0.3;
        p.scale *= 0.75; p.size = 0.1 * p.scale; p.baseScale = p.scale;
        p.life = Math.floor(8 / (rand() * 0.8 + 0.2));
        p.gravity = 0; p.tile = 0;
        break;
      case 'heart':
        p.vx *= 0.01; p.vy *= 0.01; p.vz *= 0.01; p.vy += 0.1;
        p.scale *= 1.5; p.size = 0.1 * p.scale; p.baseScale = p.scale;
        p.life = 16; p.tile = 80; p.gravity = 0;
        break;
      default:
        return null;
    }
    return add(p);
  }

  function spawnBlockBreak(bx, by, bz, blockId, metadata = 0) {
    if (!blockId) return;
    for (let ix = 0; ix < 4; ix++) for (let iy = 0; iy < 4; iy++) for (let iz = 0; iz < 4; iz++) {
      const x = bx + (ix + 0.5) / 4;
      const y = by + (iy + 0.5) / 4;
      const z = bz + (iz + 0.5) / 4;
      spawnBlockFragment(x, y, z, x - bx - 0.5, y - by - 0.5, z - bz - 0.5, blockId, metadata);
    }
  }

  function spawnBlockHit(bx, by, bz, blockId, metadata = 0, face = 1) {
    if (!blockId) return null;
    const f = 0.1;
    let x = bx + f + rand() * (1 - 2 * f);
    let y = by + f + rand() * (1 - 2 * f);
    let z = bz + f + rand() * (1 - 2 * f);
    if (face === 0) y = by - f;
    if (face === 1) y = by + 1 + f;
    if (face === 2) z = bz - f;
    if (face === 3) z = bz + 1 + f;
    if (face === 4) x = bx - f;
    if (face === 5) x = bx + 1 + f;
    const p = spawnBlockFragment(x, y, z, 0, 0, 0, blockId, metadata, 0.6);
    if (p) {
      p.vx *= 0.2; p.vy = (p.vy - 0.1) * 0.2 + 0.1; p.vz *= 0.2;
      p.width = p.height = 0.12;
    }
    return p;
  }

  function tickParticle(p) {
    if (p.special === 'explosion') {
      p.age++;
      if (p.age >= p.life) { p.dead = true; return; }
      p.frame = Math.floor((p.age * 15) / p.life);
      return;
    }
    if (p.special === 'footstep') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      if (p.age++ >= p.life) p.dead = true;
      p.alpha = 0.2 * Math.min(1, Math.max(0, 2 - Math.pow(p.age / p.life, 2) * 2));
      return;
    }
    if (p.special === 'emitter') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      if (p.tickCount >= 8) { p.dead = true; return; }
      const emitterProgress = p.tickCount / 8;
      p.tickCount++;
      for (let i = 0; i < 6; i++) {
        spawn('largeexplode',
          p.x + (rand() - rand()) * 4,
          p.y + (rand() - rand()) * 4,
          p.z + (rand() - rand()) * 4,
          emitterProgress, 0, 0);
      }
      if (p.tickCount >= 8) p.dead = true;
      return;
    }

    if (p.type === 'bubble') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      p.vy += 0.002; moveParticle(p, p.vx, p.vy, p.vz, getBlock);
      p.vx *= 0.85; p.vy *= 0.85; p.vz *= 0.85;
      const id = getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
      if (id !== 8 && id !== 9 || p.life-- <= 0) p.dead = true;
      return;
    }
    if (p.type === 'suspended') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      moveParticle(p, p.vx, p.vy, p.vz, getBlock);
      const id = getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
      if (id !== 8 && id !== 9 || p.life-- <= 0) p.dead = true;
      return;
    }
    if (p.type === 'depthsuspend' || p.type === 'townaura') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      moveParticle(p, p.vx, p.vy, p.vz, getBlock);
      p.vx *= 0.99; p.vy *= 0.99; p.vz *= 0.99;
      if (p.life-- <= 0) p.dead = true;
      return;
    }
    if (p.type === 'crit' || p.type === 'magicCrit') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      if (p.age++ >= p.life) p.dead = true;
      moveParticle(p, p.vx, p.vy, p.vz, getBlock);
      p.green *= 0.96; p.blue *= 0.9;
      p.vx *= 0.7; p.vy *= 0.7; p.vz *= 0.7; p.vy -= 0.02;
      p.size = 0.1 * p.baseScale * clamp((p.age / p.life) * 32, 0, 1);
      if (p.onGround) { p.vx *= 0.7; p.vz *= 0.7; }
      return;
    }
    if (p.type === 'smoke' || p.type === 'largesmoke') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      if (p.age++ >= p.life) { p.dead = true; return; }
      p.vy += 0.004;
      const oldY = p.y;
      moveParticle(p, p.vx, p.vy, p.vz, getBlock);
      if (p.y === oldY) { p.vx *= 1.1; p.vz *= 1.1; }
      p.vx *= 0.96; p.vy *= 0.96; p.vz *= 0.96;
      if (p.onGround) { p.vx *= 0.7; p.vz *= 0.7; }
      animateFrame(p, 0);
      p.size = 0.1 * p.baseScale * clamp((p.age / p.life) * 32, 0, 1);
      return;
    }
    if (p.type === 'cloud') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      if (p.age++ >= p.life) { p.dead = true; return; }
      p.tile = 7 - Math.floor(p.age * 8 / p.life);
      moveParticle(p, p.vx, p.vy, p.vz, getBlock);
      p.vx *= 0.96; p.vy *= 0.96; p.vz *= 0.96;
      const player = getPlayerPosition();
      const dx = player[0] - p.x;
      const dy = player[1] + 0.18 - p.y;
      const dz = player[2] - p.z;
      if (dx * dx + dy * dy + dz * dz <= 4 && dy < 0) p.y += dy * 0.2;
      if (p.onGround) { p.vx *= 0.7; p.vz *= 0.7; }
      return;
    }
    if (p.type === 'reddust') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      if (p.age++ >= p.life) { p.dead = true; return; }
      p.tile = 7 - Math.floor(p.age * 8 / p.life);
      const oldY = p.y;
      moveParticle(p, p.vx, p.vy, p.vz, getBlock);
      if (p.y === oldY) { p.vx *= 1.1; p.vz *= 1.1; }
      p.vx *= 0.96; p.vy *= 0.96; p.vz *= 0.96;
      p.size = 0.1 * p.baseScale * clamp((p.age / p.life) * 32, 0, 1);
      if (p.onGround) { p.vx *= 0.7; p.vz *= 0.7; }
      return;
    }
    if (p.type === 'mobSpell' || p.type === 'spell' || p.type === 'instantSpell') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      if (p.age++ >= p.life) { p.dead = true; return; }
      p.tile = (p.type === 'instantSpell' ? 144 : 128) + 7 - Math.floor(p.age * 8 / p.life);
      p.vy += 0.004;
      const oldY = p.y; moveParticle(p, p.vx, p.vy, p.vz, getBlock);
      if (p.y === oldY) { p.vx *= 1.1; p.vz *= 1.1; }
      p.vx *= 0.96; p.vy *= 0.96; p.vz *= 0.96;
      if (p.onGround) { p.vx *= 0.7; p.vz *= 0.7; }
      return;
    }
    if (p.type === 'note') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      if (p.age++ >= p.life) { p.dead = true; return; }
      const oldY = p.y; moveParticle(p, p.vx, p.vy, p.vz, getBlock);
      if (p.y === oldY) { p.vx *= 1.1; p.vz *= 1.1; }
      p.vx *= 0.66; p.vy *= 0.66; p.vz *= 0.66;
      p.size = 0.1 * p.baseScale * clamp((p.age / p.life) * 32, 0, 1);
      if (p.onGround) { p.vx *= 0.7; p.vz *= 0.7; }
      return;
    }
    if (p.type === 'portal' || p.type === 'enchantmenttable') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      const f = p.age / p.life;
      if (p.type === 'portal') {
        let t = -f + f * f * 2;
        t = 1 - t;
        p.x = p.originX + p.vx * t;
        p.y = p.originY + p.vy * t + (1 - f);
        p.z = p.originZ + p.vz * t;
      } else {
        const t = 1 - f;
        let curve = 1 - t; curve *= curve; curve *= curve;
        p.x = p.originX + p.vx * t;
        p.y = p.originY + p.vy * t - curve * 1.2;
        p.z = p.originZ + p.vz * t;
      }
      if (p.type === 'portal') {
        const scaleFade = 1 - Math.pow(1 - f, 2);
        p.size = 0.1 * p.baseScale * scaleFade;
      }
      if (p.age++ >= p.life) p.dead = true;
      return;
    }
    if (p.type === 'explode') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      if (p.age++ >= p.life) { p.dead = true; return; }
      animateFrame(p, 0);
      p.vy += 0.004; moveParticle(p, p.vx, p.vy, p.vz, getBlock);
      p.vx *= 0.9; p.vy *= 0.9; p.vz *= 0.9;
      if (p.onGround) { p.vx *= 0.7; p.vz *= 0.7; }
      return;
    }
    if (p.type === 'flame') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      if (p.age++ >= p.life) { p.dead = true; return; }
      moveParticle(p, p.vx, p.vy, p.vz, getBlock);
      p.vx *= 0.96; p.vy *= 0.96; p.vz *= 0.96;
      const flameAge = p.age / p.life;
      p.size = 0.1 * p.baseScale * (1 - flameAge * flameAge * 0.5);
      if (p.onGround) { p.vx *= 0.7; p.vz *= 0.7; }
      return;
    }
    if (p.type === 'lava') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      if (p.age++ >= p.life) { p.dead = true; return; }
      if (rand() > p.age / p.life) spawn('smoke', p.x, p.y, p.z, p.vx, p.vy, p.vz);
      p.vy -= 0.03; moveParticle(p, p.vx, p.vy, p.vz, getBlock);
      p.vx *= 0.999; p.vy *= 0.999; p.vz *= 0.999;
      if (p.onGround) { p.vx *= 0.7; p.vz *= 0.7; }
      const lavaAge = p.age / p.life;
      p.size = 0.1 * p.baseScale * (1 - lavaAge * lavaAge);
      return;
    }
    if (p.type === 'splash') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      p.vy -= p.gravity;
      moveParticle(p, p.vx, p.vy, p.vz, getBlock);
      p.vx *= 0.98; p.vy *= 0.98; p.vz *= 0.98;
      if (p.life-- <= 0 || (p.onGround && rand() < 0.5)) p.dead = true;
      const liquidId = getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
      if (isBelowFluidSurface(p, liquidId)) p.dead = true;
      return;
    }
    if (p.type === 'dripWater' || p.type === 'dripLava') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      if (p.dripKind === 'dripWater') {
        p.red = 0.2; p.green = 0.3; p.blue = 1;
      } else {
        p.red = 1;
        p.green = 16 / (40 - p.dripAge + 16);
        p.blue = 4 / (40 - p.dripAge + 8);
      }
      if (p.dripAge-- > 0) {
        p.vx *= 0.02; p.vy *= 0.02; p.vz *= 0.02; p.tile = 113;
      } else p.tile = 112;
      p.vy -= p.gravity;
      moveParticle(p, p.vx, p.vy, p.vz, getBlock);
      p.vx *= 0.98; p.vy *= 0.98; p.vz *= 0.98;
      if (p.life-- <= 0) p.dead = true;
      if (p.onGround) {
        if (p.type === 'dripWater') { p.dead = true; spawn('splash', p.x, p.y, p.z); }
        else p.tile = 114;
        p.vx *= 0.7; p.vz *= 0.7;
      }
      const id = getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
      if (((p.type === 'dripWater' && (id === 8 || id === 9)) ||
           (p.type === 'dripLava' && (id === 10 || id === 11))) &&
          isBelowFluidSurface(p, id)) p.dead = true;
      return;
    }
    if (p.type === 'snowshovel') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      if (p.age++ >= p.life) { p.dead = true; return; }
      p.tile = 7 - Math.floor(p.age * 8 / p.life);
      p.vy -= 0.03; moveParticle(p, p.vx, p.vy, p.vz, getBlock);
      p.vx *= 0.99; p.vy *= 0.99; p.vz *= 0.99;
      p.size = 0.1 * p.baseScale * clamp((p.age / p.life) * 32, 0, 1);
      if (p.onGround) { p.vx *= 0.7; p.vz *= 0.7; }
      return;
    }
    if (p.type === 'heart') {
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      if (p.age++ >= p.life) { p.dead = true; return; }
      const oldY = p.y; moveParticle(p, p.vx, p.vy, p.vz, getBlock);
      if (p.y === oldY) { p.vx *= 1.1; p.vz *= 1.1; }
      p.vx *= 0.86; p.vy *= 0.86; p.vz *= 0.86;
      p.size = 0.1 * p.baseScale * clamp((p.age / p.life) * 32, 0, 1);
      if (p.onGround) { p.vx *= 0.7; p.vz *= 0.7; }
      return;
    }
    tickBase(p, getBlock);
  }

  function buildLayerMesh(list, partialTick, yaw, pitch, layer) {
    const positions = [], uvs = [], normals = [], colors = [], alphas = [], indices = [];
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const sp = Math.sin(pitch), cp = Math.cos(pitch);
    const f3 = cy, f4 = sy, f5 = -sy * sp, f6 = cy * sp, f7 = cp;
    for (const p of list) {
      if (p.dead || p.special === 'emitter') continue;
      const x = p.prevX + (p.x - p.prevX) * partialTick;
      const y = p.prevY + (p.y - p.prevY) * partialTick;
      const z = p.prevZ + (p.z - p.prevZ) * partialTick;
      const age = p.age + partialTick;
      const progress = clamp(age / Math.max(1, p.life), 0, 1);
      let size = p.size;
      let alpha = p.alpha;
      if (['smoke','largesmoke','cloud','reddust','crit','magicCrit','note','snowshovel','heart'].includes(p.type)) {
        size = 0.1 * p.baseScale * clamp((age / Math.max(1, p.life)) * 32, 0, 1);
      } else if (p.type === 'flame') {
        size = 0.1 * p.baseScale * (1 - progress * progress * 0.5);
      } else if (p.type === 'lava') {
        size = 0.1 * p.baseScale * (1 - progress * progress);
      } else if (p.type === 'portal') {
        size = 0.1 * p.baseScale * (1 - Math.pow(1 - progress, 2));
      }
      if (p.special === 'footstep') {
        alpha = 0.2 * clamp(2 - progress * progress * 2, 0, 1);
      }
      const base = positions.length / 3;
      if (p.special === 'footstep') {
        const s = 0.125;
        positions.push(x-s,y,z+s, x+s,y,z+s, x+s,y,z-s, x-s,y,z-s);
        uvs.push(0,1, 1,1, 1,0, 0,0);
        for (let j=0;j<4;j++) { normals.push(0,1,0); colors.push(p.red,p.green,p.blue); alphas.push(alpha); }
      } else {
        positions.push(
          x-f3*size-f6*size, y-f4*size, z-f5*size-f7*size,
          x-f3*size+f6*size, y+f4*size, z-f5*size+f7*size,
          x+f3*size+f6*size, y+f4*size, z+f5*size+f7*size,
          x+f3*size-f6*size, y-f4*size, z+f5*size-f7*size
        );
        let u0, u1, v0, v1;
        if (layer === 1 || layer === 2) {
          u0 = ((p.tile & 15) + p.subU / 4) / 16;
          u1 = u0 + 0.015609375;
          v0 = ((p.tile >> 4) + p.subV / 4) / 16;
          v1 = v0 + 0.015609375;
        } else {
          u0 = (p.tile % 16) / 16;
          u1 = u0 + 0.0624375;
          v0 = Math.floor(p.tile / 16) / 16;
          v1 = v0 + 0.0624375;
        }
        uvs.push(u0,v1, u0,v0, u1,v0, u1,v1);
        for (let j=0;j<4;j++) { normals.push(0,1,0); colors.push(p.red,p.green,p.blue); alphas.push(alpha); }
      }
      indices.push(base,base+1,base+2, base,base+2,base+3);
    }
    return {
      positions: new Float32Array(positions), uvs: new Float32Array(uvs),
      normals: new Float32Array(normals), colors: new Float32Array(colors), alphas: new Float32Array(alphas),
      indices: new Uint16Array(indices)
    };
  }

  function buildExplosionMesh(partialTick, yaw, pitch) {
    const positions = [], uvs = [], normals = [], colors = [], alphas = [], indices = [];
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const sp = Math.sin(pitch), cp = Math.cos(pitch);
    const f3 = cy, f4 = sy, f5 = -sy * sp, f6 = cy * sp, f7 = cp;
    for (const p of explosions) {
      if (p.dead) continue;
      const frame = Math.floor(((p.age + partialTick) * 15) / p.life);
      if (frame > 15) continue;
      const x = p.prevX + (p.x - p.prevX) * partialTick;
      const y = p.prevY + (p.y - p.prevY) * partialTick;
      const z = p.prevZ + (p.z - p.prevZ) * partialTick;
      const s = 2 * p.explosionScale;
      const base = positions.length / 3;
      positions.push(
        x-f3*s-f6*s,y-f4*s,z-f5*s-f7*s,
        x-f3*s+f6*s,y+f4*s,z-f5*s+f7*s,
        x+f3*s+f6*s,y+f4*s,z+f5*s+f7*s,
        x+f3*s-f6*s,y-f4*s,z+f5*s-f7*s
      );
      const u0 = (frame % 4) / 4, u1 = u0 + 0.24975;
      const v0 = Math.floor(frame / 4) / 4, v1 = v0 + 0.24975;
      uvs.push(u0,v1,u0,v0,u1,v0,u1,v1);
      for (let j=0;j<4;j++) { normals.push(0,1,0); colors.push(p.red,p.green,p.blue); alphas.push(1); }
      indices.push(base,base+1,base+2,base,base+2,base+3);
    }
    return { positions:new Float32Array(positions), uvs:new Float32Array(uvs),
      normals:new Float32Array(normals), colors:new Float32Array(colors), alphas:new Float32Array(alphas),
      indices:new Uint16Array(indices) };
  }

  function tick() {
    const explosionsAtStart = explosions.slice();
    for (let layer = 0; layer < 4; layer++) {
      const list = layers[layer];
      for (let i = 0; i < list.length; i++) {
        tickParticle(list[i]);
        if (list[i].dead) list.splice(i--, 1);
      }
    }
    for (const particle of explosionsAtStart) {
      const index = explosions.indexOf(particle);
      if (index < 0) continue;
      tickParticle(particle);
      if (particle.dead) explosions.splice(index, 1);
    }
  }

  function buildMeshes(partialTick, yaw, pitch) {
    return {
      layers: layers.map((list, layer) => buildLayerMesh(list, partialTick, yaw, pitch, layer)),
      explosions: buildExplosionMesh(partialTick, yaw, pitch)
    };
  }

  return {
    spawn, spawnBlockBreak, spawnBlockHit, tick, buildMeshes,
    setParticleSetting(value) { setting = clamp(value | 0, 0, 2); },
    get count() { return layers.reduce((n, list) => n + list.length, 0) + explosions.length; },
    get counts() { return [...layers.map(list => list.length), explosions.length]; }
  };
}
