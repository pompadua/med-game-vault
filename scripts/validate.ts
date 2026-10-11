import { existsSync, readFileSync } from 'node:fs';
import { Taxonomy } from '../src/core/schema/taxonomy';
import { validatePack } from '../src/core/validate';
import { INDEX_PATH, listPackFiles, readFromGitHead, readJson, TAXONOMY_PATH } from './lib/content';
import { generateIndexText } from './lib/indexGen';

/**
 * npm run validate — pack ที่ไม่ผ่านห้ามเข้าคลัง
 * error = ต้องแก้ (exit code 1), warning = ควรดู
 */
let errorCount = 0;
let warningCount = 0;

const taxResult = Taxonomy.safeParse(readJson(TAXONOMY_PATH));
if (!taxResult.success) {
  console.error('✗ content/taxonomy.json ไม่ผ่าน schema');
  for (const i of taxResult.error.issues) console.error(`   ${i.path.join('.')}: ${i.message}`);
  process.exit(1);
}
const taxonomy = taxResult.data;

const files = listPackFiles();
const seenIds = new Map<string, string>();

for (const f of files) {
  const raw = readJson(f.absPath);
  const previous = readFromGitHead(`content/packs/${f.file}`);
  const res = validatePack(raw, {
    taxonomy,
    expectedId: f.baseName,
    expectedSubject: f.subjectDir,
    previous,
  });
  const id = res.pack?.meta.id ?? f.baseName;
  const other = seenIds.get(id);
  if (other) res.errors.push(`packId "${id}" ซ้ำกับ ${other}`);
  seenIds.set(id, f.file);

  const mark = res.errors.length ? '✗' : '✓';
  console.log(`${mark} ${f.file}${res.errors.length ? '' : ` (${res.warnings.length} warning)`}`);
  for (const e of res.errors) console.error(`   ERROR   ${e}`);
  for (const w of res.warnings) console.warn(`   warning ${w}`);
  errorCount += res.errors.length;
  warningCount += res.warnings.length;
}

// index ต้องไม่ stale
const { text } = generateIndexText();
const current = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf8') : '';
if (current.replace(/\r\n/g, '\n') !== text) {
  console.error('✗ content/index.json ไม่ตรงกับ pack ปัจจุบัน — รัน npm run build:index');
  errorCount++;
} else {
  console.log('✓ content/index.json ตรงกับ pack ปัจจุบัน');
}

console.log(`\nสรุป: ${files.length} pack, ${errorCount} error, ${warningCount} warning`);
if (errorCount > 0) process.exit(1);
