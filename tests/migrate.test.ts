import { describe, expect, it } from 'vitest';
import { migratePack, MigrationError } from '../src/core/schema/migrate';
import { samplePack } from './helpers';

describe('migratePack', () => {
  it('version ปัจจุบันผ่านโดยไม่เปลี่ยน', () => {
    const p = samplePack();
    expect(migratePack(p)).toEqual(p);
  });

  it('ไล่ migration ทีละขั้นจนถึง target โดยไม่แตะ id', () => {
    const v0 = { meta: { id: 'x', schemaVersion: 0, title: 'old' }, cards: [{ id: 'keep-me' }] };
    const migrations = {
      0: (p: Record<string, any>) => ({ ...p, meta: { ...p.meta, schemaVersion: 1, name: p.meta.title } }),
      1: (p: Record<string, any>) => ({ ...p, meta: { ...p.meta, schemaVersion: 2 } }),
    };
    const out = migratePack(v0, migrations, 2) as any;
    expect(out.meta.schemaVersion).toBe(2);
    expect(out.meta.name).toBe('old');
    expect(out.cards[0].id).toBe('keep-me');
  });

  it('ขาด migration → error', () => {
    expect(() => migratePack({ meta: { schemaVersion: 0 } }, {}, 1)).toThrow(MigrationError);
  });

  it('migration ที่ไม่เพิ่ม version → error', () => {
    expect(() => migratePack({ meta: { schemaVersion: 0 } }, { 0: (p) => p }, 1)).toThrow(MigrationError);
  });

  it('ไม่มี schemaVersion หรือใหม่กว่าแอป → error', () => {
    expect(() => migratePack({ meta: {} })).toThrow(MigrationError);
    expect(() => migratePack({ meta: { schemaVersion: 999 } })).toThrow(/ใหม่กว่า/);
  });
});
