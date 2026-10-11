import indexJson from '../../../content/index.json';
import taxonomyJson from '../../../content/taxonomy.json';
import { migratePack } from '../../core/schema/migrate';
import { Pack } from '../../core/schema/pack';
import type { Taxonomy } from '../../core/schema/taxonomy';
import type { PackIndexEntry, VaultIndex } from '../../core/vaultIndex';

export const vaultIndex = indexJson as VaultIndex;
export const taxonomy = taxonomyJson as Taxonomy;

/** pack แต่ละไฟล์เป็น chunk แยก โหลดเมื่อเปิดใช้ (lazy) */
const packModules = import.meta.glob<{ default: unknown }>('/content/packs/**/*.json');

const cache = new Map<string, Promise<Pack>>();

export function findEntry(packId: string): PackIndexEntry | undefined {
  return vaultIndex.packs.find((p) => p.id === packId);
}

export function loadPack(packId: string): Promise<Pack> {
  const cached = cache.get(packId);
  if (cached) return cached;
  const entry = findEntry(packId);
  const loader = entry ? packModules[`/content/packs/${entry.file}`] : undefined;
  if (!entry || !loader) return Promise.reject(new Error(`ไม่พบ pack "${packId}"`));
  const promise = loader().then((mod) => Pack.parse(migratePack(mod.default)));
  cache.set(packId, promise);
  promise.catch(() => cache.delete(packId));
  return promise;
}

export function subjectLabel(id: string): string {
  return taxonomy.subjects.find((s) => s.id === id)?.th ?? id;
}

export function rotationLabel(id: string): string {
  return taxonomy.rotations.find((r) => r.id === id)?.th ?? id;
}
