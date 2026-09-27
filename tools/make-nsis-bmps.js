// Gera bitmaps do instalador (header 150x57 + wizard 164x314) no tema Obsidian.
// Uso: node tools/make-nsis-bmps.js
const fs = require('fs'), path = require('path');
const out = path.join(__dirname, 'nsis-assets');
fs.mkdirSync(out, { recursive: true });

function bmp(w, h, paint) {
  const stride = ((w * 3 + 3) >> 2) << 2;
  const px = Buffer.alloc(stride * h, 0);
  const set = (x, y, r, g, b) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const o = (h - 1 - y) * stride + x * 3;
    px[o] = b; px[o + 1] = g; px[o + 2] = r;
  };
  paint(set, w, h);
  const head = Buffer.alloc(54);
  head.write('BM', 0); head.writeUInt32LE(54 + px.length, 2);
  head.writeUInt32LE(54, 10); head.writeUInt32LE(40, 14);
  head.writeInt32LE(w, 18); head.writeInt32LE(h, 22);
  head.writeUInt16LE(1, 26); head.writeUInt16LE(24, 28);
  return Buffer.concat([head, px]);
}

function theme(set, w, h, dx, dy, s) {
  // fundo escuro + gradiente roxo
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = (x + y) / (w + h);
    set(x, y, Math.round(11 + t * 40), Math.round(14 + t * 22), Math.round(20 + t * 90));
  }
  // faixa roxa inferior
  for (let y = 0; y < Math.max(3, h * 0.06); y++) for (let x = 0; x < w; x++) {
    const t = x / w;
    set(x, y, Math.round(90 + t * 60), Math.round(30 + t * 20), Math.round(200 + t * 37));
  }
  // diamante obsidian
  const cx = dx, cy = dy;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.abs(x - cx) / s + Math.abs(y - cy) / (s * 1.25);
    if (d < 1) { const k = 1 - d; set(x, y, Math.round(40 + 120 * k), Math.round(20 + 50 * k), Math.round(80 + 165 * k)); }
  }
}

fs.writeFileSync(path.join(out, 'header.bmp'), bmp(150, 57, (set, w, h) => theme(set, w, h, 28, 30, 20)));
fs.writeFileSync(path.join(out, 'wizard.bmp'), bmp(164, 314, (set, w, h) => theme(set, w, h, 82, 150, 60)));
console.log('nsis-bmps ok', fs.statSync(path.join(out, 'header.bmp')).length, fs.statSync(path.join(out, 'wizard.bmp')).length);
