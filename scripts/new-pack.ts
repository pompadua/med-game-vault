import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Slug } from '../src/core/schema/pack';
import { loadTaxonomy, PACKS_DIR } from './lib/content';

/**
 * npm run pack:new -- <subject> <packId> "<title>" [rotation]
 * สร้างโครง pack ว่าง (status draft) ให้ Claude เติมเนื้อหาต่อ — จะไม่เขียนทับไฟล์ที่มีอยู่
 */
const [subject, packId, title, rotation = 'med'] = process.argv.slice(2);
if (!subject || !packId || !title) {
  console.error('ใช้: npm run pack:new -- <subject> <packId> "<title>" [rotation]');
  process.exit(1);
}
const tax = loadTaxonomy();
if (!Slug.safeParse(packId).success) {
  console.error(`packId "${packId}" ต้องเป็น kebab-case`);
  process.exit(1);
}
if (!tax.subjects.some((s) => s.id === subject)) {
  console.error(`subject "${subject}" ไม่อยู่ใน taxonomy (มี: ${tax.subjects.map((s) => s.id).join(', ')})`);
  process.exit(1);
}
if (!tax.rotations.some((r) => r.id === rotation)) {
  console.error(`rotation "${rotation}" ไม่อยู่ใน taxonomy`);
  process.exit(1);
}
const dir = path.join(PACKS_DIR, subject);
const file = path.join(dir, `${packId}.json`);
if (existsSync(file)) {
  console.error(`มีไฟล์อยู่แล้ว: ${path.relative(process.cwd(), file)} — ห้ามสร้างทับ`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
const skeleton = {
  meta: { id: packId, title, subject, rotation, tags: [], status: 'draft', schemaVersion: 1, createdAt: today, verifiedAt: null, sources: [] },
  rulebook: { board: '', pieces: [], coreRules: [], winConditions: [], loseConditions: [], errata: [] },
  cards: [],
  exploits: [],
  distractorPatterns: [],
  trapPairs: [],
  games: {},
};
writeFileSync(file, `${JSON.stringify(skeleton, null, 2)}\n`, 'utf8');
console.log(`สร้าง ${path.relative(process.cwd(), file)} แล้ว — เติมเนื้อหาแล้วรัน npm run validate`);
