const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// CRITICAL FIX FOR OLDER / LOW-END LAPTOPS
app.disableHardwareAcceleration();

// ─── CRASH LOG ───
// Write ALL errors to a file on Desktop so the user can share them
const desktopPath = path.join(require('os').homedir(), 'Desktop');
const crashLogPath = path.join(desktopPath, 'POS-Machine-CrashLog.txt');

function writeLog(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  try {
    fs.appendFileSync(crashLogPath, line);
  } catch(e) {
    // Can't write to desktop, try userData
    try {
      const fallback = path.join(app.getPath('userData'), 'crash.log');
      fs.appendFileSync(fallback, line);
    } catch(e2) {}
  }
}

// Catch ALL uncaught errors
process.on('uncaughtException', (err) => {
  writeLog(`UNCAUGHT EXCEPTION: ${err.message}\nStack: ${err.stack}`);
  dialog.showErrorBox('POS Machine Error', `An error occurred:\n\n${err.message}\n\nFull log saved to Desktop: POS-Machine-CrashLog.txt`);
});

process.on('unhandledRejection', (reason) => {
  writeLog(`UNHANDLED REJECTION: ${reason}`);
});

writeLog('=== POS Machine Starting ===');
writeLog(`Electron version: ${process.versions.electron}`);
writeLog(`Node version: ${process.versions.node}`);
writeLog(`ABI: ${process.versions.modules}`);
writeLog(`Platform: ${process.platform} ${process.arch}`);
writeLog(`App packaged: ${app.isPackaged}`);

let mainWindow;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  writeLog('Another instance is already running. Quitting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    try {
      createWindow();
    } catch (err) {
      writeLog(`FATAL ERROR in createWindow: ${err.message}\nStack: ${err.stack}`);
      dialog.showErrorBox('POS Machine Fatal Error', `Failed to start:\n\n${err.message}\n\nLog: ${crashLogPath}`);
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    writeLog('All windows closed. Quitting.');
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

function createWindow() {
  writeLog('Creating main window...');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
    },
    title: 'POS Machine System',
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    writeLog('Window ready to show');
    mainWindow.show();
  });

  const userDataDir = app.getPath('userData');
  writeLog(`userData dir: ${userDataDir}`);

  try {
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
  } catch (e) {
    writeLog(`Failed to create userData dir: ${e.message}`);
  }

  const dbPath = `file:${path.join(userDataDir, 'pos-machine-database.db')}`;
  writeLog(`DB path: ${dbPath}`);

  // ─── Start the Express server IN-PROCESS ───
  if (app.isPackaged) {
    let serverPath = path.join(process.resourcesPath, 'app', 'server.cjs');
    if (!fs.existsSync(serverPath)) {
      serverPath = path.join(__dirname, '..', 'server.cjs');
    }
    writeLog(`Server path: ${serverPath}`);
    writeLog(`Server file exists: ${fs.existsSync(serverPath)}`);

    const appDir = path.dirname(serverPath);
    const nodeMods = path.join(appDir, 'node_modules');
    writeLog(`node_modules path: ${nodeMods}`);
    writeLog(`node_modules exists: ${fs.existsSync(nodeMods)}`);

    // Check if better-sqlite3 exists
    const bsq3Path = path.join(nodeMods, 'better-sqlite3');
    writeLog(`better-sqlite3 exists: ${fs.existsSync(bsq3Path)}`);
    if (fs.existsSync(bsq3Path)) {
      // Check for the native binding
      const bindingDir = path.join(bsq3Path, 'build', 'Release');
      writeLog(`better-sqlite3 build/Release exists: ${fs.existsSync(bindingDir)}`);
      if (fs.existsSync(bindingDir)) {
        const files = fs.readdirSync(bindingDir);
        writeLog(`build/Release contents: ${JSON.stringify(files)}`);
      }
      // Also check prebuilds
      const prebuildsDir = path.join(bsq3Path, 'prebuilds');
      writeLog(`better-sqlite3 prebuilds exists: ${fs.existsSync(prebuildsDir)}`);
      if (fs.existsSync(prebuildsDir)) {
        const dirs = fs.readdirSync(prebuildsDir);
        writeLog(`prebuilds contents: ${JSON.stringify(dirs)}`);
        dirs.forEach(d => {
          const subdir = path.join(prebuildsDir, d);
          if (fs.statSync(subdir).isDirectory()) {
            writeLog(`  ${d}/: ${JSON.stringify(fs.readdirSync(subdir))}`);
          }
        });
      }
    }

    // Set environment
    process.env.NODE_ENV = 'production';
    process.env.PORT = '3001';
    process.env.DB_PATH = dbPath;
    process.env.NODE_PATH = nodeMods;

    // Update module paths
    try {
      require('module').Module._initPaths();
      writeLog('Module paths updated');
    } catch (e) {
      writeLog(`Module._initPaths failed: ${e.message}`);
    }

    // Change working directory
    try {
      process.chdir(appDir);
      writeLog(`cwd set to: ${process.cwd()}`);
    } catch(e) {
      writeLog(`chdir failed: ${e.message}`);
    }

    // Load the server
    writeLog('Loading server.cjs...');
    try {
      require(serverPath);
      writeLog('Server loaded successfully!');
    } catch (err) {
      writeLog(`SERVER LOAD FAILED: ${err.message}\nStack: ${err.stack}`);
      dialog.showErrorBox(
        'POS Machine - Server Failed',
        `The server could not start.\n\nError: ${err.message}\n\nPlease share the file:\n${crashLogPath}`
      );
      app.quit();
      return;
    }
  }

  const loadURL = () => {
    const targetUrl = app.isPackaged ? 'http://localhost:3001' : 'http://localhost:3000';
    writeLog(`Loading URL: ${targetUrl}`);
    mainWindow.loadURL(targetUrl).catch(() => {
      setTimeout(loadURL, 500);
    });
  };
  
  setTimeout(loadURL, app.isPackaged ? 2000 : 1000);
}
