import { migratePack } from '../../src/core/schema/migrate';
import { Pack } from '../../src/core/schema/pack';
import { buildIndex, buildIndexEntry, serializeIndex, type PackIndexEntry } from '../../src/core/vaultIndex';
import { listPackFiles, loadTaxonomy, readJson } from './content';

/** สร้างข้อความของ content/index.json จาก pack ทุกไฟล์ (ไฟล์ที่ schema ไม่ผ่านถูกข้ามและรายงานใน skipped) */
export function generateIndexText(): { text: string; skipped: string[]; count: number } {
  const taxonomy = loadTaxonomy();
  const skipped: string[] = [];
  const entries: PackIndexEntry[] = [];
  for (const f of listPackFiles()) {
    let parsed;
    try {
      parsed = Pack.safeParse(migratePack(readJson(f.absPath)));
    } catch {
      skipped.push(f.file);
      continue;
    }
    if (!parsed.success) {
      skipped.push(f.file);
      continue;
    }
    entries.push(buildIndexEntry(parsed.data, f.file, taxonomy));
  }
  return { text: serializeIndex(buildIndex(entries)), skipped, count: entries.length };
}
