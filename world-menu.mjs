import { createWorldStorage } from './world-storage.mjs';
import { createVanillaPanorama } from './panorama-renderer.mjs';
import { loadMinecraftFont, setMinecraftText } from './minecraft-font.mjs';

const storage = createWorldStorage();
const asset = path => `./public/assets/mc10/${path}`;
const labels = {
  singleplayer: 'Singleplayer', multiplayer: 'Multiplayer', texturePacks: 'Texture Packs',
  options: 'Options...', quit: 'Quit Game', selectTitle: 'Select World',
  play: 'Play Selected World', create: 'Create New World', rename: 'Rename', delete: 'Delete', cancel: 'Cancel',
  renameTitle: 'Rename World', renameButton: 'Rename', newWorld: 'New World', worldName: 'World Name',
  resultFolder: 'Will be saved in:', enterSeed: 'Seed for the World Generator', seedInfo: 'Leave blank for a random seed',
  gameMode: 'Game Mode:', survival: 'Survival', creative: 'Creative', hardcore: 'Hardcore',
  survival1: 'Search for resources, crafting, gain', survival2: 'levels, health and hunger',
  creative1: 'Unlimited resources, free flying and', creative2: 'destroy blocks instantly',
  hardcore1: 'Same as survival mode, locked at hardest', hardcore2: 'difficulty, and one life only',
  more: 'More World Options...', done: 'Done', structures: 'Generate Structures:', on: 'ON', off: 'OFF',
  structuresInfo: 'Villages, dungeons etc', worldType: 'World Type: Normal',
  deleteQuestion: 'Are you sure you want to delete this world?', deleteWarning: 'will be lost forever! (A long time!)'
};

const styleText = `
#mc10-menu{position:fixed;inset:0;z-index:200;overflow:hidden;color:#fff;font-family:monospace;image-rendering:pixelated;user-select:none}
#mc10-panorama{position:absolute;inset:0;perspective:200px;perspective-origin:50% 50%;overflow:hidden;background:#000}
#mc10-panorama-cube{position:absolute;width:256px;height:256px;left:50%;top:50%;margin:-128px 0 0 -128px;transform-style:preserve-3d;animation:mc10-pan 42s linear infinite}
.mc10-pan-face{position:absolute;left:0;top:0;width:256px;height:256px;background-size:256px 256px;backface-visibility:hidden}
.mc10-pan-face:nth-child(1){transform:translateZ(128px);}
.mc10-pan-face:nth-child(2){transform:rotateY(90deg) translateZ(128px);}
.mc10-pan-face:nth-child(3){transform:rotateY(180deg) translateZ(128px);}
.mc10-pan-face:nth-child(4){transform:rotateY(-90deg) translateZ(128px);}
.mc10-pan-face:nth-child(5){transform:rotateX(90deg) translateZ(128px);}
.mc10-pan-face:nth-child(6){transform:rotateX(-90deg) translateZ(128px);}
@keyframes mc10-pan{0%{transform:scaleX(1.55) scaleY(.87) rotateX(20deg) rotateY(0deg)}50%{transform:scaleX(1.55) scaleY(.87) rotateX(27deg) rotateY(-180deg)}100%{transform:scaleX(1.55) scaleY(.87) rotateX(20deg) rotateY(-360deg)}}

#mc10-panorama:after{content:"";position:absolute;inset:0;background:rgba(0,0,0,.10);pointer-events:none}
#mc10-menu-content{position:absolute;inset:0;text-shadow:1px 1px 0 #3f3f3f;font-size:8px}
#mc10-logo{position:absolute;top:30px;left:50%;width:274px;height:44px;transform:translateX(-50%);image-rendering:pixelated}
.mc10-splash{position:absolute;top:62px;left:calc(50% + 90px);color:#ffff00;font-size:10px;white-space:nowrap;transform:rotate(-20deg);animation:mc10-splash 1s ease-in-out infinite alternate}
@keyframes mc10-splash{from{scale:var(--splash-min)}to{scale:var(--splash-max)}}
.mc10-footer{position:absolute;bottom:5px;font-size:8px;color:#fff}.mc10-footer.left{left:2px}.mc10-footer.right{right:2px}
.mc10-screen-title{position:absolute;top:20px;left:0;width:100%;text-align:center;font-size:16px;color:#fff}
.mc10-button{position:absolute;height:20px;border:0;border-radius:0;padding:0;background:transparent;display:flex;align-items:center;justify-content:center;color:#e0e0e0;font:8px monospace;text-shadow:1px 1px #3f3f3f;cursor:pointer;image-rendering:pixelated}
.mc10-button:disabled{color:#a0a0a0;cursor:default}
.mc10-button span{position:relative;z-index:1}
.mc10-button.mc10-wide{width:200px}
.mc10-button.mc10-small{width:98px}
.mc10-world-list{position:absolute;top:32px;left:0;width:100%;height:calc(100% - 64px);overflow-y:auto;overflow-x:hidden;scrollbar-width:none;background:rgba(0,0,0,.45)}
.mc10-world-entry{position:relative;display:block;box-sizing:border-box;width:220px;height:36px;margin:0 auto;padding:0 2px;border:0;cursor:pointer;color:#fff;text-align:left;background:transparent}
.mc10-world-entry.selected:before{content:'';position:absolute;inset:0;border:1px solid #fff;background:rgba(255,255,255,.18);pointer-events:none}

.mc10-world-entry .name{position:relative;z-index:1;font-size:8px;line-height:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc10-world-entry .detail,.mc10-world-entry .mode{position:relative;z-index:1;font-size:8px;color:#808080;line-height:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.mc10-form{position:absolute;left:50%;top:0;transform:translateX(-50%);width:min(310px,94vw);height:100%;font-size:8px}
.mc10-label{position:absolute;left:0;color:#a0a0a0;height:12px;white-space:nowrap}
.mc10-input{position:absolute;left:50%;transform:translateX(-50%);width:200px;height:20px;padding:2px 4px;border:2px solid #a0a0a0;border-right-color:#555;border-bottom-color:#555;border-radius:0;background:#000;color:#fff;font:8px monospace;outline:none}
.mc10-input:focus{border-color:#fff}
.mc10-description{position:absolute;left:0;color:#a0a0a0;line-height:12px;white-space:nowrap}
.mc10-dialog{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(300px,92vw);padding:16px 12px;background:#202020;border:2px solid #aaa;text-align:center;box-shadow:0 0 0 100vmax #0008}
.mc10-dialog p{font-size:8px;line-height:14px;margin:0 0 8px}
`;

function el(tag, props = {}, text = '') {
  const node = document.createElement(tag);
  Object.assign(node, props);
  if (text) node.textContent = text;
  return node;
}

export async function openWorldMenu() {
  const font = await loadMinecraftFont();
  if (!document.querySelector('#mc10-menu-style')) {
    const style = el('style', { id: 'mc10-menu-style' });
    style.textContent = styleText;
    document.head.append(style);
  }

  // xe.java do Minecraft 1.0 toca random.click em todo GuiButton ativado.
  const buttonClickSound = new Audio(window.mcAssetUrl?.(asset('sounds/random/click.ogg')) ?? asset('sounds/random/click.ogg'));
  buttonClickSound.preload = 'auto';
  const playButtonSound = () => {
    const sound = buttonClickSound.cloneNode();
    sound.volume = 1;
    sound.play().catch(() => {});
  };

  const root = el('div', { id: 'mc10-menu' });
  let guiScale = 1, guiWidth = 0, guiHeight = 0;
  const updateGuiSize = () => {
    // ef.java do Minecraft 1.0: guiScale 0 (Auto), mínimo 320x240,
    // sem limite artificial de escala e dimensões arredondadas para cima.
    guiScale = 1;
    while (innerWidth / (guiScale + 1) >= 320 && innerHeight / (guiScale + 1) >= 240) guiScale++;
    guiWidth = Math.ceil(innerWidth / guiScale);
    guiHeight = Math.ceil(innerHeight / guiScale);
    content.style.width = `${guiWidth}px`; content.style.height = `${guiHeight}px`;
    content.style.transform = `scale(${guiScale})`;
  };
  const panorama = el('div', { id: 'mc10-panorama' });
  const panoramaCanvas = el('canvas', { width: 256, height: 256 });
  panoramaCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;image-rendering:auto';
  panorama.append(panoramaCanvas);
  let stopPanorama = () => {};
  stopPanorama = await createVanillaPanorama(panoramaCanvas, asset);
  const content = el('div', { id: 'mc10-menu-content' });
  content.style.transformOrigin = 'top left';
  updateGuiSize();
  root.append(panorama, content);
  document.body.append(root);

  const text = (parent, value, x, y, color = '#fff', centered = false) => {
    const node = el('div');
    node.style.position = 'absolute';
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.color = color;
    if (centered) node.style.transform = 'translateX(-50%)';
    setMinecraftText(node, value, font, { scale: 1, shadow: true });
    parent.append(node);
    return node;
  };
  const button = (parent, value, x, y, width = 200, onClick, disabled = false) => {
    const node = el('button', { className: 'mc10-button', type: 'button', disabled });
    node.style.left = `${x}px`; node.style.top = `${y}px`; node.style.width = `${width}px`;
    const sprite = el('canvas', { width, height: 20 });
    sprite.style.position = 'absolute'; sprite.style.inset = '0'; sprite.style.width = `${width}px`; sprite.style.height = '20px';
    sprite.style.imageRendering = 'pixelated'; sprite.style.pointerEvents = 'none';
    const spriteCtx = sprite.getContext('2d');
    const label = el('span');
    node.append(sprite, label);
    const drawSprite = () => {
      const hovered = node.matches(':hover');
      const state = node.disabled ? 0 : hovered ? 2 : 1;
      const sy = 46 + state * 20, half = width / 2;
      spriteCtx.clearRect(0, 0, width, 20);
      spriteCtx.drawImage(guiAtlas, 0, sy, half, 20, 0, 0, half, 20);
      spriteCtx.drawImage(guiAtlas, 200 - half, sy, half, 20, half, 0, width - half, 20);
      // ct.java do Minecraft 1.0: a cor é herdada pelos glifos via currentColor.
      label.style.color = node.disabled ? '#a0a0a0' : hovered ? '#ffffa0' : '#e0e0e0';
      setMinecraftText(label, value, font, { scale: 1, shadow: true });
    };
    node.addEventListener('mouseenter', drawSprite); node.addEventListener('mouseleave', drawSprite);
    node.addEventListener('click', () => { playButtonSound(); onClick?.(); });
    node.addEventListener('change', drawSprite);
    drawSprite();
    parent.append(node);
    return node;
  };
  const title = (value) => text(content, value, guiWidth / 2, 20, '#fff', true);
  const footer = () => {
    const left = text(content, 'Minecraft 1.0.0', 2, guiHeight - 10, '#fff');
    const right = text(content, 'Copyright Mojang AB. Do not distribute!', guiWidth - font.measureText('Copyright Mojang AB. Do not distribute!') - 2, guiHeight - 10, '#fff');
    left.className = 'mc10-footer left'; right.className = 'mc10-footer right';
  };
  const guiAtlas = new Image(); guiAtlas.src = asset('gui/gui.png'); await guiAtlas.decode();
  const logo = el('canvas', { id: 'mc10-logo', width: 274, height: 44 });
  const logoImage = new Image();
  logoImage.src = asset('title/mclogo.png');
  await logoImage.decode();
  const logoCtx = logo.getContext('2d');
  logoCtx.imageSmoothingEnabled = false;
  // GuiMainMenu.a() do Minecraft 1.0: recortes originais do logo (274x44).
  logoCtx.drawImage(logoImage, 0, 0, 99, 44, 0, 0, 99, 44);
  logoCtx.drawImage(logoImage, 129, 0, 27, 44, 99, 0, 27, 44);
  logoCtx.drawImage(logoImage, 126, 0, 3, 44, 126, 0, 3, 44);
  logoCtx.drawImage(logoImage, 99, 0, 26, 44, 129, 0, 26, 44);
  logoCtx.drawImage(logoImage, 0, 45, 155, 44, 155, 0, 119, 44);
  content.append(logo);
  const splashLines = (await (await fetch(asset('title/splashes.txt'))).text()).split(/\r?\n/).filter(Boolean);
  const splash = splashLines[Math.floor(Math.random() * splashLines.length)] || 'missingno';
  let splashNode = text(content, splash, guiWidth / 2 + 90, 70, '#ffff00');
  splashNode.style.transformOrigin = 'left center';
  splashNode.style.transform = 'rotate(-20deg)';
  const splashScale = 100 / (font.measureText(splash) + 32);
  splashNode.style.setProperty('--splash-min', String(1.7 * splashScale));
  splashNode.style.setProperty('--splash-max', String(1.8 * splashScale));
  splashNode.style.animation = 'mc10-splash 1s ease-in-out infinite alternate';

  let resolveMenu;
  const menuResult = new Promise(resolve => { resolveMenu = resolve; });
  const clearContent = () => {
    content.replaceChildren();
  };
  const finish = value => { stopPanorama(); root.remove(); resolveMenu(value); };
  const load = async id => finish(await storage.loadWorld(id));
  let activeScreen = null;
  const mainScreen = () => {
    activeScreen = mainScreen;
    panorama.style.display = '';
    root.style.background = '';
    clearContent();
    content.append(logo);
    splashNode = text(content, splash, guiWidth / 2 + 90, 70, '#ffff00');
    splashNode.style.transformOrigin = 'left center';
    splashNode.style.transform = 'rotate(-20deg)';
    const splashScale = 100 / (font.measureText(splash) + 32);
    splashNode.style.setProperty('--splash-min', String(1.7 * splashScale));
    splashNode.style.setProperty('--splash-max', String(1.8 * splashScale));
    splashNode.style.animation = 'mc10-splash 1s ease-in-out infinite alternate';
    footer();
    const y = Math.floor(guiHeight / 4) + 48;
    const x = Math.floor(guiWidth / 2) - 100;
    button(content, labels.singleplayer, x, y, 200, selectScreen);
    button(content, labels.multiplayer, x, y + 24, 200, () => {});
    button(content, labels.texturePacks, x, y + 48, 200, () => {});
    button(content, labels.options, x, y + 84, 98, () => {});
    button(content, labels.quit, Math.floor(guiWidth / 2) + 2, y + 84, 98, () => window.close());
  };

  let selectedId = null;
  let worldsCache = [];
  const selectScreen = async () => {
    activeScreen = selectScreen;
    clearContent();
    panorama.style.display = 'none';
    root.style.backgroundColor = '#202020';
    const backgroundUrl = window.mcAssetUrl?.(asset('gui/background.png')) ?? asset('gui/background.png');
    root.style.backgroundImage = `url("${backgroundUrl}")`;
    root.style.backgroundRepeat = 'repeat';
    root.style.backgroundPosition = 'top left';
    root.style.backgroundSize = '32px 32px';
    title(labels.selectTitle);
    const list = el('div', { className: 'mc10-world-list' });
    content.append(list);
    const refresh = async () => {
      worldsCache = await storage.listWorlds();
      list.replaceChildren();
      worldsCache.forEach((world, index) => {
        const row = el('div', { className: 'mc10-world-entry' + (selectedId === world.id ? ' selected' : ''), tabIndex: 0 });
        const name = el('div', { className: 'name' });
        const detail = el('div', { className: 'detail' });
        const mode = el('div', { className: 'mode' });
        setMinecraftText(name, world.name || (labels.worldName + ' ' + (index + 1)), font);
        const playedAt = world.lastPlayed || world.createdAt;
        const dateText = playedAt ? new Date(playedAt).toLocaleString() : '';
        const modeText = world.hardcore ? 'Hardcore Mode' : (world.gameMode === 'creative' ? 'Creative Mode' : 'Survival Mode');
        const details = [world.id, dateText && `(${dateText})`].filter(Boolean).join(' ');
        setMinecraftText(detail, details, font);
        setMinecraftText(mode, modeText, font);
        row.append(name, detail, mode);
        row.addEventListener('click', () => { selectedId = world.id; refresh(); });
        row.addEventListener('dblclick', () => load(world.id));
        row.addEventListener('keydown', event => { if (event.key === 'Enter') load(world.id); });
        list.append(row);
      });
    };
    await refresh();
    const x = guiWidth / 2;
    const y1 = guiHeight - 52;
    const y2 = guiHeight - 28;
    const play = button(content, labels.play, x - 154, y1, 150, () => selectedId && load(selectedId), true);
    const rename = button(content, labels.rename, x - 154, y2, 70, () => selectedId && renameDialog(), true);
    const remove = button(content, labels.delete, x - 74, y2, 70, () => selectedId && deleteDialog(), true);
    button(content, labels.create, x + 4, y1, 150, createScreen);
    button(content, labels.cancel, x + 4, y2, 150, mainScreen);
    const sync = () => {
      const enabled = worldsCache.some(world => world.id === selectedId && !world.requiresNewerVersion);
      play.disabled = rename.disabled = remove.disabled = !enabled;
    };
    list.addEventListener('click', sync);
    sync();
    async function renameDialog() {
      const world = worldsCache.find(item => item.id === selectedId);
      if (!world) return;
      dialog(labels.renameTitle, world.name, labels.renameButton, async value => {
        if (!value.trim()) return;
        await storage.renameWorld(world.id, value);
        await refresh(); sync();
      });
    }
    async function deleteDialog() {
      const world = worldsCache.find(item => item.id === selectedId);
      if (!world) return;
      dialog(labels.delete, labels.deleteQuestion + "\\n'" + world.name + "' " + labels.deleteWarning, labels.delete, async () => {
        await storage.deleteWorld(world.id);
        selectedId = null;
        await refresh(); sync();
      }, true);
    }
  };

  const dialog = (heading, initial, confirmText, onConfirm, messageOnly = false) => {
    const box = el('div', { className: 'mc10-dialog' });
    const p = el('p'); setMinecraftText(p, heading, font); box.append(p);
    let input;
    if (messageOnly) { const message = el('p'); setMinecraftText(message, initial, font); box.append(message); }
    else { input = el('input', { className: 'mc10-input', value: initial, maxLength: 32 }); input.style.position = 'relative'; input.style.left = 'auto'; input.style.transform = 'none'; box.append(input); }
    const confirm = el('button', { className: 'mc10-button', type: 'button' }); confirm.style.position = 'relative'; confirm.style.left = 'auto'; confirm.style.margin = '12px 4px 0'; confirm.style.width = '120px'; setMinecraftText(confirm, confirmText, font);
    const cancel = el('button', { className: 'mc10-button', type: 'button' }); cancel.style.position = 'relative'; cancel.style.left = 'auto'; cancel.style.margin = '12px 4px 0'; cancel.style.width = '120px'; setMinecraftText(cancel, labels.cancel, font);
    confirm.addEventListener('click', async () => { playButtonSound(); await onConfirm(input?.value ?? ''); box.remove(); });
    cancel.addEventListener('click', () => { playButtonSound(); box.remove(); });
    box.append(confirm, cancel); content.append(box); input?.focus(); input?.select();
  };

  const createScreen = () => {
    activeScreen = createScreen;
    clearContent();
    title(labels.create);
    const form = el('div', { className: 'mc10-form' });
    content.append(form);
    const label = (value, y) => text(form, value, 0, y, '#a0a0a0');
    const input = (placeholder, value, y) => {
      const node = el('input', { className: 'mc10-input', placeholder, value, maxLength: 32 });
      node.style.top = `${y}px`; form.append(node); return node;
    };
    label(labels.worldName, 47);
    const name = input('', labels.newWorld, 60);
    label(`${labels.resultFolder} ${labels.newWorld}`, 85);
    label(labels.gameMode, 122);
    let mode = 'survival';
    const modeButton = button(form, `${labels.gameMode} ${labels.survival}`, 80, 100, 150, () => {
      mode = mode === 'survival' ? 'hardcore' : mode === 'hardcore' ? 'creative' : 'survival';
      const modeLabel = mode === 'survival' ? labels.survival : mode === 'creative' ? labels.creative : labels.hardcore;
      setMinecraftText(modeButton, `${labels.gameMode} ${modeLabel}`, font);
      const lines = mode === 'creative' ? [labels.creative1, labels.creative2] : mode === 'hardcore' ? [labels.hardcore1, labels.hardcore2] : [labels.survival1, labels.survival2];
      setMinecraftText(description1, lines[0], font); setMinecraftText(description2, lines[1], font);
    });
    modeButton.style.position = 'absolute';
    const description1 = text(form, labels.survival1, 0, 142, '#a0a0a0');
    const description2 = text(form, labels.survival2, 0, 154, '#a0a0a0');
    const more = button(form, labels.more, 80, 172, 150, () => {
      moreOptions.hidden = !moreOptions.hidden;
      setMinecraftText(more, moreOptions.hidden ? labels.more : labels.done, font);
    });
    more.style.position = 'absolute';
    const moreOptions = el('div'); moreOptions.hidden = true; form.append(moreOptions);
    const seedLabel = text(moreOptions, labels.enterSeed, 0, 202, '#a0a0a0');
    const seed = input(labels.seedInfo, '', 215); seed.hidden = true;
    seedLabel.hidden = true;
    const structures = button(moreOptions, `${labels.structures} ${labels.on}`, 80, 245, 150, () => {
      structuresEnabled = !structuresEnabled;
      setMinecraftText(structures, `${labels.structures} ${structuresEnabled ? labels.on : labels.off}`, font);
    });
    structures.style.position = 'absolute';
    let structuresEnabled = true;
    const cancel = button(form, labels.cancel, 155, guiHeight - 28, 150, mainScreen); cancel.style.position = 'absolute';
    const create = button(form, labels.create, 5, guiHeight - 28, 150, async () => {
      try {
        const meta = await storage.createWorld({ name: name.value, seedText: moreOptions.hidden ? '' : seed.value });
        const selected = await storage.loadWorld(meta.id);
        selected.meta.gameMode = mode;
        selected.meta.generateStructures = structuresEnabled;
        finish(selected);
      } catch (error) { dialog('Error', error.message, labels.done, () => {}); }
    }); create.style.position = 'absolute';
    // GuiCreateWorld keeps the seed field on the advanced-options page.
    moreOptions.append(seedLabel, seed, structures);
    seed.hidden = true; seed.style.top = '215px'; seedLabel.hidden = true;
  };

  mainScreen();
  const resizeHandler = () => { updateGuiSize(); activeScreen?.(); };
  window.addEventListener('resize', resizeHandler);
  menuResult.finally(() => window.removeEventListener('resize', resizeHandler));
  return menuResult;
}
