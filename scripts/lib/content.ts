import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Taxonomy } from '../../src/core/schema/taxonomy';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONTENT_DIR = path.join(ROOT, 'content');
export const PACKS_DIR = path.join(CONTENT_DIR, 'packs');
export const INDEX_PATH = path.join(CONTENT_DIR, 'index.json');
export const TAXONOMY_PATH = path.join(CONTENT_DIR, 'taxonomy.json');

export interface PackFile {
  /** path แบบ posix ภายใต้ content/packs เช่น cardio/cardio-heart-failure.json */
  file: string;
  absPath: string;
  subjectDir: string;
  baseName: string;
}

export function listPackFiles(): PackFile[] {
  if (!existsSync(PACKS_DIR)) return [];
  const out: PackFile[] = [];
  for (const subjectDir of readdirSync(PACKS_DIR, { withFileTypes: true })) {
    if (!subjectDir.isDirectory()) continue;
    for (const f of readdirSync(path.join(PACKS_DIR, subjectDir.name), { withFileTypes: true })) {
      if (!f.isFile() || !f.name.endsWith('.json')) continue;
      out.push({
        file: `${subjectDir.name}/${f.name}`,
        absPath: path.join(PACKS_DIR, subjectDir.name, f.name),
        subjectDir: subjectDir.name,
        baseName: f.name.replace(/\.json$/, ''),
      });
    }
  }
  return out.sort((a, b) => (a.file < b.file ? -1 : 1));
}

export function readJson(absPath: string): unknown {
  // ตัด BOM ที่ editor บน Windows อาจใส่มา
  return JSON.parse(readFileSync(absPath, 'utf8').replace(/^﻿/, ''));
}

export function loadTaxonomy(): Taxonomy {
  return Taxonomy.parse(readJson(TAXONOMY_PATH));
}

/** อ่านไฟล์เวอร์ชันใน git HEAD (undefined ถ้าไม่มี git, ยังไม่มี commit หรือเป็นไฟล์ใหม่) */
export function readFromGitHead(relPathFromRoot: string): unknown {
  try {
    const text = execFileSync('git', ['show', `HEAD:${relPathFromRoot}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return undefined;
  }
}
