import { makeWorldId } from './world-storage.mjs';
import { setMinecraftText } from './minecraft-font.mjs';
import { el, labels } from './world-menu-ui.mjs';

// Tela de criação: montagem, estado, opções avançadas e persistência do mundo.
export function createWorldScreen({ content, guiHeight, font, storage, text, button, title, clearContent, mainScreen, finish, dialog, setActiveScreen }) {
  const createScreen = () => {
    setActiveScreen(createScreen);
    clearContent();
    title(labels.create);
    const form = el('div', { className: 'mc10-form' });
    content.append(form);
    const label = (value, x, y) => text(form, value, x, y, '#a0a0a0');
    const input = (value, y) => {
      const box = el('div', { className: 'mc10-textbox' });
      box.style.top = `${y}px`;
      const rendered = el('span');
      const cursor = el('span', { className: 'mc-cursor' });
      const native = el('input', { className: 'mc10-textbox-input', value, maxLength: 32, spellcheck: false, autocomplete: 'off' });
      const render = () => {
        setMinecraftText(rendered, native.value, font, { scale: 1, shadow: false });
        cursor.hidden = document.activeElement !== native;
      };
      native.addEventListener('input', render);
      native.addEventListener('focus', render);
      native.addEventListener('blur', render);
      box.addEventListener('mousedown', event => { if (event.target !== native) { event.preventDefault(); native.focus(); } });
      box.append(rendered, cursor, native);
      form.append(box);
      render();
      return native;
    };

    let mode = 'survival';
    let structuresEnabled = true;
    let advanced = false;
    // Grade fixa de 310 px: origem no centro do menu menos 155 px, igual a xh.java.
    const worldNameLabel = label(labels.worldName, 55, 47);
    const name = input(labels.newWorld, 60);
    const folder = label(`${labels.resultFolder} ${labels.newWorld}`, 55, 85);
    const gameMode = button(form, `${labels.gameMode} ${labels.survival}`, 80, 100, 150, () => {
      mode = mode === 'survival' ? 'hardcore' : mode === 'hardcore' ? 'creative' : 'survival';
      const modeLabel = mode === 'survival' ? labels.survival : mode === 'creative' ? labels.creative : labels.hardcore;
      gameMode.setButtonLabel(`${labels.gameMode} ${modeLabel}`);
      updateModeDescription();
    });
    gameMode.style.position = 'absolute';
    const description1 = label(labels.survival1, 55, 122);
    const description2 = label(labels.survival2, 55, 134);
    const seedLabel = label(labels.enterSeed, 55, 47);
    const seedInfo = label(labels.seedInfo, 55, 85);
    const seed = input('', 60);
    const structuresInfo = label(labels.structuresInfo, 5, 122);
    const structures = button(form, `${labels.structures} ${labels.on}`, 0, 100, 150, () => {
      structuresEnabled = !structuresEnabled;
      structures.setButtonLabel(`${labels.structures} ${structuresEnabled ? labels.on : labels.off}`);
    });
    structures.style.position = 'absolute';
    const worldType = button(form, labels.worldType, 160, 100, 150, () => {} , true);
    worldType.style.position = 'absolute';
    const more = button(form, labels.more, 80, 156, 150, () => {
      advanced = !advanced;
      more.setButtonLabel(advanced ? labels.done : labels.more);
      syncAdvanced();
    });
    more.style.position = 'absolute';
    const cancel = button(form, labels.cancel, 160, guiHeight - 28, 150, mainScreen);
    cancel.style.position = 'absolute';
    const create = button(form, labels.create, 0, guiHeight - 28, 150, async () => {
      try {
        const meta = await storage.createWorld({
          name: name.value,
          seedText: seed.value,
          gameMode: mode,
          generateStructures: structuresEnabled
        });
        const selected = await storage.loadWorld(meta.id);
        finish(selected);
      } catch (error) { dialog('Error', error.message, labels.done, () => {}); }
    });
    create.style.position = 'absolute';

    const updateModeDescription = () => {
      const lines = mode === 'creative' ? [labels.creative1, labels.creative2] : mode === 'hardcore' ? [labels.hardcore1, labels.hardcore2] : [labels.survival1, labels.survival2];
      setMinecraftText(description1, lines[0], font);
      setMinecraftText(description2, lines[1], font);
      gameMode.setButtonLabel(`${labels.gameMode} ${mode === 'creative' ? labels.creative : mode === 'hardcore' ? labels.hardcore : labels.survival}`);
    };
    const syncAdvanced = () => {
      worldNameLabel.hidden = advanced;
      name.parentElement.hidden = advanced;
      folder.hidden = advanced;
      gameMode.hidden = advanced;
      description1.hidden = advanced;
      description2.hidden = advanced;
      seedLabel.hidden = !advanced;
      seedInfo.hidden = !advanced;
      seed.parentElement.hidden = !advanced;
      structuresInfo.hidden = !advanced;
      structures.hidden = !advanced;
      worldType.hidden = !advanced;
    };
    const updateFolder = async () => {
      const worlds = await storage.listWorlds();
      const existing = new Set(worlds.map(world => world.id));
      const folderName = makeWorldId(name.value, existing);
      setMinecraftText(folder, `${labels.resultFolder} ${folderName}`, font);
      create.disabled = name.value.length === 0;
      create.refreshButtonSprite();
    };
    name.addEventListener('input', updateFolder);
    updateFolder();
    syncAdvanced();
  };
  return createScreen;
}
