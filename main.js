const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { autoUpdater } = require('electron-updater');

let mainWindow;

// --- CONFIGURACIÓN DE AUTO-UPDATES ---
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    titleBarStyle: 'hidden', 
    backgroundColor: '#09090b',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Permite que React use ipcRenderer directamente
      webSecurity: false,      // Permite cargar música y recursos locales sin CORS
    },
  });

  // Definimos la ruta al archivo index.html de producción
  const distPath = path.join(__dirname, 'dist', 'index.html');

  // --- LÓGICA DE CARGA INTELIGENTE (HÍBRIDA) ---
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      console.log("Servidor Vite no detectado. Cargando desde dist/...");
      mainWindow.loadFile(distPath);
    });
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(distPath).catch((err) => {
      console.error("ERROR CRÍTICO AL CARGAR EL ARCHIVO:", distPath);
      console.error(err);
    });
  }

  // Debug para detectar fallos de rutas
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (!validatedURL.includes('localhost')) {
      console.log(`Fallo al cargar: ${validatedURL} - ${errorDescription} (${errorCode})`);
    }
  });

  mainWindow.on('closed', () => (mainWindow = null));

  // --- ATAJOS DE TECLADO (Media Keys) ---
  globalShortcut.register('MediaPlayPause', () => {
    if (mainWindow) mainWindow.webContents.send('player-control', 'togglePause');
  });
  globalShortcut.register('MediaNextTrack', () => {
    if (mainWindow) mainWindow.webContents.send('player-control', 'next');
  });
  globalShortcut.register('MediaPreviousTrack', () => {
    if (mainWindow) mainWindow.webContents.send('player-control', 'prev');
  });
}

// --- GESTIÓN DE LOGS ---
ipcMain.on('terminal-log', (event, message) => {
  console.log(`[KLANG LOG]: ${message}`);
});

// --- EVENTOS DE ACTUALIZACIÓN ---
autoUpdater.on('update-available', () => {
  console.log('Actualización disponible encontrada.');
});

autoUpdater.on('update-downloaded', (info) => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Actualización lista',
    message: `La versión ${info.version} ha sido descargada. ¿Quieres reiniciar ahora para actualizar?`,
    buttons: ['Reiniciar', 'Más tarde']
  }).then((result) => {
    if (result.response === 0) autoUpdater.quitAndInstall();
  });
});

app.whenReady().then(() => {
  createWindow();

  // Buscar actualizaciones solo si no estamos en modo desarrollo
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});