import type { ReviewItem } from '../items/types';
import type { ItemState, ReviewLogEntry } from './model';

export interface Progress {
  total: number;
  newCount: number;
  learning: number;
  review: number;
  due: number;
  suspended: number;
  leeches: number;
  /** retention จริง: สัดส่วนที่ไม่ลืม เมื่อทวน item ที่อยู่ใน state Review (นับเฉพาะที่นับเข้า FSRS) */
  retention: number | undefined;
  retentionN: number;
  /** ความแม่นจากทุก log (รวมฝึกนอกตาราง) */
  accuracy: number | undefined;
  lastReviewedAt: string | undefined;
}

export function computeProgress(items: ReviewItem[], states: Map<string, ItemState>, logs: ReviewLogEntry[], now: Date): Progress {
  const live = items.filter((i) => !i.retired);
  const ids = new Set(live.map((i) => i.id));
  const p: Progress = {
    total: live.length,
    newCount: 0,
    learning: 0,
    review: 0,
    due: 0,
    suspended: 0,
    leeches: 0,
    retention: undefined,
    retentionN: 0,
    accuracy: undefined,
    lastReviewedAt: undefined,
  };
  for (const it of live) {
    const s = states.get(it.id);
    if (!s || s.card.state === 0) {
      p.newCount++;
      continue;
    }
    if (s.suspended) p.suspended++;
    if (s.leech) p.leeches++;
    if (s.card.state === 2) p.review++;
    else p.learning++;
    if (!s.suspended && new Date(s.card.due) <= now) p.due++;
  }
  let recalled = 0;
  let correct = 0;
  let n = 0;
  for (const l of logs) {
    if (!ids.has(l.itemId)) continue;
    n++;
    if (l.grade > 1) correct++;
    if (l.countsToFsrs && l.stateBefore === 2) {
      p.retentionN++;
      if (l.grade > 1) recalled++;
    }
    if (!p.lastReviewedAt || l.reviewedAt > p.lastReviewedAt) p.lastReviewedAt = l.reviewedAt;
  }
  p.retention = p.retentionN ? recalled / p.retentionN : undefined;
  p.accuracy = n ? correct / n : undefined;
  return p;
}
