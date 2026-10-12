import { describe, expect, it } from 'vitest';
import type { ItemState, ReviewLogEntry } from '../src/core/srs/model';
import { newStoredCard } from '../src/core/srs/scheduler';
import { accuracyBy, dueForecast, errorTypeCounts, minutesPerDay, streak, trueRetention } from '../src/core/srs/stats';

const cfg = { timeZone: 'Asia/Bangkok', dayStartHour: 4 };
const now = new Date('2026-10-12T05:00:00Z'); // 12:00 BKK, วันทวน 2026-10-12
const at = (key: string, hourBkk = 12) => new Date(`${key}T${String(hourBkk).padStart(2, '0')}:00:00+07:00`).toISOString();

function log(p: Partial<ReviewLogEntry> & { reviewedAt: string }): ReviewLogEntry {
  return {
    id: `x@${p.reviewedAt}@${Math.random()}`,
    itemId: 'p:memorize:a',
    packId: 'p',
    type: 'memorize',
    grade: 3,
    durationMs: 60_000,
    errorType: null,
    note: null,
    session: 'scheduled',
    countsToFsrs: true,
    stateBefore: 2,
    elapsedDays: 1,
    scheduledDays: 1,
    contentHash: 'h',
    detail: null,
    ...p,
  };
}

function state(id: string, dueIso: string, st = 2, suspended = false): ItemState {
  return {
    id,
    packId: 'p',
    card: { ...newStoredCard(now), state: st, due: dueIso },
    contentHash: 'h',
    suspended,
    buriedUntil: null,
    leech: false,
    updatedAt: now.toISOString(),
  };
}

describe('stats', () => {
  it('true retention นับเฉพาะ Review state ที่นับเข้า FSRS', () => {
    const logs = [
      log({ reviewedAt: at('2026-10-10'), grade: 3 }),
      log({ reviewedAt: at('2026-10-10'), grade: 1 }),
      log({ reviewedAt: at('2026-10-11'), grade: 4 }),
      log({ reviewedAt: at('2026-10-11'), grade: 1, stateBefore: 1 }), // learning ไม่นับ
      log({ reviewedAt: at('2026-10-11'), grade: 1, countsToFsrs: false, session: 'practice' }), // ฝึกนอกตารางไม่นับ
    ];
    expect(trueRetention(logs)).toEqual({ correct: 2, n: 3, value: 2 / 3 });
    expect(trueRetention(logs, '2026-10-11', cfg).n).toBe(1);
    expect(trueRetention([]).value).toBeUndefined();
  });

  it('due forecast: item ค้างนับเป็นวันนี้, suspended/new ไม่นับ, ใช้ขอบวัน 04:00', () => {
    const states = [
      state('a', '2026-10-01T00:00:00Z'), // ค้าง
      state('b', at('2026-10-13', 3)), // ตี 3 วันที่ 13 = ยังเป็นวันทวน 12
      state('c', at('2026-10-13', 5)),
      state('d', at('2026-10-14'), 2, true),
      state('e', at('2026-10-14'), 0),
      state('f', at('2026-12-31')), // เกิน 30 วัน
    ];
    const f = dueForecast(states, now, cfg);
    expect(f).toHaveLength(30);
    expect(f[0]).toEqual({ day: '2026-10-12', count: 2 });
    expect(f[1]).toEqual({ day: '2026-10-13', count: 1 });
    expect(f.reduce((s, d) => s + d.count, 0)).toBe(3);
  });

  it('นาทีต่อวันย้อนหลัง', () => {
    const logs = [log({ reviewedAt: at('2026-10-12'), durationMs: 90_000 }), log({ reviewedAt: at('2026-10-12'), durationMs: 30_000 }), log({ reviewedAt: at('2026-10-11') })];
    const m = minutesPerDay(logs, now, cfg, 7);
    expect(m[6]).toEqual({ day: '2026-10-12', minutes: 2, reviews: 2 });
    expect(m[5]).toEqual({ day: '2026-10-11', minutes: 1, reviews: 1 });
  });

  it('streak: นับต่อจากเมื่อวานถ้าวันนี้ยังไม่ทวน และหา longest', () => {
    const logs = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-09', '2026-10-10', '2026-10-11'].map((d) => log({ reviewedAt: at(d) }));
    expect(streak(logs, now, cfg)).toEqual({ current: 3, longest: 3, studiedToday: false });
    expect(streak([...logs, log({ reviewedAt: at('2026-10-12') })], now, cfg)).toEqual({ current: 4, longest: 4, studiedToday: true });
    expect(streak([], now, cfg).current).toBe(0);
  });

  it('ความแม่นแยกกลุ่ม (แย่สุดก่อน) และนับชนิดความผิดพลาด', () => {
    const logs = [
      log({ reviewedAt: at('2026-10-11'), type: 'tell', grade: 1, errorType: 'trap' }),
      log({ reviewedAt: at('2026-10-11'), type: 'tell', grade: 3 }),
      log({ reviewedAt: at('2026-10-11'), type: 'memorize', grade: 3 }),
      log({ reviewedAt: at('2026-10-11'), type: 'memorize', grade: 1, errorType: 'fact' }),
      log({ reviewedAt: at('2026-10-11'), type: 'mcq', grade: 1, errorType: 'fact' }),
    ];
    const byType = accuracyBy(logs, (l) => l.type);
    expect(byType[0]).toMatchObject({ key: 'mcq', acc: { value: 0 } });
    expect(errorTypeCounts(logs)).toEqual([
      { type: 'fact', count: 2 },
      { type: 'rule', count: 0 },
      { type: 'trap', count: 1 },
      { type: 'clue', count: 0 },
    ]);
  });
});
