import { rmSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/content';

// แทน `rm -rf` ให้รันได้ทั้ง Windows/macOS/Linux
for (const dir of ['dist', 'dev-dist']) {
  rmSync(path.join(ROOT, dir), { recursive: true, force: true });
  console.log(`ลบ ${dir}/`);
}
