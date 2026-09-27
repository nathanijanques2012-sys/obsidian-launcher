const { app, BrowserWindow } = require('electron');
const path = require('path'), fs = require('fs');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  const dir = path.join(__dirname, '..', 'assets', 'skins').replace(/\\/g, '/');
  const files = fs.readdirSync(path.join(__dirname, '..', 'assets', 'skins')).filter(f => f.endsWith('.png'));
  const res = await win.webContents.executeJavaScript(`(async () => {
    const out = [];
    for (const f of ${JSON.stringify(files)}) {
      const img = new Image();
      try {
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'file:///${dir}/' + encodeURIComponent(f); });
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        c.getContext('2d').drawImage(img, 0, 0);
        const d = c.getContext('2d').getImageData(0, 0, 64, 64).data;
        let opaque = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) opaque++;
        out.push(f + ' OK ' + img.naturalWidth + 'x' + img.naturalHeight + ' px-opacos:' + opaque);
      } catch (e) { out.push(f + ' FALHOU'); }
    }
    return out;
  })()`);
  console.log(res.join('\n'));
  app.exit(0);
});
