import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VaultDB } from '../src/app/db';
import { exportAll, flagContent, importMerge, loadVaultData, recordReview, saveSettings, setSuspended } from '../src/app/repo';
import { extractItems } from '../src/core/items/extract';
import { Pack } from '../src/core/schema/pack';
import { ImportError, makeDebriefExport, mergeVault, parseExport } from '../src/core/srs/backup';
import { samplePack } from './helpers';

const items = extractItems(Pack.parse(samplePack())).filter((i) => i.kind === 'memory');
const [a, b, c] = items as [(typeof items)[0], (typeof items)[0], (typeof items)[0]];

let n = 0;
let dbA: VaultDB;
let dbB: VaultDB;
beforeEach(() => {
  dbA = new VaultDB(`test-a-${n}`);
  dbB = new VaultDB(`test-b-${n++}`);
});
afterEach(async () => {
  await dbA.delete();
  await dbB.delete();
});

const t = (h: number) => new Date(Date.UTC(2026, 9, 12, h));

describe('recordReview', () => {
  it('บันทึก state + log append-only และ error type เฉพาะตอน Again', async () => {
    await recordReview({ item: a, grade: 1, now: t(1), durationMs: 4200, errorType: 'trap', note: '  สับสน  ' }, dbA);
    await recordReview({ item: a, grade: 3, now: t(2), durationMs: 3000, errorType: 'fact' }, dbA);
    const data = await loadVaultData(dbA);
    expect(data.itemStates).toHaveLength(1);
    expect(data.reviewLogs).toHaveLength(2);
    const [first, second] = data.reviewLogs.sort((x, y) => (x.reviewedAt < y.reviewedAt ? -1 : 1));
    expect(first!.errorType).toBe('trap');
    expect(first!.note).toBe('สับสน');
    expect(first!.stateBefore).toBe(0);
    expect(second!.errorType).toBeNull();
  });

  it('ฝึกนอกตาราง (countsToFsrs=false) ไม่แตะ FSRS state แต่ยังมี log', async () => {
    await recordReview({ item: a, grade: 4, now: t(1), durationMs: 1000, session: 'practice', countsToFsrs: false }, dbA);
    const data = await loadVaultData(dbA);
    expect(data.itemStates).toHaveLength(0);
    expect(data.reviewLogs[0]!.session).toBe('practice');
  });
});

describe('export / import', () => {
  it('round-trip: export แล้ว import เข้า DB ว่าง ได้ข้อมูลเท่าเดิม', async () => {
    await saveSettings({ desiredRetention: 0.85, newPerDay: 7 }, dbA);
    await dbA.packPrefs.put({ packId: 'cardio-heart-failure', enabled: true, updatedAt: t(0).toISOString() });
    await recordReview({ item: a, grade: 3, now: t(1), durationMs: 5000 }, dbA);
    await recordReview({ item: b, grade: 1, now: t(2), durationMs: 9000, errorType: 'rule' }, dbA);
    await setSuspended(c, true, t(3), dbA);
    await flagContent(b, 'ตัวเลขน่าจะผิด', t(4), dbA);

    const file = await exportAll(t(5), dbA);
    // ผ่าน JSON จริงเหมือนไฟล์บนดิสก์
    const summary = await importMerge(JSON.parse(JSON.stringify(file)), dbB);
    expect(summary.statesAdded).toBe(3);
    expect(summary.logsAdded).toBe(2);
    expect(summary.flagsAdded).toBe(1);

    const again = await exportAll(t(5), dbB);
    expect(again).toEqual(file);
  });

  it('merge ตาม item ID: ใช้รายการที่ทวนล่าสุดกว่า และรวม log ไม่ซ้ำ', async () => {
    // A ทวน a ตอน 1:00, B ทวน a ตอน 3:00 (ใหม่กว่า) และ b ตอน 2:00
    await recordReview({ item: a, grade: 3, now: t(1), durationMs: 1000 }, dbA);
    await recordReview({ item: a, grade: 4, now: t(3), durationMs: 1000 }, dbB);
    await recordReview({ item: b, grade: 3, now: t(2), durationMs: 1000 }, dbB);
    const fromB = await exportAll(t(4), dbB);

    const summary = await importMerge(fromB, dbA);
    const data = await loadVaultData(dbA);
    const stA = data.itemStates.find((s) => s.id === a.id)!;
    expect(stA.card.last_review).toBe(t(3).toISOString());
    expect(summary.statesReplaced).toBe(1);
    expect(summary.statesAdded).toBe(1);
    expect(data.reviewLogs).toHaveLength(3);

    // import ไฟล์เดิมซ้ำ = ไม่มีอะไรเปลี่ยน
    const again = await importMerge(fromB, dbA);
    expect(again).toEqual({ statesAdded: 0, statesReplaced: 0, logsAdded: 0, flagsAdded: 0 });
  });

  it('merge ไม่เอาข้อมูลเก่ากว่ามาทับ', () => {
    const base = { settings: { updatedAt: '2026-01-02' } } as never;
    const newer = { id: 'x', card: { last_review: '2026-10-12T03:00:00.000Z' }, updatedAt: '2026-10-12' } as never;
    const older = { id: 'x', card: { last_review: '2026-10-11T03:00:00.000Z' }, updatedAt: '2026-10-11' } as never;
    const { data } = mergeVault(
      { ...(base as object), packPrefs: [], itemStates: [newer], reviewLogs: [], contentFlags: [] } as never,
      { settings: { updatedAt: '2026-01-01' }, packPrefs: [], itemStates: [older], reviewLogs: [], contentFlags: [] } as never,
    );
    expect(data.itemStates[0]).toBe(newer);
  });

  it('ไฟล์ผิดรูปแบบ / ใหม่กว่าแอป → ImportError', () => {
    expect(() => parseExport({ hello: 1 })).toThrow(ImportError);
    expect(() => parseExport({ kind: 'med-game-vault-backup', schemaVersion: 99 })).toThrow(/ใหม่กว่า/);
  });

  it('migration ของไฟล์ export ไล่จาก v0 → v1', () => {
    const v0 = {
      kind: 'med-game-vault-backup',
      schemaVersion: 0,
      exportedAt: t(0).toISOString(),
      settings: {},
      prefs: [],
      itemStates: [],
      reviewLogs: [],
      contentFlags: [],
    };
    const migrations = { 0: (f: Record<string, unknown>) => ({ ...f, schemaVersion: 1, packPrefs: f.prefs }) };
    const parsed = parseExport(v0, migrations);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.packPrefs).toEqual([]);
    expect(parsed.settings.desiredRetention).toBe(0.9);
  });

  it('export สำหรับ Claude: error + leech + flag พร้อมบริบทของ item', async () => {
    await recordReview({ item: a, grade: 1, now: t(1), durationMs: 1000, errorType: 'fact', note: 'ลืมตัวเลข' }, dbA);
    await flagContent(b, 'ผิด guideline ใหม่', t(2), dbA);
    const data = await loadVaultData(dbA);
    data.itemStates = data.itemStates.map((s) => ({ ...s, leech: true }));
    const out = makeDebriefExport(data, new Map(items.map((i) => [i.id, i])), t(3));
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]).toMatchObject({ itemId: a.id, errorType: 'fact', note: 'ลืมตัวเลข', front: a.front, packId: 'cardio-heart-failure' });
    expect(out.leeches[0]).toMatchObject({ itemId: a.id });
    expect(out.flags[0]).toMatchObject({ itemId: b.id, note: 'ผิด guideline ใหม่' });
  });
});
