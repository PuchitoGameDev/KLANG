const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { fork } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let serverProcess; // Variable para controlar el proceso del servidor

// --- CONFIGURACIÓN DE AUTO-UPDATES ---
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function startServer() {
  // Intentamos buscar el servidor en las dos ubicaciones posibles de Electron
  const pathsToTry = [
    path.join(__dirname, 'server', 'index.js'), // Modo Desarrollo o empaquetado ASAR
    path.join(process.resourcesPath, 'app', 'server', 'index.js'), // Alternativa de empaquetado
    path.join(process.resourcesPath, 'server', 'index.js') // Modo extraResources
  ];

  let serverPath = null;
  const fs = require('fs');

  for (const p of pathsToTry) {
    if (fs.existsSync(p)) {
      serverPath = p;
      break;
    }
  }

  if (!serverPath) {
    console.error('CRÍTICO: No se encontró el archivo del servidor en ninguna ruta.');
    return;
  }

  serverProcess = fork(serverPath, [], {
    env: { 
      NODE_ENV: 'production',
      PORT: 5002
    },
    stdio: 'inherit' // Esto hará que los errores del servidor salgan en tu consola
  });

  serverProcess.on('error', (err) => console.error('Error en proceso servidor:', err));
}

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

  // Ruta al archivo index.html de producción
  const distPath = path.join(__dirname, 'dist', 'index.html');

  // --- LÓGICA DE CARGA INTELIGENTE ---
  if (isDev) {
      mainWindow.loadURL('http://localhost:5173').catch(() => {
          console.warn("Vite no iniciado. Cargando fallback local...");
          mainWindow.loadFile(distPath); 
      });
  } else {
      mainWindow.loadFile(distPath);
  }

  // Debug para detectar fallos de rutas
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.log(`Fallo de red detectado: ${errorDescription} (${errorCode})`);
    
    if (validatedURL.includes('localhost:5173')) {
       mainWindow.loadFile(distPath);
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

// --- CONTROLES DE VENTANA ---
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
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
  startServer(); // Primero el servidor
  createWindow(); // Luego la interfaz

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
  // Matamos el proceso del servidor al cerrar la app
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});