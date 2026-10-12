import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { ROOT } from './lib/content';

/**
 * npm run icons — สร้างไอคอน PWA (PNG + SVG) ด้วย Node ล้วน ไม่ต้องใช้เครื่องมือภายนอก
 * รูป: พื้นน้ำเงิน + การ์ดสีขาว + เส้น ECG
 */

const BG: [number, number, number] = [37, 87, 214];
const CARD: [number, number, number] = [255, 255, 255];
const LINE: [number, number, number] = [37, 87, 214];

// พิกัดแบบ 0–1 ของเส้น ECG บนการ์ด
const ECG: [number, number][] = [
  [0.27, 0.55],
  [0.4, 0.55],
  [0.45, 0.42],
  [0.5, 0.7],
  [0.56, 0.32],
  [0.61, 0.6],
  [0.65, 0.55],
  [0.73, 0.55],
];

function distToSegment(px: number, py: number, [ax, ay]: [number, number], [bx, by]: [number, number]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function insideRoundRect(x: number, y: number, x0: number, y0: number, x1: number, y1: number, r: number) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.max(x0 + r, Math.min(x1 - r, x));
  const cy = Math.max(y0 + r, Math.min(y1 - r, y));
  return Math.hypot(x - cx, y - cy) <= r;
}

/** สีของจุด (x,y ใน 0–1); maskable = พื้นเต็มกรอบ (ไม่มีมุมโค้ง) */
function colorAt(x: number, y: number, maskable: boolean): [number, number, number, number] {
  const inBg = maskable || insideRoundRect(x, y, 0, 0, 1, 1, 0.22);
  if (!inBg) return [0, 0, 0, 0];
  // maskable: เนื้อหาต้องอยู่ใน safe zone (วงกลม 80%) จึงย่อการ์ดลง
  const s = maskable ? 0.8 : 1;
  const u = (x - 0.5) / s + 0.5;
  const v = (y - 0.5) / s + 0.5;
  if (insideRoundRect(u, v, 0.22, 0.2, 0.78, 0.8, 0.07)) {
    for (let i = 0; i < ECG.length - 1; i++) {
      if (distToSegment(u, v, ECG[i]!, ECG[i + 1]!) < 0.032) return [...LINE, 255];
    }
    return [...CARD, 255];
  }
  return [...BG, 255];
}

function renderPng(size: number, maskable = false): Buffer {
  const SS = 4; // supersampling ต่อแกน
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [cr, cg, cb, ca] = colorAt((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, maskable);
          r += cr * ca;
          g += cg * ca;
          b += cb * ca;
          a += ca;
        }
      }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round(a / (SS * SS));
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="rgb(${BG.join(',')})"/>
  <rect x="22" y="20" width="56" height="60" rx="7" fill="#fff"/>
  <polyline points="${ECG.map(([x, y]) => `${(x * 100).toFixed(1)},${(y * 100).toFixed(1)}`).join(' ')}" fill="none" stroke="rgb(${LINE.join(',')})" stroke-width="6.4" stroke-linejoin="round" stroke-linecap="round"/>
</svg>
`;

const out = path.join(ROOT, 'public');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'icon.svg'), svg);
writeFileSync(path.join(out, 'icon-192.png'), renderPng(192));
writeFileSync(path.join(out, 'icon-512.png'), renderPng(512));
writeFileSync(path.join(out, 'icon-maskable-512.png'), renderPng(512, true));
writeFileSync(path.join(out, 'apple-touch-icon.png'), renderPng(180, true));
console.log('✓ public/icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png');
