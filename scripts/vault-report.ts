import { existsSync } from 'node:fs';
import path from 'node:path';
import { CONTENT_DIR, INDEX_PATH, loadTaxonomy, readJson } from './lib/content';
import type { VaultIndex } from '../src/core/vaultIndex';

/**
 * npm run vault:report — สรุปคลังสำหรับ /vault
 * pack แยกตาม subject/rotation, pack ที่ยังเป็น draft, verifiedAt เกิน 6 เดือน (ควร audit)
 * และหัวข้อใน content/curriculum.json ที่ยังไม่มี pack
 */
interface Curriculum {
  currentRotation?: string;
  rotations: Record<string, { topic: string; packId?: string }[]>;
}

const index = readJson(INDEX_PATH) as VaultIndex;
const taxonomy = loadTaxonomy();
const curriculumPath = path.join(CONTENT_DIR, 'curriculum.json');
const curriculum = existsSync(curriculumPath) ? (readJson(curriculumPath) as Curriculum) : { rotations: {} };

const today = new Date();
const sixMonthsAgo = new Date(today);
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

const countBy = (key: 'subject' | 'rotation') => {
  const m = new Map<string, number>();
  for (const p of index.packs) m.set(p[key], (m.get(p[key]) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};
const th = (list: { id: string; th: string }[], id: string) => list.find((x) => x.id === id)?.th ?? id;

const packIds = new Set(index.packs.map((p) => p.id));
const missing: Record<string, string[]> = {};
for (const [rot, topics] of Object.entries(curriculum.rotations)) {
  missing[rot] = topics.filter((t) => !t.packId || !packIds.has(t.packId)).map((t) => t.topic);
}

const report = {
  generatedAt: today.toISOString().slice(0, 10),
  totalPacks: index.packs.length,
  totalItems: index.packs.reduce((s, p) => s + p.itemCount, 0),
  bySubject: countBy('subject').map(([id, n]) => ({ id, th: th(taxonomy.subjects, id), packs: n })),
  byRotation: countBy('rotation').map(([id, n]) => ({ id, th: th(taxonomy.rotations, id), packs: n })),
  byStatus: {
    draft: index.packs.filter((p) => p.status === 'draft').map((p) => p.id),
    verified: index.packs.filter((p) => p.status === 'verified').map((p) => p.id),
    needsAudit: index.packs.filter((p) => p.status === 'needs-audit').map((p) => p.id),
  },
  staleVerification: index.packs
    .filter((p) => p.verifiedAt && new Date(p.verifiedAt) < sixMonthsAgo)
    .map((p) => ({ id: p.id, verifiedAt: p.verifiedAt })),
  currentRotation: curriculum.currentRotation ?? null,
  missingTopics: missing,
};

console.log(JSON.stringify(report, null, 2));
