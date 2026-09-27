// Preview da UI p/ screenshot (stub da api). Uso: electron tools/ui-preview.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 800, webPreferences: { offscreen: true, preload: path.join(__dirname, 'ui-stub.js') } });
  await win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  await new Promise(r => setTimeout(r, 1500));
  let img = await win.webContents.capturePage();
  require('fs').writeFileSync(path.join(__dirname, 'ui-play.png'), img.toPNG());
  console.log('play ok');
  await win.webContents.executeJavaScript(`document.querySelector('[data-page="mods"]').click()`);
  await new Promise(r => setTimeout(r, 800));
  img = await win.webContents.capturePage();
  require('fs').writeFileSync(path.join(__dirname, 'ui-mods.png'), img.toPNG());
  console.log('mods ok');
  app.exit(0);
});
