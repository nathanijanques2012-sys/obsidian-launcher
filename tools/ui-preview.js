// Preview da UI p/ screenshot (stub da api). Uso: electron tools/ui-preview.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
// Gera preload de teste com as skins embutidas (preload sandboxed não lê fs)
{
  const dir = path.join(__dirname, '..', 'assets', 'skins');
  const pick = ['obsidian.png', 'creeper.png', 'enderman.png', 'ninja.png'];
  const skins = pick.map(f => `    { name: '${f.replace('.png', '')}', file: '${f}', preset: true, url: 'data:image/png;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}' }`).join(',\n');
  const stub = `const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('api', {
  getSettings: async () => ({ ramMin: '2G', ramMax: '4G', javaPath: '', gameDir: 'C:\\\\jogo', resolution: { width: 854, height: 480 }, version: '1.21.1', loader: 'fabric', overlay: true, displayMode: 'borderless', autoUpdate: true }),
  saveSettings: async () => true,
  getVersions: async () => ['1.21.1', '1.21', '1.20.4'],
  login: async () => ({ name: 'Steve', type: 'microsoft' }),
  offlineLogin: async (u) => ({ name: u, type: 'offline' }),
  getAccount: async () => ({ name: 'Steve', type: 'offline' }),
  logout: async () => true,
  launch: async () => true,
  searchModrinth: async () => ({ hits: [] }),
  modDownload: async () => ({ file: 'x.jar', version: '1.0', skipped: false }),
  contentDownload: async () => ({ file: 'x.zip', version: '1.0', skipped: false }),
  modsList: async () => [],
  contentList: async () => [],
  modDelete: async () => true,
  contentDelete: async () => true,
  openModsFolder: async () => true,
  openContentFolder: async () => true,
  openGameDir: async () => true,
  lastCrash: async () => ({ file: null, head: '' }),
  skinList: async () => ({ skins: [
${skins},
    { name: 'minha-skin', file: 'minha.png', preset: false, url: 'data:image/png;base64,${fs.readFileSync(path.join(dir, 'ninja.png')).toString('base64')}' }
  ], selected: 'obsidian.png' }),
  skinImport: async () => null,
  skinDelete: async () => true,
  skinApply: async () => ({ msg: 'Skin aplicada ✓' }),
  checkUpdate: async () => true,
  installUpdate: async () => true,
  onLog: () => {}, onProgress: () => {}, onUpdateStatus: () => {}, onUpdateReady: () => {}
});
`;
  fs.writeFileSync(path.join(__dirname, 'ui-stub-gen.js'), stub);
}
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 800, webPreferences: { offscreen: true, preload: path.join(__dirname, 'ui-stub-gen.js') } });
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
  await win.webContents.executeJavaScript(`document.querySelector('[data-page="skins"]').click()`);
  await new Promise(r => setTimeout(r, 2500));
  img = await win.webContents.capturePage();
  require('fs').writeFileSync(path.join(__dirname, 'ui-skins.png'), img.toPNG());
  console.log('skins ok');
  app.exit(0);
  const dbg = await win.webContents.executeJavaScript(`(() => {
    const el = document.getElementById('skins');
    return { kids: el ? el.children.length : -1 };
  })()`);
  console.log('skins-cards:', dbg.kids);
  img = await win.webContents.capturePage();
  require('fs').writeFileSync(path.join(__dirname, 'ui-skins.png'), img.toPNG());
  console.log('skins ok');
  app.exit(0);
});
