const { app, BrowserWindow, session, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

app.commandLine.appendSwitch('ozone-platform', 'wayland');
app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform');
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('disable-gpu-vsync');
app.commandLine.appendSwitch('enable-precise-memory-info');

let gameWindow;

const DEFAULT_JAR = path.join(app.getPath('home'), '.sklauncher', 'versions', '1.0', '1.0.jar');
const EXTRACT_SCRIPT = path.join(__dirname, 'tools', 'extract-mc10-assets.py');
const REQUIRED_ASSETS = [
  'public/assets/terrain.png',
  'public/assets/mc10/particles.png',
  'public/assets/mc10/font/default.png',
  'public/assets/mc10/gui/gui.png',
  'public/assets/mc10/gui/icons.png',
  'public/assets/mc10/gui/inventory.png',
  'public/assets/mc10/gui/items.png',
  'public/assets/grasscolor.png',
  'public/assets/foliagecolor.png'
];

async function ensureMinecraftAssets() {
  const missingAssets = REQUIRED_ASSETS.filter(file => !fs.existsSync(path.join(__dirname, file)));
  if (missingAssets.length === 0) return true;

  let jarPath = DEFAULT_JAR;

  if (!fs.existsSync(jarPath)) {
    const selection = await dialog.showOpenDialog({
      title: 'Localizar Minecraft 1.0.jar',
      message: 'O JAR do SKLauncher não foi encontrado. Selecione o arquivo original Minecraft 1.0.jar.',
      properties: ['openFile'],
      filters: [{ name: 'Minecraft 1.0 JAR', extensions: ['jar'] }]
    });

    if (selection.canceled || selection.filePaths.length === 0) {
      await dialog.showMessageBox({
        type: 'warning',
        title: 'Minecraft 1.0.jar necessário',
        message: 'Não foi selecionado nenhum arquivo Minecraft 1.0.jar. O jogo não será iniciado.'
      });
      return false;
    }

    jarPath = selection.filePaths[0];
  }

  const extraction = spawnSync('python3', [EXTRACT_SCRIPT, jarPath], {
    cwd: __dirname,
    encoding: 'utf8'
  });

  if (extraction.error || extraction.status !== 0) {
    const details = extraction.error?.message || extraction.stderr || extraction.stdout || 'Erro desconhecido.';
    await dialog.showMessageBox({
      type: 'error',
      title: 'Falha ao carregar Minecraft 1.0.jar',
      message: 'Não foi possível extrair os assets do arquivo selecionado.',
      detail: details
    });
    return false;
  }

  return true;
}

function createWindow() {
  gameWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    title: 'Minecraft 1.0',
    backgroundColor: '#171717',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  gameWindow.loadFile(path.join(__dirname, 'index.html'));

  gameWindow.webContents.on('before-input-event', (event, input) => {
    const key = input.key.toLowerCase();
    if ((input.control || input.meta) && key === 'w') event.preventDefault();
  });

  gameWindow.on('closed', () => {
    gameWindow = null;
  });
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'pointerLock');
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => permission === 'pointerLock');

  if (!await ensureMinecraftAssets()) {
    app.quit();
    return;
  }

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
