import { MEMORY_ITEM_TYPES, type ItemType } from '../core/items/types';

/** ชนิด item ที่แอปมี UI ให้ทวนได้แล้ว — item ชนิดอื่นจะยังไม่เข้าคิว */
export const PLAYABLE_TYPES: ReadonlySet<ItemType> = new Set<ItemType>([...MEMORY_ITEM_TYPES]);
