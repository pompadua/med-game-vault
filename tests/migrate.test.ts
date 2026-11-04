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

  it('v1 → v3 ด้วย migration จริง: เปลี่ยนแค่ version ข้อมูลเดิมครบ', () => {
    const v1 = { ...samplePack(), meta: { ...samplePack().meta, schemaVersion: 1 } };
    const out = migratePack(v1) as any;
    expect(out.meta.schemaVersion).toBe(3);
    expect(out.cards).toEqual(v1.cards);
    expect(out.rulebook).toEqual(v1.rulebook);
  });

  it('v2 → v3 ด้วย migration จริง: rulebook.track เดิมยังอยู่', () => {
    const base = samplePack();
    const v2 = {
      ...base,
      meta: { ...base.meta, schemaVersion: 2 },
      rulebook: { ...base.rulebook, track: [{ id: 'level-a', name: 'A', cardIds: [base.cards[0].id] }] },
    };
    const out = migratePack(v2) as any;
    expect(out.meta.schemaVersion).toBe(3);
    expect(out.rulebook).toEqual(v2.rulebook);
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
