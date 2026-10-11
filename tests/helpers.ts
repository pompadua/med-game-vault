import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Taxonomy } from '../src/core/schema/taxonomy';

const ROOT = path.resolve(import.meta.dirname, '..');

export function readJsonFile<T = unknown>(rel: string): T {
  return JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8')) as T;
}

export const taxonomy = readJsonFile<Taxonomy>('content/taxonomy.json');

/** sample pack จริงในคลัง — clone ใหม่ทุกครั้งเพื่อให้แก้ใน test ได้ */
export function samplePack(): any {
  return structuredClone(readJsonFile('content/packs/cardio/cardio-heart-failure.json'));
}
