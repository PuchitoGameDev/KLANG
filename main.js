const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { autoUpdater } = require('electron-updater');
const { fork } = require('child_process');

let mainWindow;
let serverProcess;

// --- CARGA DEL SERVIDOR (PROCESO INDEPENDIENTE) ---
function startServer() {
    try {
        process.env.NODE_ENV = isDev ? 'development' : 'production';
        
        // En lugar de require, usamos fork para crear un hilo separado
        // Esto evita que el servidor congele la interfaz de la app
        const serverPath = path.join(__dirname, 'server', 'index.js');
        
        serverProcess = fork(serverPath, [], {
            env: { ...process.env },
            stdio: 'inherit' 
        });

        console.log("⏳ Motor del servidor iniciado en proceso independiente...");

        serverProcess.on('error', (err) => {
            console.error("❌ Error en el proceso del servidor:", err);
        });

        serverProcess.on('exit', (code) => {
            console.log(`Child process exited with code ${code}`);
            // Opcional: Reiniciar si el servidor se cae
            if (code !== 0 && code !== null) {
                setTimeout(startServer, 5000);
            }
        });
    } catch (e) {
        console.error("Error lanzando el servidor:", e);
    }
}

// --- CONFIGURACIÓN DE AUTO-UPDATES REFORZADA ---
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;

function setupAutoUpdater() {
    // Verificación periódica cada hora
    setInterval(() => {
        if (!isDev) autoUpdater.checkForUpdates();
    }, 1000 * 60 * 60);

    autoUpdater.on('checking-for-update', () => {
        console.log('🔍 Klang: Buscando actualizaciones...');
    });

    autoUpdater.on('update-available', (info) => {
        console.log(`✨ Nueva versión encontrada: ${info.version}. Descargando...`);
        if (mainWindow) {
            mainWindow.webContents.send('terminal-log', `Actualización disponible: ${info.version}`);
        }
    });

    autoUpdater.on('download-progress', (progressObj) => {
        console.log(`Descargando: ${progressObj.percent.toFixed(2)}%`);
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('✅ Actualización descargada y lista.');
        dialog.showMessageBox(mainWindow, {
            type: 'question',
            title: 'Klang Cloud - Actualización Lista',
            message: `La versión ${info.version} ha sido descargada. ¿Quieres reiniciar Klang ahora para actualizar?`,
            buttons: ['Reiniciar y Actualizar', 'Más tarde'],
            defaultId: 0,
            cancelId: 1
        }).then((result) => {
            if (result.response === 0) {
                setImmediate(() => autoUpdater.quitAndInstall());
            }
        });
    });

    autoUpdater.on('error', (err) => {
        console.error('❌ Error en el Auto-Updater:', err);
    });
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
      backgroundThrottling: false, // Vital para que no se congele al cambiar de ventana
      contextIsolation: false, // Permite que React use ipcRenderer directamente
      webSecurity: false,      // Permite cargar música y recursos locales sin CORS
      offscreen: false
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

// --- INICIO DE APLICACIÓN ---
app.whenReady().then(() => {
  // Iniciamos el servidor en su propio proceso antes de crear la ventana
  startServer();
  
  // Pequeño retraso para la creación de ventana para asegurar fluidez
  setTimeout(createWindow, 200); 

  // Configurar y ejecutar el updater
  setupAutoUpdater();

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  // Matamos el proceso del servidor al salir
  if (serverProcess) serverProcess.kill();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});