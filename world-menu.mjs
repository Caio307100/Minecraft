import { createWorldStorage } from './world-storage.mjs';
import { createVanillaPanorama } from './panorama-renderer.mjs';
import { loadMinecraftFont, setMinecraftText } from './minecraft-font.mjs';
import { asset, labels, styleText, el } from './world-menu-ui.mjs';
import { createWorldScreen } from './create-world-screen.mjs';
import { createOptionsScreen } from './mc-options-screen.mjs';

const storage = createWorldStorage();

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
  const readGuiScaleSetting = () => {
    try {
      const rows = (localStorage.getItem('mc10-options.txt') || '').split(/\r?\n/);
      const line = rows.find(value => value.startsWith('guiScale:'));
      if (line) return Math.max(0, Math.min(3, Number(line.slice(9)) || 0));
      const legacy = JSON.parse(localStorage.getItem('mc10-video-options') || '{}');
      return Number.isInteger(legacy.guiScale) ? Math.max(0, Math.min(3, legacy.guiScale)) : 0;
    } catch { return 0; }
  };
  const updateGuiSize = () => {
    // ef.java do Minecraft 1.0: 0 = Auto; escalas explícitas respeitam 320x240.
    const requested = readGuiScaleSetting();
    const maxFit = Math.max(1, Math.floor(Math.min(innerWidth / 320, innerHeight / 240)));
    guiScale = requested === 0 ? maxFit : Math.max(1, Math.min(requested, maxFit));
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
    let buttonLabel = value;
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
      setMinecraftText(label, buttonLabel, font, { scale: 1, shadow: true });
    };
    node.addEventListener('mouseenter', drawSprite); node.addEventListener('mouseleave', drawSprite);
    node.addEventListener('click', () => { playButtonSound(); onClick?.(); });
    node.refreshButtonSprite = drawSprite;
    node.setButtonLabel = next => { buttonLabel = next; drawSprite(); };
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
    button(content, labels.options, x, y + 84, 98, () => optionsUi?.open());
    button(content, labels.quit, Math.floor(guiWidth / 2) + 2, y + 84, 98, () => window.close());
  };

  let optionsUi = null;
  let selectedId = null;
  let worldsCache = [];
  const selectScreen = async () => {
    activeScreen = selectScreen;
    clearContent();
    panorama.style.display = 'none';
    root.style.backgroundColor = '#404040';
    const backgroundUrl = window.mcAssetUrl?.(asset('gui/background.png')) ?? asset('gui/background.png');
    root.style.backgroundImage = `url("${backgroundUrl}")`;
    root.style.backgroundRepeat = 'repeat';
    root.style.backgroundPosition = 'top left';
    root.style.backgroundBlendMode = 'multiply';
    root.style.backgroundSize = '32px 32px';
    title(labels.selectTitle);
    const list = el('div', { className: 'mc10-world-list' });
    list.style.backgroundImage = `url("${backgroundUrl}")`;
    list.addEventListener('scroll', () => { list.style.backgroundPositionY = `${-Math.floor(list.scrollTop)}px`; }, { passive: true });
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
      play.refreshButtonSprite();
      rename.refreshButtonSprite();
      remove.refreshButtonSprite();
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

      // go (GuiYesNo) do Minecraft 1.0: mantém o fundo da tela anterior,
      // desenha duas linhas centralizadas e usa dois botões vanilla lado a lado.
      activeScreen = deleteDialog;
      clearContent();
      const message = "'" + world.name + "' " + labels.deleteWarning;
      text(content, labels.deleteQuestion, guiWidth / 2, 70, '#fff', true);
      text(content, message, guiWidth / 2, 90, '#fff', true);
      const buttonY = Math.floor(guiHeight / 6) + 96;
      const left = Math.floor(guiWidth / 2) - 155;
      button(content, labels.delete, left, buttonY, 150, async () => {
        await storage.deleteWorld(world.id);
        selectedId = null;
        selectScreen();
      });
      button(content, labels.cancel, left + 160, buttonY, 150, selectScreen);
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

  const createScreen = createWorldScreen({
    content, guiHeight, font, storage, text, button, title, clearContent, mainScreen, finish, dialog,
    setActiveScreen: screen => { activeScreen = screen; }
  });

  optionsUi = createOptionsScreen({
    content, getSize: () => ({ width: guiWidth, height: guiHeight }), font, button, text, guiAtlas,
    clearContent, mainScreen, playButtonSound,
    setActiveScreen: screen => { activeScreen = screen; },
    onGuiScaleChange: updateGuiSize
  });

  mainScreen();
  const resizeHandler = () => { updateGuiSize(); activeScreen?.(); };
  window.addEventListener('resize', resizeHandler);
  menuResult.finally(() => window.removeEventListener('resize', resizeHandler));
  return menuResult;
}
