import { countByType, extractItems } from './items/extract';
import type { ItemType } from './items/types';
import type { Pack, PackStatus } from './schema/pack';
import type { Taxonomy } from './schema/taxonomy';
import { normalizeSearch } from './search';

export const INDEX_VERSION = 1 as const;

export interface PackIndexEntry {
  id: string;
  title: string;
  subject: string;
  rotation: string;
  tags: string[];
  status: PackStatus;
  schemaVersion: number;
  createdAt: string;
  verifiedAt: string | null;
  /** path ภายใต้ content/packs เช่น cardio/cardio-heart-failure.json */
  file: string;
  itemCount: number;
  countsByType: Partial<Record<ItemType, number>>;
  cardNames: string[];
  modes: string[];
  /** ข้อความที่ normalize แล้ว สำหรับค้นหา (title, tags, การ์ด: ชื่อโรค/signature/counter/ค่าจำ, ชื่อยา, ข้อความกฎ/errata) */
  searchText: string;
}

export interface VaultIndex {
  indexVersion: typeof INDEX_VERSION;
  packs: PackIndexEntry[];
}

export function buildIndexEntry(pack: Pack, file: string, taxonomy: Taxonomy): PackIndexEntry {
  const items = extractItems(pack);
  const live = items.filter((i) => !i.retired);
  const subject = taxonomy.subjects.find((s) => s.id === pack.meta.subject);
  const rotation = taxonomy.rotations.find((r) => r.id === pack.meta.rotation);
  const cards = pack.cards.filter((c) => !c.retired);
  const searchParts = [
    pack.meta.title,
    pack.meta.id,
    ...pack.meta.tags,
    pack.meta.subject,
    subject?.th,
    subject?.en,
    pack.meta.rotation,
    rotation?.th,
    rotation?.en,
    ...cards.flatMap((c) => [
      c.name,
      c.signature,
      c.counter,
      ...c.memorize.filter((m) => !m.retired).flatMap((m) => [m.prompt, m.fact]),
    ]),
    ...(pack.games.matchups ?? []).flatMap((g) => g.rows.map((r) => r.drug)),
    ...pack.rulebook.pieces.map((p) => p.name),
    ...pack.rulebook.coreRules.filter((r) => !r.retired).map((r) => r.rule),
    ...pack.rulebook.errata.filter((e) => !e.retired).map((e) => e.text),
  ].filter((s): s is string => Boolean(s));

  return {
    id: pack.meta.id,
    title: pack.meta.title,
    subject: pack.meta.subject,
    rotation: pack.meta.rotation,
    tags: pack.meta.tags,
    status: pack.meta.status,
    schemaVersion: pack.meta.schemaVersion,
    createdAt: pack.meta.createdAt,
    verifiedAt: pack.meta.verifiedAt,
    file,
    itemCount: live.length,
    countsByType: countByType(items),
    cardNames: cards.map((c) => c.name),
    modes: Object.entries(pack.games)
      .filter(([, v]) => Array.isArray(v) && v.length > 0)
      .map(([k]) => k),
    searchText: normalizeSearch(searchParts.join(' \n ')),
  };
}

export function buildIndex(entries: PackIndexEntry[]): VaultIndex {
  return {
    indexVersion: INDEX_VERSION,
    packs: [...entries].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0)),
  };
}

export function serializeIndex(index: VaultIndex): string {
  return `${JSON.stringify(index, null, 2)}\n`;
}
