// Test launcher startup
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.on('ready', () => {
  console.log('App ready');
  const win = new BrowserWindow({
    width: 1100, height: 720,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  
  const rendererPath = app.isPackaged
    ? path.join(process.resourcesPath, 'renderer', 'index.html')
    : path.join(__dirname, 'renderer', 'index.html');
    
  console.log('Loading:', rendererPath);
  win.loadFile(rendererPath).then(() => {
    console.log('Loaded successfully');
  }).catch(err => {
    console.error('Load error:', err);
  });
  
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });
  
  win.webContents.on('console-message', (event, level, message) => {
    console.log('[Renderer]', message);
  });
});

app.on('window-all-closed', () => {
  console.log('All windows closed');
  app.quit();
});