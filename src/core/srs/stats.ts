import type { ItemType, ReviewItem } from '../items/types';
import { addDaysToKey, daysBetweenKeys, studyDayKey, type DayConfig } from './day';
import type { ErrorType, ItemState, ReviewLogEntry } from './model';

/** สถิติทั้งหมดคำนวณจาก log/state จริง — ไม่มีการประมาณหรือปั้นตัวเลข */

export interface Ratio {
  correct: number;
  n: number;
  /** undefined เมื่อยังไม่มีข้อมูล */
  value: number | undefined;
}

const ratio = (correct: number, n: number): Ratio => ({ correct, n, value: n ? correct / n : undefined });

/** retention จริง: ทวน item ที่อยู่ใน state Review (ตามตาราง FSRS) แล้วจำได้ (grade > 1) */
export function trueRetention(logs: ReviewLogEntry[], sinceKey?: string, cfg?: DayConfig): Ratio {
  let correct = 0;
  let n = 0;
  for (const l of logs) {
    if (!l.countsToFsrs || l.stateBefore !== 2) continue;
    if (sinceKey && cfg && studyDayKey(new Date(l.reviewedAt), cfg) < sinceKey) continue;
    n++;
    if (l.grade > 1) correct++;
  }
  return ratio(correct, n);
}

/** จำนวน item ที่ครบกำหนดในแต่ละวันข้างหน้า (วันแรก = วันนี้ รวม item ที่ค้าง) */
export function dueForecast(states: ItemState[], now: Date, cfg: DayConfig, days = 30, include?: (s: ItemState) => boolean): { day: string; count: number }[] {
  const today = studyDayKey(now, cfg);
  const counts = Array.from({ length: days }, (_, i) => ({ day: addDaysToKey(today, i), count: 0 }));
  for (const s of states) {
    if (s.suspended || s.card.state === 0) continue;
    if (include && !include(s)) continue;
    const offset = Math.max(0, daysBetweenKeys(today, studyDayKey(new Date(s.card.due), cfg)));
    if (offset < days) counts[offset]!.count++;
  }
  return counts;
}

/** นาทีที่ใช้ทวนต่อวัน (ย้อนหลัง days วัน รวมวันนี้) */
export function minutesPerDay(logs: ReviewLogEntry[], now: Date, cfg: DayConfig, days = 30): { day: string; minutes: number; reviews: number }[] {
  const today = studyDayKey(now, cfg);
  const start = addDaysToKey(today, -(days - 1));
  const out = Array.from({ length: days }, (_, i) => ({ day: addDaysToKey(start, i), minutes: 0, reviews: 0 }));
  for (const l of logs) {
    const idx = daysBetweenKeys(start, studyDayKey(new Date(l.reviewedAt), cfg));
    if (idx < 0 || idx >= days) continue;
    out[idx]!.minutes += l.durationMs / 60_000;
    out[idx]!.reviews++;
  }
  return out.map((d) => ({ ...d, minutes: Math.round(d.minutes * 10) / 10 }));
}

/** streak: จำนวนวันติดกันที่มีการทวน นับย้อนจากวันนี้ (ถ้าวันนี้ยังไม่ทวน เริ่มนับจากเมื่อวาน) */
export function streak(logs: ReviewLogEntry[], now: Date, cfg: DayConfig): { current: number; longest: number; studiedToday: boolean } {
  const days = new Set(logs.map((l) => studyDayKey(new Date(l.reviewedAt), cfg)));
  const today = studyDayKey(now, cfg);
  const studiedToday = days.has(today);
  let current = 0;
  let cursor = studiedToday ? today : addDaysToKey(today, -1);
  while (days.has(cursor)) {
    current++;
    cursor = addDaysToKey(cursor, -1);
  }
  let longest = 0;
  const sorted = [...days].sort();
  let run = 0;
  let prev: string | undefined;
  for (const d of sorted) {
    run = prev && daysBetweenKeys(prev, d) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest, studiedToday };
}

/** ความแม่น (grade > 1) แยกตาม key */
export function accuracyBy(logs: ReviewLogEntry[], key: (l: ReviewLogEntry) => string): { key: string; acc: Ratio }[] {
  const m = new Map<string, { c: number; n: number }>();
  for (const l of logs) {
    const k = key(l);
    const cur = m.get(k) ?? { c: 0, n: 0 };
    cur.n++;
    if (l.grade > 1) cur.c++;
    m.set(k, cur);
  }
  return [...m]
    .map(([k, v]) => ({ key: k, acc: ratio(v.c, v.n) }))
    .sort((a, b) => (a.acc.value ?? 0) - (b.acc.value ?? 0) || (a.key < b.key ? -1 : 1));
}

/** จำนวนความผิดพลาดแยกตามชนิด (เฉพาะ log ที่ตอบผิด) */
export function errorTypeCounts(logs: ReviewLogEntry[]): { type: ErrorType | 'unspecified'; count: number }[] {
  const types: (ErrorType | 'unspecified')[] = ['fact', 'rule', 'trap', 'clue', 'unspecified'];
  const counts = new Map(types.map((t) => [t, 0]));
  for (const l of logs) {
    if (l.grade !== 1) continue;
    const t = l.errorType ?? 'unspecified';
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return types.map((t) => ({ type: t, count: counts.get(t)! })).filter((x) => x.type !== 'unspecified' || x.count > 0);
}

export function leechList(states: ItemState[], items: Map<string, ReviewItem>): { id: string; lapses: number; item: ReviewItem | undefined }[] {
  return states
    .filter((s) => s.leech)
    .map((s) => ({ id: s.id, lapses: s.card.lapses, item: items.get(s.id) }))
    .sort((a, b) => b.lapses - a.lapses);
}

export function itemTypeOf(l: ReviewLogEntry): ItemType {
  return l.type as ItemType;
}
