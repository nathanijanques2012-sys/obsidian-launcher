// Gera icon-192.png e icon-512.png do companion (NÃO mexer em tools/make-icon.js,
// que gera os ícones do launcher desktop). Uso: node tools/make-companion-icons.js
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const outDir = path.join(__dirname, '..', 'companion');
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.from(type);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([td, data])), 0);
  return Buffer.concat([len, td, data, crc]);
}
function png(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function draw(size) {
  const buf = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  };
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const t = (x + y) / (2 * size);
    set(x, y, lerp(26, 124, t), lerp(16, 58, t), lerp(51, 237, t));
  }
  const cx = size / 2, cy = size / 2, R = size * 0.34;
  const inside = (x, y) => Math.abs(x - cx) / R + Math.abs(y - cy) / R < 1;
  const glow = (x, y) => Math.abs(x - cx) / (R * 1.35) + Math.abs(y - cy) / (R * 1.35) < 1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (inside(x, y)) set(x, y, 124, 58, 237);
    else if (glow(x, y)) { const i = (y * size + x) * 4; buf[i] = lerp(buf[i], 124, .5); buf[i + 1] = lerp(buf[i + 1], 58, .5); buf[i + 2] = lerp(buf[i + 2], 237, .5); }
  }
  const R2 = size * 0.15;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (Math.abs(x - cx) / R2 + Math.abs(y - cy) / R2 < 1) set(x, y, 26, 16, 51);
  }
  return png(size, size, buf);
}
for (const s of [192, 512]) {
  fs.writeFileSync(path.join(outDir, `icon-${s}.png`), draw(s));
  console.log(`icon-${s}.png ok`);
}
// Mipmaps do app Android
const dens = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, s] of Object.entries(dens)) {
  const dir = path.join(__dirname, '..', 'companion-android', 'app', 'src', 'main', 'res', `mipmap-${d}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), draw(s));
  console.log(`mipmap-${d} ok`);
}
