import { z } from 'zod';

const Step = z.string().regex(/^\d+(\.\d+)?[mhd]$/, 'รูปแบบ step เช่น 1m, 10m, 1h, 1d');

export const ReviewSettings = z.object({
  /** desired retention ของ FSRS */
  desiredRetention: z.number().min(0.7).max(0.99),
  /** IANA time zone สำหรับคำนวณ "วัน" ของระบบทวน */
  timeZone: z.string().min(1),
  /** วันใหม่เริ่มกี่โมง (0–23) */
  dayStartHour: z.number().int().min(0).max(23),
  newPerDay: z.number().int().min(0).max(500),
  /** จำกัด deduction/campaign (ใช้เวลานาน) ต่อวัน */
  longPerDay: z.number().int().min(0).max(50),
  /** ลืมซ้ำ (lapses) ≥ ค่านี้ = leech */
  leechThreshold: z.number().int().min(2).max(50),
  enableFuzz: z.boolean(),
  learningSteps: z.array(Step),
  relearningSteps: z.array(Step),
  maximumInterval: z.number().int().min(1).max(36500),
  /** ถูกครั้งแรก ไม่ใช้ hint และใช้เวลา ≤ fastRatio × targetSeconds → Easy */
  easyTimeRatio: z.number().min(0.1).max(1),
  /** ลึกกว่า optimal ≥ ค่านี้ใน guessWho → Hard */
  guessWhoHardExtraDepth: z.number().int().min(1).max(5),
  /** ความแม่น < ค่านี้ = "จุดอ่อน" */
  weakThreshold: z.number().min(0).max(1),
  /** เตือนสำรองข้อมูลเมื่อไม่ได้ export เกินกี่วัน */
  backupReminderDays: z.number().int().min(1).max(90),
  /** เวลาเฉลี่ยตั้งต้น (วินาที) ของ item ความจำ เมื่อยังไม่มี log */
  defaultMemorySeconds: z.number().int().min(3).max(600),
  updatedAt: z.string(),
});
export type ReviewSettings = z.infer<typeof ReviewSettings>;

export const DEFAULT_SETTINGS: ReviewSettings = {
  desiredRetention: 0.9,
  timeZone: 'Asia/Bangkok',
  dayStartHour: 4,
  newPerDay: 20,
  longPerDay: 2,
  leechThreshold: 6,
  enableFuzz: true,
  learningSteps: ['1m', '10m'],
  relearningSteps: ['10m'],
  maximumInterval: 36500,
  easyTimeRatio: 0.5,
  guessWhoHardExtraDepth: 2,
  weakThreshold: 0.8,
  backupReminderDays: 7,
  defaultMemorySeconds: 20,
  updatedAt: '1970-01-01T00:00:00.000Z',
};

/** ผสมค่าที่เก็บไว้กับค่าเริ่มต้น (เผื่อเพิ่ม setting ใหม่ในอนาคต) */
export function resolveSettings(stored: Partial<ReviewSettings> | undefined): ReviewSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  const parsed = ReviewSettings.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}
