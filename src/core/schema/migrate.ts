import { CURRENT_PACK_SCHEMA_VERSION } from './pack';

/**
 * Migration ของไฟล์ pack: แต่ละ entry แปลงจาก version N → N+1
 * เมื่อเปลี่ยน schema: เพิ่ม CURRENT_PACK_SCHEMA_VERSION, เพิ่ม migration ที่นี่ และเพิ่ม test ใน tests/migrate.test.ts
 * ห้ามเปลี่ยน id ของ element ใน migration (review item อ้างอิงอยู่)
 */
type Raw = Record<string, unknown>;
export const packMigrations: Record<number, (pack: Raw) => Raw> = {
  // ตัวอย่างรูปแบบ (ยังไม่มี v2):
  // 1: (p) => ({ ...p, meta: { ...(p.meta as Raw), schemaVersion: 2 } }),
};

export class MigrationError extends Error {}

export function readSchemaVersion(raw: unknown): number | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const meta = (raw as Raw).meta;
  if (typeof meta !== 'object' || meta === null) return undefined;
  const v = (meta as Raw).schemaVersion;
  return typeof v === 'number' ? v : undefined;
}

export function migratePack(
  raw: unknown,
  migrations: Record<number, (pack: Raw) => Raw> = packMigrations,
  target: number = CURRENT_PACK_SCHEMA_VERSION,
): unknown {
  let version = readSchemaVersion(raw);
  if (version === undefined) throw new MigrationError('ไม่พบ meta.schemaVersion');
  if (version > target) {
    throw new MigrationError(`schemaVersion ${version} ใหม่กว่าที่แอปรองรับ (${target}) — อัปเดตแอปก่อน`);
  }
  let current = raw as Raw;
  while (version < target) {
    const step = migrations[version];
    if (!step) throw new MigrationError(`ไม่มี migration จาก schemaVersion ${version}`);
    current = step(current);
    const next = readSchemaVersion(current);
    if (next !== version + 1) {
      throw new MigrationError(`migration ${version} ต้องตั้ง schemaVersion เป็น ${version + 1}`);
    }
    version = next;
  }
  return current;
}
