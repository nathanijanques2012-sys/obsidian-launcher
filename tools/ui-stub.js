const { contextBridge } = require('electron');
const fs = require('fs'), path = require('path');
const skinB64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '..', 'assets', 'skins', f)).toString('base64');
contextBridge.exposeInMainWorld('api', {
  getSettings: async () => ({ ramMin: '2G', ramMax: '4G', javaPath: '', gameDir: 'C:\\jogo', resolution: { width: 854, height: 480 }, version: '1.21.1', loader: 'fabric', overlay: true, displayMode: 'borderless', autoUpdate: true }),
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
    { name: 'obsidian', file: 'obsidian.png', preset: true, url: skinB64('obsidian.png') },
    { name: 'creeper', file: 'creeper.png', preset: true, url: skinB64('creeper.png') },
    { name: 'enderman', file: 'enderman.png', preset: true, url: skinB64('enderman.png') },
    { name: 'minha-skin', file: 'minha.png', preset: false, url: skinB64('ninja.png') }
  ], selected: 'obsidian.png' }),
  skinImport: async () => null,
  skinDelete: async () => true,
  skinApply: async () => ({ msg: 'Skin aplicada ✓' }),
  checkUpdate: async () => true,
  installUpdate: async () => true,
  onLog: () => {}, onProgress: () => {}, onUpdateStatus: () => {}, onUpdateReady: () => {}
});
