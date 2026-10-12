import { describe, expect, it } from 'vitest';
import type { ItemType, ReviewItem } from '../src/core/items/types';
import type { ItemState, ReviewLogEntry } from '../src/core/srs/model';
import { buildQueue, interleave, type QueueInput } from '../src/core/srs/queue';
import { makeScheduler, newStoredCard } from '../src/core/srs/scheduler';
import { DEFAULT_SETTINGS } from '../src/core/srs/settings';

const settings = { ...DEFAULT_SETTINGS, enableFuzz: false };
const scheduler = makeScheduler(settings);
const now = new Date('2026-10-12T05:00:00Z'); // 12:00 BKK

function item(packId: string, el: string, opts: Partial<ReviewItem> = {}): ReviewItem {
  const type: ItemType = opts.type ?? 'memorize';
  return {
    id: `${packId}:${type}:${el}`,
    packId,
    type,
    elementId: el,
    kind: 'memory',
    siblingKey: `${packId}:solo:${el}`,
    contentHash: 'h',
    retired: false,
    long: false,
    front: 'f',
    back: 'b',
    ...opts,
  };
}

/** state ของ review card ที่ครบกำหนดแล้ว: stability ต่ำ = R ต่ำ */
function dueState(it: ReviewItem, stability: number, daysAgo: number): ItemState {
  const last = new Date(now.getTime() - daysAgo * 86_400_000);
  return {
    id: it.id,
    packId: it.packId,
    card: {
      ...newStoredCard(last),
      state: 2,
      stability,
      difficulty: 5,
      reps: 3,
      scheduled_days: 1,
      last_review: last.toISOString(),
      due: new Date(now.getTime() - 60_000).toISOString(),
    },
    contentHash: 'h',
    suspended: false,
    buriedUntil: null,
    leech: false,
    updatedAt: last.toISOString(),
  };
}

function input(items: ReviewItem[], states: ItemState[], extra: Partial<QueueInput> = {}): QueueInput {
  return {
    items,
    states: new Map(states.map((s) => [s.id, s])),
    enabledPacks: new Set(items.map((i) => i.packId)),
    todayLogs: [],
    now,
    settings,
    scheduler,
    ...extra,
  };
}

function log(it: ReviewItem, at: Date, stateBefore = 2): ReviewLogEntry {
  return {
    id: `${it.id}@${at.toISOString()}`,
    itemId: it.id,
    packId: it.packId,
    type: it.type,
    reviewedAt: at.toISOString(),
    grade: 3,
    durationMs: 10_000,
    errorType: null,
    note: null,
    session: 'scheduled',
    countsToFsrs: true,
    stateBefore,
    elapsedDays: 1,
    scheduledDays: 1,
    contentHash: 'h',
    detail: null,
  };
}

describe('interleave', () => {
  it('ไม่ให้ pack เดียวกันติดกันถ้าเลี่ยงได้ และคงลำดับความสำคัญ', () => {
    const out = interleave(['a1', 'a2', 'a3', 'b1', 'c1'], (x) => x[0]!);
    expect(out).toEqual(['a1', 'b1', 'a2', 'c1', 'a3']);
    for (let i = 1; i < out.length; i++) expect(out[i]![0]).not.toBe(out[i - 1]![0]);
  });
  it('ถ้าเหลือ pack เดียว ยอมให้ติดกัน', () => {
    expect(interleave(['a1', 'a2', 'b1'], (x) => x[0]!)).toEqual(['a1', 'b1', 'a2']);
    expect(interleave(['a1', 'a2'], (x) => x[0]!)).toEqual(['a1', 'a2']);
  });
});

describe('buildQueue', () => {
  it('เรียง retrievability ต่ำก่อน', () => {
    const a = item('p', 'a');
    const b = item('p', 'b');
    const c = item('p', 'c');
    // stability ต่ำ + ห่างนาน = R ต่ำ
    const res = buildQueue(input([a, b, c], [dueState(a, 10, 3), dueState(b, 1, 10), dueState(c, 3, 5)]));
    expect(res.queue.map((e) => e.item.id)).toEqual([b.id, c.id, a.id]);
    const rs = res.queue.map((e) => e.r!);
    expect(rs[0]).toBeLessThan(rs[1]!);
    expect(rs[1]).toBeLessThan(rs[2]!);
  });

  it('interleave ข้าม pack', () => {
    const items = [item('p', 'a'), item('p', 'b'), item('q', 'c'), item('q', 'd')];
    const states = [dueState(items[0]!, 1, 10), dueState(items[1]!, 1.1, 10), dueState(items[2]!, 5, 10), dueState(items[3]!, 6, 10)];
    const packs = buildQueue(input(items, states)).queue.map((e) => e.item.packId);
    expect(packs).toEqual(['p', 'q', 'p', 'q']);
  });

  it('pack ที่พักไว้ / item ที่ suspend / bury / retired ไม่เข้าคิว', () => {
    const a = item('p', 'a');
    const b = item('p', 'b');
    const c = item('p', 'c');
    const d = item('q', 'd');
    const e = item('p', 'e', { retired: true });
    const states = [
      { ...dueState(a, 1, 5), suspended: true },
      { ...dueState(b, 1, 5), buriedUntil: new Date(now.getTime() + 3_600_000).toISOString() },
      dueState(c, 1, 5),
      dueState(d, 1, 5),
      dueState(e, 1, 5),
    ];
    const res = buildQueue(input([a, b, c, d, e], states, { enabledPacks: new Set(['p']) }));
    expect(res.queue.map((x) => x.item.id)).toEqual([c.id]);
  });

  it('bury ที่หมดเวลาแล้ว กลับเข้าคิว', () => {
    const a = item('p', 'a');
    const res = buildQueue(input([a], [{ ...dueState(a, 1, 5), buriedUntil: new Date(now.getTime() - 1).toISOString() }]));
    expect(res.queue).toHaveLength(1);
  });

  it('sibling: item จากการ์ดเดียวกันออกได้วันละ 1 ตัว ที่เหลือเลื่อนไปพรุ่งนี้', () => {
    const sib = 'p:card:hfref';
    const a = item('p', 'a', { siblingKey: sib });
    const b = item('p', 'b', { siblingKey: sib });
    const c = item('p', 'c');
    const res = buildQueue(input([a, b, c], [dueState(a, 1, 5), dueState(b, 2, 5), dueState(c, 3, 5)]));
    expect(res.queue.map((e) => e.item.id)).toEqual([a.id, c.id]);
    expect(res.siblingDeferred).toBe(1);
  });

  it('sibling: ถ้าวันนี้ทวน sibling ไปแล้ว ตัวอื่นไม่ออก แต่ตัวเดิม (learning step) ออกซ้ำได้', () => {
    const sib = 'p:card:x';
    const a = item('p', 'a', { siblingKey: sib });
    const b = item('p', 'b', { siblingKey: sib });
    const todayLogs = [log(a, new Date(now.getTime() - 3_600_000))];
    const res = buildQueue(input([a, b], [dueState(a, 1, 1), dueState(b, 1, 5)], { todayLogs }));
    expect(res.queue.map((e) => e.item.id)).toEqual([a.id]);
  });

  it('sibling: log ของเมื่อวาน (ก่อน 04:00 BKK) ไม่นับ', () => {
    const sib = 'p:card:x';
    const a = item('p', 'a', { siblingKey: sib });
    const b = item('p', 'b', { siblingKey: sib });
    // 2026-10-12 03:00 BKK = 2026-10-11T20:00Z → ยังเป็นวันทวน 11
    const todayLogs = [log(a, new Date('2026-10-11T20:00:00Z'))];
    const res = buildQueue(input([a, b], [dueState(b, 1, 5)], { todayLogs }));
    expect(res.queue.map((e) => e.item.id)).toContain(b.id);
  });

  it('จำกัด item ใหม่ต่อวัน (หักที่ทำไปแล้ววันนี้)', () => {
    const fresh = Array.from({ length: 10 }, (_, i) => item('p', `n${i}`));
    const todayLogs = [log(item('p', 'old'), new Date(now.getTime() - 60_000), 0)];
    const res = buildQueue(input(fresh, [], { settings: { ...settings, newPerDay: 4 }, todayLogs }));
    expect(res.newCount).toBe(3);
  });

  it('item ใหม่: กฎมาก่อนการ์ด และ review มาก่อน item ใหม่ใน pack เดียว', () => {
    const m = item('p', 'm', { type: 'memorize' });
    const r = item('p', 'r', { type: 'rule' });
    const due = item('p', 'd');
    const res = buildQueue(input([m, r, due], [dueState(due, 1, 5)]));
    expect(res.queue.map((e) => e.item.id)).toEqual([due.id, r.id, m.id]);
  });

  it('จำกัด deduction/campaign ต่อวัน', () => {
    const longs = Array.from({ length: 4 }, (_, i) => item('p', `l${i}`, { type: 'deduction', kind: 'puzzle', long: true, targetSeconds: 300 }));
    const res = buildQueue(input(longs, longs.map((l) => dueState(l, 1, 5)), { settings: { ...settings, longPerDay: 2 } }));
    expect(res.queue).toHaveLength(2);
  });

  it('allowedTypes กรองชนิดที่ยังเล่นไม่ได้', () => {
    const a = item('p', 'a');
    const b = item('p', 'b', { type: 'mcq', kind: 'puzzle', targetSeconds: 60 });
    const res = buildQueue(input([a, b], [dueState(a, 1, 5), dueState(b, 1, 5)], { allowedTypes: new Set<ItemType>(['memorize']) }));
    expect(res.queue.map((e) => e.item.id)).toEqual([a.id]);
  });

  it('งบเวลา: ตัดคิวตามเวลาประมาณ', () => {
    const items = Array.from({ length: 10 }, (_, i) => item('p', `t${i}`));
    const res = buildQueue(
      input(items, items.map((it, i) => dueState(it, 1 + i, 5)), {
        timeBudgetMinutes: 1,
        avgSecondsByType: new Map([['memorize', 15]]),
      }),
    );
    expect(res.queue).toHaveLength(4);
    expect(res.overBudget).toBe(6);
    expect(res.estimatedSeconds).toBe(60);
  });

  it('learning step ที่ครบภายหลังวันนี้ไปอยู่ laterToday', () => {
    const a = item('p', 'a');
    const st = dueState(a, 1, 0);
    st.card.state = 1;
    st.card.due = new Date(now.getTime() + 10 * 60_000).toISOString();
    const res = buildQueue(input([a], [st]));
    expect(res.queue).toHaveLength(0);
    expect(res.laterToday.map((e) => e.item.id)).toEqual([a.id]);
  });
});
