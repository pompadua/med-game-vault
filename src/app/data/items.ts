import { extractItems } from '../../core/items/extract';
import type { ReviewItem } from '../../core/items/types';
import type { Pack } from '../../core/schema/pack';
import { loadPack, vaultIndex } from './vault';

const itemCache = new Map<string, ReviewItem[]>();

export function itemsOfPack(pack: Pack): ReviewItem[] {
  let items = itemCache.get(pack.meta.id);
  if (!items) {
    items = extractItems(pack);
    itemCache.set(pack.meta.id, items);
  }
  return items;
}

/** โหลด pack ตามรายการแล้วแตกเป็น review items (pack ที่ไม่มีในคลังแล้วจะถูกข้าม) */
export async function loadItems(packIds: Iterable<string>): Promise<{ items: ReviewItem[]; packs: Map<string, Pack> }> {
  const known = new Set(vaultIndex.packs.map((p) => p.id));
  const ids = [...new Set(packIds)].filter((id) => known.has(id));
  const packs = await Promise.all(ids.map((id) => loadPack(id)));
  return {
    items: packs.flatMap(itemsOfPack),
    packs: new Map(packs.map((p) => [p.meta.id, p])),
  };
}

export async function loadAllItems(): Promise<{ items: ReviewItem[]; packs: Map<string, Pack> }> {
  return loadItems(vaultIndex.packs.map((p) => p.id));
}
