const { app, BrowserWindow } = require('electron');
const path = require('path');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 390, height: 844, webPreferences: { offscreen: true } });
  win.webContents.on('console-message', (_, __, m) => { if (/error|uncaught|failed/i.test(m)) console.log('CONSOLE:', m.slice(0, 160)); });
  await win.loadURL('http://127.0.0.1:8901/index.html');
  await new Promise(r => setTimeout(r, 2500));
  const state = await win.webContents.executeJavaScript("({ tabs: document.querySelectorAll('.tabs button').length, ws: typeof WebSocket })");
  console.log('STATE:', JSON.stringify(state));
  const img = await win.webContents.capturePage();
  require('fs').writeFileSync(path.join(__dirname, 'shot.png'), img.toPNG());
  console.log('shot ok');
  app.exit(0);
});
