import Dexie, { type EntityTable } from 'dexie';
import type { ContentFlag, ItemState, PackPrefRecord, ReviewLogEntry } from '../core/srs/model';

/** สวิตช์ "เปิดทวน / พักไว้" ราย pack — pack ใหม่ต้องกดเปิดเองเท่านั้น */
export type PackPref = PackPrefRecord;

export interface KV {
  key: string;
  value: unknown;
}

/**
 * IndexedDB บนเครื่อง — ข้อมูลการทวนไม่ขึ้น repo และไม่ส่งไปที่ไหน
 * เปลี่ยน schema = เพิ่ม this.version(n) ใหม่ ห้ามแก้ version เก่า
 */
export class VaultDB extends Dexie {
  packPrefs!: EntityTable<PackPref, 'packId'>;
  itemStates!: EntityTable<ItemState, 'id'>;
  reviewLogs!: EntityTable<ReviewLogEntry, 'id'>;
  contentFlags!: EntityTable<ContentFlag, 'id'>;
  kv!: EntityTable<KV, 'key'>;

  constructor(name = 'med-game-vault') {
    super(name);
    this.version(1).stores({
      packPrefs: 'packId, enabled',
    });
    this.version(2).stores({
      packPrefs: 'packId',
      itemStates: 'id, packId, card.due',
      reviewLogs: 'id, itemId, packId, reviewedAt',
      contentFlags: 'id, itemId, packId, createdAt',
      kv: 'key',
    });
  }
}

export const db = new VaultDB();

export async function setPackEnabled(packId: string, enabled: boolean, database: VaultDB = db): Promise<void> {
  await database.packPrefs.put({ packId, enabled, updatedAt: new Date().toISOString() });
}
