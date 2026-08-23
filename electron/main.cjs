const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// CRITICAL FIX FOR OLDER / LOW-END LAPTOPS
// Disables hardware acceleration which causes black screens or crashes on weak GPUs
app.disableHardwareAcceleration();

let mainWindow;
let serverProcess;

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
    killServer();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('quit', () => {
    killServer();
  });
}

function killServer() {
  if (serverProcess) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t']);
      } else {
        process.kill(-serverProcess.pid, 'SIGKILL');
      }
    } catch (e) {
      try {
        serverProcess.kill('SIGKILL');
      } catch (err) {}
    }
    serverProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
    },
    title: 'POS Machine System',
    autoHideMenuBar: true
  });

  mainWindow.setMenuBarVisibility(false);

  let serverPath;
  if (app.isPackaged) {
    serverPath = path.join(process.resourcesPath, 'app', 'server.cjs');
    if (!fs.existsSync(serverPath)) {
      serverPath = path.join(__dirname, '..', 'server.cjs');
    }
  } else {
    serverPath = path.join(__dirname, '..', 'server.ts');
  }

  const userDataDir = app.getPath('userData');
  try {
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
  } catch (e) {
    console.error('Failed to create userData directory:', e);
  }

  const dbPath = `file:${path.join(userDataDir, 'pos-machine-database.db')}`;

  if (app.isPackaged) {
    serverProcess = spawn(process.execPath, [serverPath], {
      env: { ...process.env, NODE_ENV: 'production', PORT: '3001', ELECTRON_RUN_AS_NODE: '1', DB_PATH: dbPath },
      stdio: 'pipe',
      detached: process.platform !== 'win32'
    });
  } else {
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    serverProcess = spawn(npx, ['tsx', serverPath], {
      env: { ...process.env, PORT: '3001', DB_PATH: dbPath },
      stdio: 'pipe',
      detached: process.platform !== 'win32'
    });
  }

  let serverErrorOutput = '';
  serverProcess.stderr.on('data', (data) => {
    const str = data.toString();
    console.error(`Backend Error: ${str}`);
    serverErrorOutput += str;
    
    if (str.includes('EADDRINUSE')) {
      dialog.showErrorBox(
        'Port Conflict Detected', 
        `The server failed to start because port 3001 is already in use.\n\nPlease close any other instances of the app or services using this port.\n\nLog Details:\n${str}`
      );
      app.quit();
    }
  });

  serverProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      if (!serverErrorOutput.includes('EADDRINUSE')) {
        dialog.showErrorBox(
          'Server Crashed', 
          `The backend server exited unexpectedly with code ${code}.\n\nLog Details:\n${serverErrorOutput}`
        );
      }
    }
  });

  const loadURL = () => {
    const targetUrl = app.isPackaged ? 'http://localhost:3001' : 'http://localhost:3000';
    mainWindow.loadURL(targetUrl).catch(() => {
      setTimeout(loadURL, 500);
    });
  };
  
  setTimeout(loadURL, 1000);
}
