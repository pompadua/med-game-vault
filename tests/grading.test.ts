import { describe, expect, it } from 'vitest';
import { gradeDeduction, gradeGuessWho, gradePuzzle } from '../src/core/srs/grading';

const base = { correct: true, attempts: 1, hintUsed: false, elapsedSeconds: 30, targetSeconds: 60 };

describe('gradePuzzle', () => {
  it('ผิด → Again (แม้เร็วและไม่ใช้ hint)', () => {
    expect(gradePuzzle({ ...base, correct: false, elapsedSeconds: 1 })).toBe(1);
  });
  it('ถูกแต่ใช้ hint → Hard', () => {
    expect(gradePuzzle({ ...base, hintUsed: true, elapsedSeconds: 5 })).toBe(2);
  });
  it('ถูกแต่เกิน targetSeconds → Hard', () => {
    expect(gradePuzzle({ ...base, elapsedSeconds: 61 })).toBe(2);
  });
  it('ถูกแต่ตอบมากกว่า 1 ครั้ง → Hard', () => {
    expect(gradePuzzle({ ...base, attempts: 2, elapsedSeconds: 5 })).toBe(2);
  });
  it('ถูกครั้งแรก ไม่ใช้ hint ≤ 50% ของเวลา → Easy (ขอบพอดี 50%)', () => {
    expect(gradePuzzle({ ...base, elapsedSeconds: 30 })).toBe(4);
  });
  it('ถูกภายในเวลาแต่เกิน 50% → Good (ขอบพอดี target)', () => {
    expect(gradePuzzle({ ...base, elapsedSeconds: 31 })).toBe(3);
    expect(gradePuzzle({ ...base, elapsedSeconds: 60 })).toBe(3);
  });
  it('ปรับสัดส่วน Easy ได้', () => {
    expect(gradePuzzle({ ...base, elapsedSeconds: 40 }, { easyTimeRatio: 0.75, guessWhoHardExtraDepth: 2 })).toBe(4);
  });
});

describe('gradeDeduction', () => {
  const d = { diagnosisCorrect: true, nextStepCorrect: true, pointsSpent: 8, budget: 10, optimalPoints: 6 };
  it('วินิจฉัยผิด → Again', () => expect(gradeDeduction({ ...d, diagnosisCorrect: false })).toBe(1));
  it('next step ผิด → Again', () => expect(gradeDeduction({ ...d, nextStepCorrect: false })).toBe(1));
  it('ถูกแต่เกินงบ → Hard', () => expect(gradeDeduction({ ...d, pointsSpent: 11 })).toBe(2));
  it('ภายในงบ → Good (ขอบพอดีงบ)', () => {
    expect(gradeDeduction(d)).toBe(3);
    expect(gradeDeduction({ ...d, pointsSpent: 10 })).toBe(3);
  });
  it('ใช้แต้ม ≤ optimalLine → Easy', () => {
    expect(gradeDeduction({ ...d, pointsSpent: 6 })).toBe(4);
    expect(gradeDeduction({ ...d, pointsSpent: 4 })).toBe(4);
  });
});

describe('gradeGuessWho', () => {
  it('แยกไม่ครบ → Again', () => expect(gradeGuessWho({ separatesAll: false, depth: 2, optimalDepth: 2 })).toBe(1));
  it('ลึกกว่า optimal ≥ 2 ชั้น → Hard', () => {
    expect(gradeGuessWho({ separatesAll: true, depth: 4, optimalDepth: 2 })).toBe(2);
    expect(gradeGuessWho({ separatesAll: true, depth: 5, optimalDepth: 2 })).toBe(2);
  });
  it('ลึกกว่า 1 ชั้น → Good', () => expect(gradeGuessWho({ separatesAll: true, depth: 3, optimalDepth: 2 })).toBe(3));
  it('เท่า optimal → Easy', () => expect(gradeGuessWho({ separatesAll: true, depth: 2, optimalDepth: 2 })).toBe(4));
});
