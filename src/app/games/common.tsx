import { useEffect, useRef, useState, type ReactNode } from 'react';
import { gradePuzzle, type GradingConfig } from '../../core/srs/grading';
import { GRADE_LABEL, type GradeValue } from '../../core/srs/model';
import { ErrorSheet } from '../review/ErrorSheet';
import type { GradeResult } from '../review/MemoryCard';

/** นาฬิกาจับเวลา: หยุดเมื่อ stopped = true */
export function useStopwatch(stopped: boolean) {
  const start = useRef(performance.now());
  const [stopAt, setStopAt] = useState<number>();
  const [, force] = useState(0);
  useEffect(() => {
    if (stopped && stopAt === undefined) setStopAt(performance.now());
  }, [stopped, stopAt]);
  useEffect(() => {
    if (stopped) return;
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [stopped]);
  const ms = (stopAt ?? performance.now()) - start.current;
  return { ms, seconds: ms / 1000 };
}

export function Timer({ seconds, target }: { seconds: number; target: number }) {
  const over = seconds > target;
  return (
    <span className={over ? 'timer over' : 'timer'} aria-label="เวลา">
      ⏱ {Math.floor(seconds)} / {target} วิ
    </span>
  );
}

export function HintButton({ hint, used, onUse }: { hint?: string; used: boolean; onUse: () => void }) {
  if (!hint) return null;
  return used ? (
    <p className="hint">💡 {hint}</p>
  ) : (
    <button type="button" className="link-button" onClick={onUse}>
      ขอ hint (ได้ไม่เกิน Hard)
    </button>
  );
}

export interface PlayContext {
  grading: GradingConfig;
  /** ฝึกนอกตาราง = แสดงผลอัตโนมัติ แต่ไม่ได้นับเข้า FSRS */
  practice?: boolean;
  onGraded: (r: GradeResult) => void;
}

/** ส่วนท้ายหลังจบเกม: บอกผลอัตโนมัติ และถ้า Again ต้องเลือกชนิดความผิดพลาดก่อนไปต่อ */
export function GradeFooter({ grade, durationMs, detail, ctx }: { grade: GradeValue; durationMs: number; detail: Record<string, unknown>; ctx: PlayContext }) {
  const [askError, setAskError] = useState(false);
  if (askError) {
    return <ErrorSheet onSubmit={(errorType, note) => ctx.onGraded({ grade, durationMs, errorType, note, detail })} />;
  }
  return (
    <div className="answer-bar">
      <div className="grade-result">
        <span className={`grade-pill g${grade}`}>ผล: {GRADE_LABEL[grade]}</span>
        <button type="button" className="primary" onClick={() => (grade === 1 ? setAskError(true) : ctx.onGraded({ grade, durationMs, detail }))}>
          {grade === 1 ? 'บันทึกความผิดพลาด' : 'ต่อไป'}
        </button>
      </div>
    </div>
  );
}

export function SubmitBar({ disabled, label = 'ส่งคำตอบ', onSubmit, extra }: { disabled?: boolean; label?: string; onSubmit: () => void; extra?: ReactNode }) {
  return (
    <div className="answer-bar">
      <div className="submit-row">
        {extra}
        <button type="button" className="primary big" disabled={disabled} onClick={onSubmit}>
          {label}
        </button>
      </div>
    </div>
  );
}

export function Analysis({ title = 'Post-game analysis', children }: { title?: string; children: ReactNode }) {
  return (
    <section className="panel analysis">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function puzzleGrade(
  ctx: PlayContext,
  a: { correct: boolean; attempts: number; hintUsed: boolean; seconds: number; target: number },
): GradeValue {
  return gradePuzzle({ correct: a.correct, attempts: a.attempts, hintUsed: a.hintUsed, elapsedSeconds: a.seconds, targetSeconds: a.target }, ctx.grading);
}
