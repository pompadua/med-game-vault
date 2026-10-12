import type { ItemType, ReviewItem } from '../items/types';
import type { ItemState, ReviewLogEntry } from './model';

/** RNG แบบ seed ได้ (mulberry32) — ผลสุ่มซ้ำได้เมื่อ seed เดิม */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: T[], rand: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** ความแม่นราย item จาก log */
export function itemAccuracy(logs: ReviewLogEntry[]): Map<string, { correct: number; n: number }> {
  const m = new Map<string, { correct: number; n: number }>();
  for (const l of logs) {
    const cur = m.get(l.itemId) ?? { correct: 0, n: 0 };
    cur.n++;
    if (l.grade > 1) cur.correct++;
    m.set(l.itemId, cur);
  }
  return m;
}

export interface PracticeOptions {
  packIds?: Set<string>;
  types?: Set<ItemType>;
  /** เฉพาะจุดอ่อน: ความแม่น < weakBelow หรือ leech */
  weakBelow?: number;
  count: number;
  seed: number;
}

/**
 * เลือก item สำหรับฝึกนอกตาราง / boss round (ไม่แตะตาราง FSRS)
 * - โหมดจุดอ่อน: เรียงความแม่นต่ำก่อน
 * - ปกติ: สุ่มแบบ seed แล้วสลับหัวข้อไม่ให้ pack เดียวติดกัน
 */
export function pickPracticeItems(items: ReviewItem[], states: Map<string, ItemState>, logs: ReviewLogEntry[], o: PracticeOptions): ReviewItem[] {
  let pool = items.filter((i) => !i.retired && (!o.packIds || o.packIds.has(i.packId)) && (!o.types || o.types.has(i.type)));
  const rand = seededRandom(o.seed);
  if (o.weakBelow !== undefined) {
    const acc = itemAccuracy(logs);
    const score = (i: ReviewItem) => {
      const a = acc.get(i.id);
      return a ? a.correct / a.n : 1;
    };
    pool = pool.filter((i) => states.get(i.id)?.leech || score(i) < o.weakBelow!);
    return shuffle(pool, rand)
      .sort((a, b) => score(a) - score(b))
      .slice(0, o.count);
  }
  const picked = shuffle(pool, rand).slice(0, o.count);
  // สลับหัวข้อ
  const out: ReviewItem[] = [];
  const rest = [...picked];
  let last: string | undefined;
  while (rest.length) {
    let idx = rest.findIndex((x) => x.packId !== last);
    if (idx === -1) idx = 0;
    const [x] = rest.splice(idx, 1);
    out.push(x!);
    last = x!.packId;
  }
  return out;
}
