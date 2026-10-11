import { writeFileSync } from 'node:fs';
import { INDEX_PATH } from './lib/content';
import { generateIndexText } from './lib/indexGen';

const { text, skipped, count } = generateIndexText();
writeFileSync(INDEX_PATH, text, 'utf8');
console.log(`✓ content/index.json: ${count} pack`);
if (skipped.length) {
  console.warn(`⚠ ข้าม ${skipped.length} ไฟล์ที่ schema ไม่ผ่าน: ${skipped.join(', ')} (รัน npm run validate)`);
  process.exitCode = 1;
}
