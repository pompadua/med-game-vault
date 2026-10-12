import { z } from 'zod';
import { ReviewSettings } from './settings';

/** ชนิดความผิดพลาดเมื่อตอบผิด */
export const ERROR_TYPES = ['fact', 'rule', 'trap', 'clue'] as const;
export const ErrorType = z.enum(ERROR_TYPES);
export type ErrorType = z.infer<typeof ErrorType>;
export const ERROR_TYPE_LABEL: Record<ErrorType, string> = {
  fact: 'ไม่รู้ข้อเท็จจริง',
  rule: 'ใช้กฎผิด',
  trap: 'ติดกับดัก',
  clue: 'อ่าน clue พลาด',
};

/** 1 = Again, 2 = Hard, 3 = Good, 4 = Easy (ตรงกับ Rating ของ ts-fsrs) */
export const GradeValue = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export type GradeValue = z.infer<typeof GradeValue>;
export const GRADE_LABEL: Record<GradeValue, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };

/** FSRS card แบบ serialize ได้ (วันที่เป็น ISO string) */
export const StoredCard = z.object({
  due: z.string(),
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number(),
  scheduled_days: z.number(),
  learning_steps: z.number(),
  reps: z.number(),
  lapses: z.number(),
  /** 0 New, 1 Learning, 2 Review, 3 Relearning */
  state: z.number().int().min(0).max(3),
  last_review: z.string().nullable(),
});
export type StoredCard = z.infer<typeof StoredCard>;

export const ItemState = z.object({
  /** review item id */
  id: z.string(),
  packId: z.string(),
  card: StoredCard,
  /** contentHash ตอนทวนล่าสุด — ถ้าไม่ตรงกับ item ปัจจุบัน = "เนื้อหาอัปเดต" */
  contentHash: z.string(),
  suspended: z.boolean(),
  /** ISO — ซ่อนจากคิวจนถึงเวลานี้ (bury) */
  buriedUntil: z.string().nullable(),
  leech: z.boolean(),
  updatedAt: z.string(),
});
export type ItemState = z.infer<typeof ItemState>;

export const SessionKind = z.enum(['scheduled', 'practice', 'boss']);
export type SessionKind = z.infer<typeof SessionKind>;

/** review log แบบ append-only */
export const ReviewLogEntry = z.object({
  /** `${itemId}@${reviewedAt}` */
  id: z.string(),
  itemId: z.string(),
  packId: z.string(),
  type: z.string(),
  reviewedAt: z.string(),
  grade: GradeValue,
  durationMs: z.number().int().min(0),
  errorType: ErrorType.nullable(),
  note: z.string().nullable(),
  session: SessionKind,
  /** false = ฝึกนอกตาราง/boss ที่ไม่นับเข้า FSRS */
  countsToFsrs: z.boolean(),
  /** state ของ card ก่อนทวน (0–3) — ใช้คำนวณ retention จริงและ optimize FSRS */
  stateBefore: z.number().int().min(0).max(3),
  /** วันที่ผ่านไปตั้งแต่ทวนครั้งก่อน */
  elapsedDays: z.number().min(0),
  scheduledDays: z.number().min(0),
  contentHash: z.string(),
  /** รายละเอียดเพิ่มเติมของเกม (เช่น จำนวนครั้งที่ตอบ, ใช้ hint) */
  detail: z.record(z.string(), z.unknown()).nullable(),
});
export type ReviewLogEntry = z.infer<typeof ReviewLogEntry>;

export const ContentFlag = z.object({
  id: z.string(),
  itemId: z.string(),
  packId: z.string(),
  note: z.string(),
  createdAt: z.string(),
  resolved: z.boolean(),
});
export type ContentFlag = z.infer<typeof ContentFlag>;

export const PackPrefRecord = z.object({
  packId: z.string(),
  enabled: z.boolean(),
  updatedAt: z.string(),
});
export type PackPrefRecord = z.infer<typeof PackPrefRecord>;

export const EXPORT_SCHEMA_VERSION = 1 as const;

export const ExportFile = z.object({
  kind: z.literal('med-game-vault-backup'),
  schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
  exportedAt: z.string(),
  settings: ReviewSettings,
  packPrefs: z.array(PackPrefRecord),
  itemStates: z.array(ItemState),
  reviewLogs: z.array(ReviewLogEntry),
  contentFlags: z.array(ContentFlag),
});
export type ExportFile = z.infer<typeof ExportFile>;
