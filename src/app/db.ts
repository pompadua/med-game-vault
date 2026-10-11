import Dexie, { type EntityTable } from 'dexie';

/** สวิตช์ "เปิดทวน / พักไว้" ราย pack — pack ใหม่ต้องกดเปิดเองเท่านั้น */
export interface PackPref {
  packId: string;
  enabled: boolean;
  updatedAt: string;
}

export class VaultDB extends Dexie {
  packPrefs!: EntityTable<PackPref, 'packId'>;

  constructor(name = 'med-game-vault') {
    super(name);
    this.version(1).stores({
      packPrefs: 'packId, enabled',
    });
  }
}

export const db = new VaultDB();

export async function setPackEnabled(packId: string, enabled: boolean): Promise<void> {
  await db.packPrefs.put({ packId, enabled, updatedAt: new Date().toISOString() });
}
