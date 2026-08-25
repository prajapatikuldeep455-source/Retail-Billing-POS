const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// CRITICAL FIX FOR OLDER / LOW-END LAPTOPS
// Disables hardware acceleration which causes black screens or crashes on weak GPUs
app.disableHardwareAcceleration();

let mainWindow;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
    },
    title: 'POS Machine System',
    autoHideMenuBar: true,
    show: false,  // Don't show until server is ready
  });

  mainWindow.setMenuBarVisibility(false);

  // Show window when ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const userDataDir = app.getPath('userData');
  try {
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
  } catch (e) {
    console.error('Failed to create userData directory:', e);
  }

  const dbPath = `file:${path.join(userDataDir, 'pos-machine-database.db')}`;

  // ─── Start the Express server IN-PROCESS ───
  // This avoids the ABI mismatch problem entirely because the server
  // runs inside Electron's own Node.js runtime, using the same native
  // bindings that electron-rebuild compiled for this exact ABI version.
  
  let serverPath;
  if (app.isPackaged) {
    serverPath = path.join(process.resourcesPath, 'app', 'server.cjs');
    if (!fs.existsSync(serverPath)) {
      serverPath = path.join(__dirname, '..', 'server.cjs');
    }
  } else {
    // In development, we don't load the server here — it's run separately via tsx
    serverPath = null;
  }

  // Set environment variables BEFORE requiring server
  process.env.NODE_ENV = 'production';
  process.env.PORT = '3001';
  process.env.DB_PATH = dbPath;

  if (app.isPackaged && serverPath) {
    const appDir = path.join(process.resourcesPath, 'app');
    const nodeMods = path.join(appDir, 'node_modules');
    process.env.NODE_PATH = nodeMods;

    // Update module resolution paths so require() can find node_modules
    require('module').Module._initPaths();

    // Change working directory so server can find 'dist/' folder
    try { process.chdir(appDir); } catch(e) {}

    try {
      // Load the server directly — it will start listening on PORT 3001
      require(serverPath);
      console.log('Server loaded in-process successfully');
    } catch (err) {
      console.error('Failed to load server:', err);
      dialog.showErrorBox(
        'Server Failed to Start',
        `The backend server could not start.\n\nError:\n${err.message}\n\nStack:\n${err.stack}`
      );
      app.quit();
      return;
    }
  }

  const loadURL = () => {
    const targetUrl = app.isPackaged ? 'http://localhost:3001' : 'http://localhost:3000';
    mainWindow.loadURL(targetUrl).catch(() => {
      setTimeout(loadURL, 500);
    });
  };
  
  // Give the in-process server a moment to bind the port
  setTimeout(loadURL, app.isPackaged ? 1500 : 1000);
}
