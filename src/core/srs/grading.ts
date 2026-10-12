import type { GradeValue } from './model';

/**
 * การให้คะแนนอัตโนมัติของ item ปริศนา — ค่าเริ่มต้นตามสเปก ปรับได้ใน settings
 * 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
 */

export interface PuzzleAttempt {
  correct: boolean;
  /** จำนวนครั้งที่ตอบ (ตอบถูกครั้งแรก = 1) */
  attempts: number;
  hintUsed: boolean;
  elapsedSeconds: number;
  targetSeconds: number;
}

export interface GradingConfig {
  /** Easy ต้องใช้เวลา ≤ easyTimeRatio × targetSeconds */
  easyTimeRatio: number;
  /** guessWho: ลึกกว่า optimal ≥ ค่านี้ → Hard */
  guessWhoHardExtraDepth: number;
}

export const DEFAULT_GRADING: GradingConfig = { easyTimeRatio: 0.5, guessWhoHardExtraDepth: 2 };

/**
 * - ผิด → Again
 * - ถูก แต่ใช้ hint หรือเกิน targetSeconds หรือตอบ > 1 ครั้ง → Hard
 * - ถูกครั้งแรก ไม่ใช้ hint และ ≤ easyTimeRatio × target → Easy
 * - ถูกภายใน targetSeconds → Good
 */
export function gradePuzzle(a: PuzzleAttempt, cfg: GradingConfig = DEFAULT_GRADING): GradeValue {
  if (!a.correct) return 1;
  if (a.hintUsed || a.attempts > 1 || a.elapsedSeconds > a.targetSeconds) return 2;
  if (a.elapsedSeconds <= cfg.easyTimeRatio * a.targetSeconds) return 4;
  return 3;
}

export interface DeductionAttempt {
  diagnosisCorrect: boolean;
  nextStepCorrect: boolean;
  pointsSpent: number;
  budget: number;
  /** แต้มของ optimalLine */
  optimalPoints: number;
}

/** วินิจฉัยหรือ next step ผิด → Again / ถูกแต่เกินงบ → Hard / ใช้แต้ม ≤ optimal → Easy / ภายในงบ → Good */
export function gradeDeduction(a: DeductionAttempt): GradeValue {
  if (!a.diagnosisCorrect || !a.nextStepCorrect) return 1;
  if (a.pointsSpent > a.budget) return 2;
  if (a.pointsSpent <= a.optimalPoints) return 4;
  return 3;
}

export interface GuessWhoAttempt {
  /** tree แยกโรคได้ครบทุกตัวหรือไม่ */
  separatesAll: boolean;
  depth: number;
  optimalDepth: number;
}

/** แยกไม่ครบ → Again / ลึกกว่า optimal ≥ 2 → Hard / ลึกกว่า 1 → Good / เท่า optimal → Easy */
export function gradeGuessWho(a: GuessWhoAttempt, cfg: GradingConfig = DEFAULT_GRADING): GradeValue {
  if (!a.separatesAll) return 1;
  const extra = a.depth - a.optimalDepth;
  if (extra >= cfg.guessWhoHardExtraDepth) return 2;
  if (extra >= 1) return 3;
  return 4;
}
