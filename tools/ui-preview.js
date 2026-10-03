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
  stopGame: async () => ({ killed: 0 }),
  onGameStarted: () => {}, onGameClosed: () => {},
  bedrockStatus: async () => ({ installed: false }),
  bedrockLaunch: async () => true,
  searchModrinth: async () => ({ hits: [] }),
  modDownload: async () => ({ file: 'x.jar', version: '1.0', skipped: false }),
  contentDownload: async () => ({ file: 'x.zip', version: '1.0', skipped: false }),
  modsList: async () => [{ name: 'obsidian-overlay-forge.jar', size: 28336 }],
  contentList: async () => [],
  modDelete: async () => true,
  contentDelete: async () => true,
  openModsFolder: async () => true,
  openContentFolder: async () => true,
  openGameDir: async () => true,
  lastCrash: async () => ({ file: null, head: '' }),
  friendSync: async () => true,
  friendsList: async () => [],
  friendAdd: async () => true,
  friendDelete: async () => true,
  friendPing: async () => ({ online: false }),
  inviteCreate: async () => ({ code: 'OBS1-X', mc: '26.3' }),
  inviteAccept: async () => ({ nick: 'X', address: 'y' }),
  serversList: async () => [],
  serverAdd: async (d) => ({ id: 'x', name: d.name }),
  serverDelete: async () => true,
  serverStart: async () => ({ started: true }),
  serverStop: async () => ({}),
  serverCmd: async () => true,
  serverLogGet: async () => '',
  onServerLog: () => {}, onServerState: () => {},
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
  win.webContents.on('console-message', (_, __, msg) => { if (/error|erro|fail/i.test(msg)) console.log('CONSOLE:', msg.slice(0, 200)); });
  await win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  await new Promise(r => setTimeout(r, 2500));
  const dom = await win.webContents.executeJavaScript(`(() => ({
    hero: !!(document.querySelector('.hero h1')),
    versionOpts: document.getElementById('version') ? document.getElementById('version').options.length : -1,
    loader: !!document.getElementById('loader'),
    btnPlay: !!document.getElementById('btnPlay'),
    modsCtx: !!document.getElementById('modsCtx'),
    skinVariant: !!document.getElementById('skinVariant'),
    roomBox: !!document.getElementById('roomBox'),
    friends: !!document.getElementById('friends'),
    user: (document.getElementById('user') || {}).textContent
  }))()`);
  console.log('DOM-STARTUP:', JSON.stringify(dom));
  let img = await win.webContents.capturePage();
  require('fs').writeFileSync(path.join(__dirname, 'ui-play.png'), img.toPNG());
  console.log('play ok');
  await win.webContents.executeJavaScript(`document.querySelector('[data-page="mods"]').click()`);
  await new Promise(r => setTimeout(r, 2500));
  const mdbg = await win.webContents.executeJavaScript(`(async () => {
    const out = {};
    try { out.modsList = JSON.stringify(await window.ObsidianApp.API.modsList()).slice(0, 80); }
    catch (e) { out.modsListErr = String(e && e.message).slice(0, 120); }
    const c = document.getElementById('modsInstalled');
    out.html = c ? c.innerHTML.slice(0, 300) : 'SEM-EL';
    return out;
  })()`);
  console.log('MODS-DOM:', JSON.stringify(mdbg));
  img = await win.webContents.capturePage();
  require('fs').writeFileSync(path.join(__dirname, 'ui-mods.png'), img.toPNG());
  console.log('mods ok');
  await win.webContents.executeJavaScript(`document.querySelector('[data-page="skins"]').click()`);
  await new Promise(r => setTimeout(r, 2500));
  img = await win.webContents.capturePage();
  require('fs').writeFileSync(path.join(__dirname, 'ui-skins.png'), img.toPNG());
  console.log('skins ok');
  await win.webContents.executeJavaScript(`document.querySelector('[data-page="friends"]').click()`);
  await new Promise(r => setTimeout(r, 4000));
  const dbg = await win.webContents.executeJavaScript(`(async () => {
    const out = {};
    out.hasMod = !!(window.ObsidianApp && window.ObsidianApp.state.pageModules.get('friends'));
    out.friendsHTML = (document.getElementById('friends') || { innerHTML: 'SEM-EL' }).innerHTML.slice(0, 120);
    out.relayBox = !!document.getElementById('roomBox');
    try { const m = await import('./js/pages/friends.js'); out.importOk = true; }
    catch (e) { out.importErr = String(e && e.message).slice(0, 200); }
    return out;
  })()`);
  console.log('FDBG', JSON.stringify(dbg));
  img = await win.webContents.capturePage();
  require('fs').writeFileSync(path.join(__dirname, 'ui-friends.png'), img.toPNG());
  console.log('friends ok');
  await win.webContents.executeJavaScript(`document.querySelector('[data-page="servers"]').click()`);
  await new Promise(r => setTimeout(r, 2500));
  img = await win.webContents.capturePage();
  require('fs').writeFileSync(path.join(__dirname, 'ui-servers.png'), img.toPNG());
  console.log('servers ok');
  await win.webContents.executeJavaScript(`document.querySelector('[data-page="bedrock"]').click()`);
  await new Promise(r => setTimeout(r, 2500));
  img = await win.webContents.capturePage();
  require('fs').writeFileSync(path.join(__dirname, 'ui-bedrock.png'), img.toPNG());
  console.log('bedrock ok');
  app.exit(0);
});
