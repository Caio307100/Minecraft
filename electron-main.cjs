const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');

// XWayland oferece o Pointer Lock usado pela câmera do jogo.
app.commandLine.appendSwitch('ozone-platform', 'wayland');
app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform');
// Permite testar FPS acima da frequência do monitor.
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('disable-gpu-vsync');
// Sem isso o performance.memory é arredondado/atualizado raramente e o F3 mostra memória "parada".
app.commandLine.appendSwitch('enable-precise-memory-info');

let gameWindow;

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
    if ((input.control || input.meta) && key === 'w') {
      event.preventDefault();
    }
  });

  gameWindow.on('closed', () => {
    gameWindow = null;
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'pointerLock');
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => permission === 'pointerLock');
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
