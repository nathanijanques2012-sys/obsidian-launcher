const fs = require('fs'), zlib = require('zlib'), crypto = require('crypto');
const table = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
function crc32(b) { let c = 0xFFFFFFFF; for (const x of b) c = table[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function toPng(w, h, buf) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; buf.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const comp = zlib.deflateSync(raw);
  const parts = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])];
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const td = Buffer.from(type);
    const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([td, data])), 0);
    parts.push(len, td, data, cb);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  chunk('IHDR', ihdr); chunk('IDAT', comp); chunk('IEND', Buffer.alloc(0));
  return Buffer.concat(parts);
}
function drawRaw(S) {
  const buf = Buffer.alloc(S * S * 4);
  const set = (x, y, r, g, b, a = 255) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= S || y >= S) return; const i = (y * S + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a; };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const t = (x + y) / (2 * S);
    set(x, y, Math.round(11 + t * 113), Math.round(14 + t * 44), Math.round(20 + t * 217));
  }
  // diamante obsidian
  const cx = S / 2, cy = S / 2 + S * 0.02;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.abs(x - cx) / (S * 0.35) + Math.abs(y - cy) / (S * 0.43);
    if (d < 1) { const k = 1 - d; set(x, y, Math.round(30 + 130 * k), Math.round(16 + 60 * k), Math.round(70 + 170 * k)); }
  }
  // raio central
  for (let y = 0; y < S * 0.4; y++) for (let x = 0; x < S * 0.16; x++) {
    const px = cx - S * 0.02 + x * 0.3 - y * 0.15, py = cy - S * 0.22 + y;
    set(px, py, 220, 180, 255, 200);
  }
  return buf;
}
function draw(S) { return toPng(S, S, drawRaw(S)); }
fs.mkdirSync('assets', { recursive: true });
const png256 = draw(256);
fs.writeFileSync('assets/icon.png', png256);
// ICO com entradas PNG (16,32,48,256) — Windows aceita PNG dentro do ICO
function ico(sizes) {
  const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  const entries = [], blobs = []; let offset = 6 + 16 * sizes.length;
  for (const s of sizes) {
    const png = s === 256 ? png256 : draw(s);
    const e = Buffer.alloc(16);
    e[0] = s >= 256 ? 0 : s; e[1] = s >= 256 ? 0 : s; e[2] = 0; e[3] = 0;
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(png.length, 8); e.writeUInt32LE(offset, 12);
    entries.push(e); blobs.push(png); offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...blobs]);
}
fs.writeFileSync('assets/icon.ico', ico([16, 32, 48, 256]));
// ICO clássico (BMP) p/ NSIS, que não lê entradas PNG
function bmpIco(src, S, sizes) {
  const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  const entries = [], blobs = []; let offset = 6 + 16 * sizes.length;
  const px = (x, y) => { x = Math.min(S - 1, x | 0); y = Math.min(S - 1, y | 0); const i = (y * S + x) * 4; return [src[i], src[i + 1], src[i + 2], src[i + 3]]; };
  for (const s of sizes) {
    const rowStride = ((s * 32 + 31) >> 5) << 2;
    const xor = Buffer.alloc(rowStride * s), and = Buffer.alloc((((s + 31) >> 5) << 2) * s, 0);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const [r, g, b, a] = px(x * S / s, y * S / s);
      const o = ((s - 1 - y) * rowStride) + x * 4;
      xor[o] = b; xor[o + 1] = g; xor[o + 2] = r; xor[o + 3] = a;
      if (a < 128) and[(((s - 1 - y) * ((((s + 31) >> 5) << 2) * 8) + x) >> 3)] |= 1 << (7 - (x % 8));
    }
    const bi = Buffer.alloc(40); bi.writeUInt32LE(40, 0); bi.writeInt32LE(s, 4); bi.writeInt32LE(s * 2, 8); bi.writeUInt16LE(1, 12); bi.writeUInt16LE(32, 14);
    const blob = Buffer.concat([bi, xor, and]);
    const e = Buffer.alloc(16); e[0] = s; e[1] = s; e[2] = 0; e[3] = 0;
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(blob.length, 8); e.writeUInt32LE(offset, 12);
    entries.push(e); blobs.push(blob); offset += blob.length;
  }
  return Buffer.concat([header, ...entries, ...blobs]);
}
fs.writeFileSync('assets/icon-nsis.ico', bmpIco(drawRaw(256), 256, [16, 32, 48]));
console.log('icon-ok', fs.statSync('assets/icon.png').length, fs.statSync('assets/icon.ico').length, fs.statSync('assets/icon-nsis.ico').length);
