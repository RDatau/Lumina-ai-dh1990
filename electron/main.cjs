const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, // Frameless window to allow seamless titlebar matching top background
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0f14',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    icon: path.join(__dirname, '../public/logo.png'),
    autoHideMenuBar: true,
  });

  if (process.platform !== 'darwin') {
    win.setMenuBarVisibility(false);
    Menu.setApplicationMenu(null);
  }

  // Handle Window Control IPC events from React UI
  ipcMain.on('window-minimize', () => {
    if (win && !win.isDestroyed()) win.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (win && !win.isDestroyed()) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    if (win && !win.isDestroyed()) win.close();
  });

  ipcMain.handle('window-is-maximized', () => {
    return win && !win.isDestroyed() ? win.isMaximized() : false;
  });

  if (!app.isPackaged) {
    // Mode Pengembangan
    win.loadURL('http://localhost:3000');
  } else {
    // Mode Produksi
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
