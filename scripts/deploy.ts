import { execFileSync, execSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from './lib/content';

/**
 * npm run deploy            → build สำหรับ GitHub Pages แล้วบอกว่าจะ push อะไร (ยังไม่ push)
 * npm run deploy -- --yes   → build แล้ว push โฟลเดอร์ dist ไป branch gh-pages ของ remote origin
 *
 * ฟรีทั้งหมด: GitHub Pages ของ public repo + build บนเครื่องตัวเอง (ไม่ใช้ GitHub Actions)
 * หลัง push ครั้งแรก: GitHub → Settings → Pages → Source: Deploy from a branch → gh-pages / (root)
 */
const yes = process.argv.includes('--yes');
const git = (args: string[], cwd = ROOT) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

let remote: string;
try {
  remote = git(['remote', 'get-url', 'origin']);
} catch {
  console.error('ยังไม่มี git remote "origin" — สร้าง public repo บน GitHub แล้วรัน: git remote add origin <url>');
  process.exit(1);
}

const match = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
if (!match) {
  console.error(`remote ไม่ใช่ GitHub: ${remote}`);
  process.exit(1);
}
const [, owner, repo] = match as unknown as [string, string, string];
const isUserSite = repo.toLowerCase() === `${owner.toLowerCase()}.github.io`;
const basePath = isUserSite ? '/' : `/${repo}/`;
const siteUrl = isUserSite ? `https://${owner}.github.io/` : `https://${owner}.github.io/${repo}/`;

const dirty = git(['status', '--porcelain']);
if (dirty) console.warn('⚠ มีไฟล์ที่ยังไม่ commit — สิ่งที่ deploy จะมาจากไฟล์บนเครื่องตอนนี้');

console.log(`build ด้วย BASE_PATH=${basePath}`);
execSync('npm run build', { cwd: ROOT, stdio: 'inherit', env: { ...process.env, BASE_PATH: basePath } });
const dist = path.join(ROOT, 'dist');
// ปิด Jekyll ของ GitHub Pages (ไม่งั้นไฟล์/โฟลเดอร์ที่ขึ้นต้นด้วย _ จะหาย)
writeFileSync(path.join(dist, '.nojekyll'), '');

if (!yes) {
  console.log(`\n(dry run) พร้อม push dist/ ไป ${remote} branch gh-pages → ${siteUrl}`);
  console.log('รันอีกครั้งด้วย: npm run deploy -- --yes');
  process.exit(0);
}

const tmp = mkdtempSync(path.join(os.tmpdir(), 'mgv-deploy-'));
try {
  cpSync(dist, tmp, { recursive: true });
  const name = git(['config', 'user.name']);
  const email = git(['config', 'user.email']);
  const head = git(['rev-parse', '--short', 'HEAD']);
  git(['init', '-q', '-b', 'gh-pages'], tmp);
  git(['config', 'user.name', name], tmp);
  git(['config', 'user.email', email], tmp);
  git(['add', '-A'], tmp);
  git(['commit', '-q', '-m', `deploy ${head}`], tmp);
  execFileSync('git', ['push', '--force', remote, 'gh-pages:gh-pages'], { cwd: tmp, stdio: 'inherit' });
  console.log(`\n✓ deploy แล้ว → ${siteUrl}`);
  console.log('ถ้าเป็นครั้งแรก: GitHub → Settings → Pages → Deploy from a branch → gh-pages / (root)');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
