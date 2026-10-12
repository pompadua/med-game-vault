import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReviewItem } from '../../core/items/types';
import { GRADE_LABEL, type ErrorType, type GradeValue, type ItemState } from '../../core/srs/model';
import { formatInterval, makeScheduler, newStoredCard, previewDue } from '../../core/srs/scheduler';
import type { ReviewSettings } from '../../core/srs/settings';
import { ErrorSheet } from './ErrorSheet';

export interface GradeResult {
  grade: GradeValue;
  durationMs: number;
  errorType?: ErrorType;
  note?: string;
  detail?: Record<string, unknown>;
}

/**
 * item ความจำ: ต้องนึกคำตอบก่อนกดเปิดเฉลย แล้วให้คะแนนตัวเอง Again/Hard/Good/Easy
 * ปุ่มอยู่ล่างจอ ใช้นิ้วเดียวได้ และแสดง interval ถัดไปบนปุ่ม
 */
export function MemoryCard({
  item,
  state,
  settings,
  showIntervals = true,
  onGraded,
}: {
  item: ReviewItem;
  state: ItemState | undefined;
  settings: ReviewSettings;
  showIntervals?: boolean;
  onGraded: (r: GradeResult) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [pendingAgain, setPendingAgain] = useState<number>();
  const shownAt = useRef(performance.now());

  useEffect(() => {
    setRevealed(false);
    setPendingAgain(undefined);
    shownAt.current = performance.now();
  }, [item.id]);

  const intervals = useMemo(() => {
    if (!showIntervals) return undefined;
    const now = new Date();
    const due = previewDue(makeScheduler(settings), state?.card ?? newStoredCard(now), now);
    return Object.fromEntries(([1, 2, 3, 4] as GradeValue[]).map((g) => [g, formatInterval(now, due[g])])) as Record<GradeValue, string>;
  }, [item.id, state, settings, showIntervals]);

  const grade = (g: GradeValue) => {
    const durationMs = performance.now() - shownAt.current;
    if (g === 1) setPendingAgain(durationMs);
    else onGraded({ grade: g, durationMs });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (pendingAgain !== undefined || (e.target as HTMLElement)?.closest('textarea, input')) return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        grade(Number(e.key) as GradeValue);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <div className="flashcard">
        <p className="front">{item.front}</p>
        {revealed && (
          <>
            <hr />
            <p className="back">{item.back}</p>
          </>
        )}
      </div>

      {pendingAgain !== undefined ? (
        <ErrorSheet
          onCancel={() => setPendingAgain(undefined)}
          onSubmit={(errorType, note) => onGraded({ grade: 1, durationMs: pendingAgain, errorType, note })}
        />
      ) : (
        <div className="answer-bar">
          {!revealed ? (
            <button type="button" className="primary big" onClick={() => setRevealed(true)}>
              เปิดเฉลย
            </button>
          ) : (
            <div className="grade-buttons">
              {([1, 2, 3, 4] as GradeValue[]).map((g) => (
                <button key={g} type="button" className={`grade g${g}`} onClick={() => grade(g)}>
                  <span className="grade-label">{GRADE_LABEL[g]}</span>
                  {intervals && <span className="grade-interval">{intervals[g]}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
