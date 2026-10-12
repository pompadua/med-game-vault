import { describe, expect, it } from 'vitest';
import { applyGrade, formatInterval, makeScheduler, previewDue, retrievability } from '../src/core/srs/scheduler';
import { DEFAULT_SETTINGS } from '../src/core/srs/settings';

const settings = { ...DEFAULT_SETTINGS, enableFuzz: false };
const f = makeScheduler(settings);
const item = { id: 'p:memorize:x', packId: 'p', contentHash: 'h1' };
const t0 = new Date('2026-10-12T02:00:00Z');

describe('scheduler (ts-fsrs wrapper)', () => {
  it('item ใหม่ → Good ครั้งแรกเข้า learning step, ไม่ใช่ review ทันที', () => {
    const { state, stateBefore } = applyGrade(f, item, undefined, 3, t0, 6);
    expect(stateBefore).toBe(0);
    expect(state.card.state).toBe(1);
    expect(state.card.reps).toBe(1);
    expect(new Date(state.card.due).getTime()).toBeGreaterThan(t0.getTime());
    expect(state.contentHash).toBe('h1');
  });

  it('Easy ไปไกลกว่า Good ไกลกว่า Hard ไกลกว่า Again', () => {
    const { state } = applyGrade(f, item, undefined, 3, t0, 6);
    const t1 = new Date(state.card.due);
    const due = previewDue(f, state.card, t1);
    expect(due[4].getTime()).toBeGreaterThan(due[3].getTime());
    expect(due[3].getTime()).toBeGreaterThan(due[2].getTime());
    expect(due[2].getTime()).toBeGreaterThan(due[1].getTime());
  });

  it('ไม่มี fuzz → ผลคงที่ (deterministic)', () => {
    const a = applyGrade(f, item, undefined, 4, t0, 6).state;
    const b = applyGrade(f, item, undefined, 4, t0, 6).state;
    expect(a.card).toEqual(b.card);
  });

  it('retrievability: ใหม่ = undefined, หลังทวน ลดลงตามเวลา', () => {
    let { state } = applyGrade(f, item, undefined, 4, t0, 6);
    expect(retrievability(f, { ...state.card, state: 0 }, t0)).toBeUndefined();
    const r1 = retrievability(f, state.card, new Date(t0.getTime() + 86_400_000))!;
    const r10 = retrievability(f, state.card, new Date(t0.getTime() + 10 * 86_400_000))!;
    expect(r1).toBeGreaterThan(r10);
    expect(r1).toBeLessThanOrEqual(1);
  });

  it('ลืมซ้ำ (lapses) ถึง threshold → leech', () => {
    let now = t0;
    let st = applyGrade(f, item, undefined, 4, now, 3).state;
    for (let i = 0; i < 3; i++) {
      // ไปให้ถึง Review state ก่อน แล้วค่อยลืม
      while (st.card.state !== 2) {
        now = new Date(st.card.due);
        st = applyGrade(f, item, st, 3, now, 3).state;
      }
      now = new Date(st.card.due);
      st = applyGrade(f, item, st, 1, now, 3).state;
    }
    expect(st.card.lapses).toBe(3);
    expect(st.leech).toBe(true);
  });

  it('desired retention สูงขึ้น → interval สั้นลง', () => {
    const lo = makeScheduler({ ...settings, desiredRetention: 0.8 });
    const hi = makeScheduler({ ...settings, desiredRetention: 0.95 });
    let a = applyGrade(lo, item, undefined, 3, t0, 6).state;
    let b = applyGrade(hi, item, undefined, 3, t0, 6).state;
    a = applyGrade(lo, item, a, 3, new Date(a.card.due), 6).state;
    b = applyGrade(hi, item, b, 3, new Date(b.card.due), 6).state;
    a = applyGrade(lo, item, a, 3, new Date(a.card.due), 6).state;
    b = applyGrade(hi, item, b, 3, new Date(b.card.due), 6).state;
    expect(a.card.scheduled_days).toBeGreaterThan(b.card.scheduled_days);
  });

  it('formatInterval', () => {
    const t = new Date('2026-01-01T00:00:00Z');
    expect(formatInterval(t, new Date(t.getTime() + 10 * 60_000))).toBe('10 นาที');
    expect(formatInterval(t, new Date(t.getTime() + 3 * 86_400_000))).toBe('3 วัน');
  });
});
