// Gera assets/skins/*.png desenhando em canvas (encoder PNG garantido).
// Uso: electron tools/make-skins2.js
const { app, BrowserWindow } = require('electron');
const path = require('path'), fs = require('fs');
const skins = {
  'obsidian': { skin: '#e8b98a', hair: '#2a1650', shirt: '#6d28d9', pants: '#1e1b29', boots: '#0d0716', eye: '#a855f7', emblem: '#e9d5ff' },
  'creeper': { skin: '#4caf50', hair: '#2e7d32', shirt: '#43a047', pants: '#33691e', boots: '#1b4312', eye: '#0a0a0a' },
  'enderman': { skin: '#161616', hair: '#000000', shirt: '#1a1a1a', pants: '#0d0d0d', boots: '#000000', eye: '#e040fb' },
  'astronauta': { skin: '#e8b98a', hair: '#dddddd', shirt: '#f5f5f5', pants: '#e0e0e0', boots: '#9e9e9e', eye: '#1565c0' },
  'ninja': { skin: '#222222', hair: '#111111', shirt: '#b71c1c', pants: '#1a1a1a', boots: '#000000', eye: '#ffffff' },
  'ouro': { skin: '#ffcc80', hair: '#ffb300', shirt: '#ffd54f', pants: '#ff8f00', boots: '#5d4037', eye: '#3e2723', emblem: '#fffde7' }
};
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL('about:blank');
  const out = await win.webContents.executeJavaScript(`(() => {
    const skins = ${JSON.stringify(skins)};
    const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); return 'rgb(' + (((n >> 16) & 255) * f | 0) + ',' + (((n >> 8) & 255) * f | 0) + ',' + ((n & 255) * f | 0) + ')'; };
    const res = {};
    for (const [name, p] of Object.entries(skins)) {
      const c = document.createElement('canvas'); c.width = 64; c.height = 64;
      const g = c.getContext('2d');
      const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
      R(0, 0, 32, 16, p.hair);
      R(8, 8, 8, 8, p.skin);
      R(10, 11, 2, 2, '#ffffff'); R(13, 11, 2, 2, '#ffffff');
      R(10, 12, 1, 1, p.eye); R(14, 12, 1, 1, p.eye);
      R(11, 15, 2, 1, shade(p.skin, 0.7));
      R(8, 8, 8, 1, p.hair);
      R(20, 20, 8, 12, p.shirt);
      R(20, 20, 8, 1, shade(p.shirt, 0.8));
      if (p.emblem) R(23, 24, 2, 2, p.emblem);
      for (const [ax, ay] of [[44, 20], [36, 52]]) { R(ax, ay, 4, 8, p.sleeve || p.shirt); R(ax, ay + 8, 4, 4, p.skin); }
      for (const [lx, ly] of [[4, 20], [20, 52]]) { R(lx, ly, 4, 9, p.pants); R(lx, ly + 9, 4, 3, p.boots); }
      R(32, 20, 8, 12, shade(p.shirt, 0.85));
      res[name] = c.toDataURL('image/png');
    }
    return res;
  })()`);
  const dir = path.join(__dirname, '..', 'assets', 'skins');
  for (const [name, url] of Object.entries(out)) {
    fs.writeFileSync(path.join(dir, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log('skin:', name);
  }
  app.exit(0);
});
