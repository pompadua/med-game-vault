import { DebriefExport } from '../src/core/srs/backup';
import { readJson } from './lib/content';

/**
 * npm run debrief:summary -- <path ของไฟล์ export สำหรับ Claude>
 * จัดกลุ่มความผิดพลาดตาม pack → ชนิดความผิดพลาด → item เพื่อให้ /debrief วางแผนเพิ่ม item ได้ทันที
 */
const file = process.argv[2];
if (!file) {
  console.error('ใช้: npm run debrief:summary -- <path ของไฟล์ med-game-vault-debrief-*.json>');
  process.exit(1);
}
const parsed = DebriefExport.safeParse(readJson(file));
if (!parsed.success) {
  console.error('ไฟล์ไม่ใช่ export สำหรับ Claude (kind: med-game-vault-debrief)');
  process.exit(1);
}
const data = parsed.data;

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

const byPack = new Map<string, { errors: Row[]; leeches: Row[]; flags: Row[] }>();
const bucket = (packId: string) => {
  let b = byPack.get(packId);
  if (!b) {
    b = { errors: [], leeches: [], flags: [] };
    byPack.set(packId, b);
  }
  return b;
};
for (const e of data.errors) bucket(str(e.packId)).errors.push(e);
for (const l of data.leeches) bucket(str(l.packId)).leeches.push(l);
for (const f of data.flags) bucket(str(f.packId)).flags.push(f);

const ACTION: Record<string, string> = {
  fact: 'ไม่รู้ข้อเท็จจริง → เพิ่ม memorize (ต้องมี sourceId)',
  rule: 'ใช้กฎผิด → เพิ่ม engine/legality ใหม่',
  trap: 'ติดกับดัก → เพิ่ม trapPair (+ tell/exploit ถ้าจำเป็น)',
  clue: 'อ่าน clue พลาด → เพิ่ม deduction ใหม่ที่หมุนรอบ clue นั้น',
  null: 'ไม่ได้ระบุชนิด → ดูบริบทแล้วตัดสินเอง',
};

const out = [...byPack].map(([packId, b]) => {
  const groups = new Map<string, Map<string, { count: number; notes: string[]; front: string; type: string }>>();
  for (const e of b.errors) {
    const et = str(e.errorType) || 'null';
    const g = groups.get(et) ?? new Map();
    const id = str(e.itemId);
    const cur = g.get(id) ?? { count: 0, notes: [], front: str(e.front).split('\n')[0] ?? '', type: str(e.type) };
    cur.count++;
    if (e.note) cur.notes.push(str(e.note));
    g.set(id, cur);
    groups.set(et, g);
  }
  return {
    packId,
    removedFromVault: [...b.errors, ...b.leeches, ...b.flags].some((x) => x.removedFromVault === true),
    errorGroups: [...groups].map(([errorType, items]) => ({
      errorType,
      suggestedAction: ACTION[errorType] ?? ACTION.null,
      items: [...items].sort((a, b2) => b2[1].count - a[1].count).map(([itemId, v]) => ({ itemId, ...v })),
    })),
    leeches: b.leeches.map((l) => ({ itemId: l.itemId, lapses: l.lapses, front: str(l.front).split('\n')[0], action: 'เขียนใหม่ (คง id ถ้าความหมายเดิม) เช่น แปลงเป็นกฎหรือ trap pair' })),
    flags: b.flags.map((f) => ({ itemId: f.itemId, note: f.note, createdAt: f.createdAt, action: 'ส่งต่อ /audit-pack' })),
  };
});

console.log(JSON.stringify({ exportedAt: data.exportedAt, packs: out }, null, 2));
