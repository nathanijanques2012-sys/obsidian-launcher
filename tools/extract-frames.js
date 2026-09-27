// Extrai frames de um video mp4 usando renderizacao offscreen do Electron.
// Uso: electron tools/extract-frames.js --video="C:\..." --out="tools/frames" --n=5
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const arg = (k) => (process.argv.find(a => a.startsWith('--' + k + '=')) || '').slice(k.length + 3);
const videoPath = arg('video');
const outDir = arg('out') || 'tools/frames';
const n = parseInt(arg('n') || '5', 10);
const say = (m) => { try { fs.appendFileSync(path.join(outDir, 'frames.log'), m + '\n'); } catch {} console.log(m); };

setTimeout(() => { say('TIMEOUT-Forcando saida'); process.exit(2); }, 90000).unref();

app.whenReady().then(async () => {
  try {
    fs.mkdirSync(outDir, { recursive: true });
    say('APP-READY');
    const win = new BrowserWindow({ show: false, width: 1280, height: 800, webPreferences: { offscreen: true, webSecurity: false, allowRunningInsecureContent: true } });
    say('WIN-OK');
    const useFile = videoPath.endsWith('.html');
    if (useFile) {
      await win.loadFile(videoPath);
      say('LOADFILE-OK');
    } else {
      const parts = videoPath.replace(/\\/g, '/').split('/');
      const fileUrl = 'file:///' + parts[0] + '/' + parts.slice(1).map(encodeURIComponent).join('/');
      say('URL=' + fileUrl.slice(0, 80));
      await win.loadURL(`data:text/html,<body style="margin:0;background:black"><video id="v" style="width:1280px" src="${fileUrl}" muted preload="auto"></video></body>`);
      say('LOAD-OK');
    }
    const info = await win.webContents.executeJavaScript(`(async () => {
      const v = document.getElementById('v');
      const st = await new Promise((res) => {
        const to = setTimeout(() => res({ timeout: true, rs: v.readyState, err: v.error ? v.error.code : 0 }), 15000);
        const go = () => { clearTimeout(to); res({ timeout: false, dur: v.duration }); };
        if (v.readyState >= 1) go(); else { v.addEventListener('loadedmetadata', go, { once: true }); v.addEventListener('error', () => { clearTimeout(to); res({ timeout: true, err: v.error ? v.error.code : -1 }); }, { once: true }); }
      });
      return st;
    })()`);
    say('META=' + JSON.stringify(info));
    if (!info || info.timeout || !info.dur) throw new Error('video nao carregou');
    for (let i = 0; i < n; i++) {
      const t = Math.min(0.4 + (info.dur * i) / n, Math.max(0, info.dur - 0.15));
      await win.webContents.executeJavaScript(`(async () => {
        const v = document.getElementById('v');
        v.currentTime = ${t};
        await new Promise(r => v.addEventListener('seeked', r, { once: true }));
        return true;
      })()`);
      const img = await win.webContents.capturePage();
      const p = path.join(outDir, `frame${i}.png`);
      fs.writeFileSync(p, img.toPNG());
      say('SAVED ' + p);
    }
    say('DONE');
  } catch (e) { say('FRAME-ERR ' + (e && e.message)); process.exitCode = 1; }
  app.exit(0);
});
