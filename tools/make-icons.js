// Generate PNG app icons (no deps): teal rounded square, white house outline, sand check mark.
const fs = require('fs'); const zlib = require('zlib'); const path = require('path');
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; for (let x = 0; x < size; x++) { const [r, g, b, a] = pixel(x / size, y / size); const o = y * (size * 4 + 1) + 1 + x * 4; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// geometry in unit square; stroke distance helpers
const segs = [ // house outline + check, coordinates from icon.svg /120
  [[22, 60], [60, 28]], [[60, 28], [98, 60]], [[34, 56], [34, 96]], [[34, 96], [86, 96]], [[86, 96], [86, 56]]
];
const checkSegs = [[[48, 74], [56, 82]], [[56, 82], [72, 64]]];
function distSeg(px, py, [[x1, y1], [x2, y2]]) { const dx = x2 - x1, dy = y2 - y1; const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))); const cx = x1 + t * dx, cy = y1 + t * dy; return Math.hypot(px - cx, py - cy); }
function pixel(u, v, maskable) {
  const x = u * 120, y = v * 120;
  // rounded square mask (or full square for maskable)
  const r = 26; const inX = Math.min(x, 120 - x), inY = Math.min(y, 120 - y);
  let inside = true; if (!maskable && inX < r && inY < r) inside = Math.hypot(r - inX, r - inY) <= r;
  if (!inside) return [0, 0, 0, 0];
  const scale = maskable ? 0.78 : 1; const cx = (x - 60) / scale + 60, cy = (y - 60) / scale + 60;
  const w = 3.5;
  for (const s of checkSegs) if (distSeg(cx, cy, s) <= w) return [245, 228, 198, 255];
  for (const s of segs) if (distSeg(cx, cy, s) <= w) return [255, 255, 255, 255];
  return [15, 110, 122, 255];
}
const out = path.join(__dirname, '..', 'docs');
fs.writeFileSync(path.join(out, 'icon-180.png'), png(180, (u, v) => pixel(u, v, false)));
fs.writeFileSync(path.join(out, 'icon-512.png'), png(512, (u, v) => pixel(u, v, true)));
console.log('icons written');
