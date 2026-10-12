import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type FSRS, type Grade, type StepUnit } from 'ts-fsrs';
import type { ReviewItem } from '../items/types';
import type { GradeValue, ItemState, StoredCard } from './model';
import type { ReviewSettings } from './settings';

/** wrapper บาง ๆ รอบ ts-fsrs 5.x — แปลง card ไป/กลับจากรูปแบบที่เก็บใน IndexedDB */

export function makeScheduler(s: ReviewSettings): FSRS {
  return fsrs(
    generatorParameters({
      request_retention: s.desiredRetention,
      maximum_interval: s.maximumInterval,
      enable_fuzz: s.enableFuzz,
      enable_short_term: true,
      learning_steps: s.learningSteps as StepUnit[],
      relearning_steps: s.relearningSteps as StepUnit[],
    }),
  );
}

export function toStoredCard(card: Card): StoredCard {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

export function fromStoredCard(c: StoredCard): Card {
  return {
    due: new Date(c.due),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review ? new Date(c.last_review) : undefined,
  };
}

export function newStoredCard(now: Date): StoredCard {
  return toStoredCard(createEmptyCard(now));
}

/** retrievability (0–1); item ใหม่ = undefined */
export function retrievability(f: FSRS, card: StoredCard, now: Date): number | undefined {
  if (card.state === 0) return undefined;
  return f.get_retrievability(fromStoredCard(card), now, false);
}

const GRADES: GradeValue[] = [1, 2, 3, 4];

/** due ของแต่ละปุ่ม (สำหรับแสดง interval บนปุ่ม) */
export function previewDue(f: FSRS, card: StoredCard, now: Date): Record<GradeValue, Date> {
  const preview = f.repeat(fromStoredCard(card), now);
  const out = {} as Record<GradeValue, Date>;
  for (const g of GRADES) out[g] = preview[g as Grade].card.due;
  return out;
}

export interface ReviewOutcome {
  state: ItemState;
  elapsedDays: number;
  scheduledDays: number;
  stateBefore: number;
}

/** ใช้ผลการทวนกับ item: คืน state ใหม่ (ไม่แตะ DB) */
export function applyGrade(
  f: FSRS,
  item: Pick<ReviewItem, 'id' | 'packId' | 'contentHash'>,
  prev: ItemState | undefined,
  grade: GradeValue,
  now: Date,
  leechThreshold: number,
): ReviewOutcome {
  const before = prev?.card ?? newStoredCard(now);
  const { card, log } = f.next(fromStoredCard(before), now, grade as Grade);
  const stored = toStoredCard(card);
  return {
    state: {
      id: item.id,
      packId: item.packId,
      card: stored,
      contentHash: item.contentHash,
      suspended: prev?.suspended ?? false,
      buriedUntil: null,
      leech: (prev?.leech ?? false) || stored.lapses >= leechThreshold,
      updatedAt: now.toISOString(),
    },
    elapsedDays: Math.max(0, log.elapsed_days),
    scheduledDays: Math.max(0, card.scheduled_days),
    stateBefore: before.state,
  };
}

export { Rating };

/** ข้อความ interval สั้น ๆ เช่น "10 นาที", "3 วัน", "2.5 เดือน" */
export function formatInterval(from: Date, to: Date): string {
  const minutes = Math.max(1, Math.round((to.getTime() - from.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} นาที`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} ชม.`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)} วัน`;
  if (days < 365) return `${(days / 30).toFixed(days < 60 ? 1 : 0)} เดือน`;
  return `${(days / 365).toFixed(1)} ปี`;
}
