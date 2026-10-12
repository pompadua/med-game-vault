import { useState } from 'react';
import { MAX_CHOICE_ATTEMPTS, scoreChoice } from '../../core/games/score';
import type { Legality, Mcq, Pack, Speedrun } from '../../core/schema/pack';
import { Analysis, GradeFooter, HintButton, puzzleGrade, Timer, useStopwatch, type PlayContext } from './common';

function ruleText(pack: Pack, id: string) {
  const idx = pack.rulebook.coreRules.findIndex((r) => r.id === id);
  return idx === -1 ? id : `กฎข้อ ${idx + 1}: ${pack.rulebook.coreRules[idx]!.rule}`;
}

function attemptsLeftNote(picks: number, finished: boolean) {
  if (finished || picks === 0) return null;
  return <p className="feedback bad">ยังไม่ถูก — ตอบได้อีก {MAX_CHOICE_ATTEMPTS - picks} ครั้ง (ตอบครั้งที่ 2 ได้สูงสุด Hard)</p>;
}

export function LegalityGame({ game, pack, ctx }: { game: Legality; pack: Pack; ctx: PlayContext }) {
  const [picks, setPicks] = useState<string[]>([]);
  const [hintUsed, setHintUsed] = useState(false);
  const res = scoreChoice(game.answer, picks);
  const sw = useStopwatch(res.finished);
  const grade = puzzleGrade(ctx, { correct: res.correct, attempts: res.attempts, hintUsed, seconds: sw.seconds, target: game.targetSeconds });

  return (
    <div className="game">
      <div className="game-head">
        <span className="muted small">Legality check</span>
        <Timer seconds={sw.seconds} target={game.targetSeconds} />
      </div>
      <div className="flashcard">
        <p>{game.case}</p>
        <p className="question">{game.question}</p>
      </div>
      <div className="options">
        {game.options.map((o) => {
          const picked = picks.includes(o.id);
          const cls = res.finished && o.id === game.answer ? 'option correct' : picked ? 'option wrong' : 'option';
          return (
            <button key={o.id} type="button" className={cls} disabled={res.finished || picked} onClick={() => setPicks((p) => [...p, o.id])}>
              {o.label}
            </button>
          );
        })}
      </div>
      {attemptsLeftNote(picks.length, res.finished)}
      {!res.finished && <HintButton hint={game.hint} used={hintUsed} onUse={() => setHintUsed(true)} />}
      {res.finished && (
        <>
          <Analysis>
            <p>
              <strong>คำตอบ:</strong> {game.options.find((o) => o.id === game.answer)?.label}
            </p>
            <p>{game.why}</p>
            <ul className="muted small">
              {game.ruleIds.map((r) => (
                <li key={r}>{ruleText(pack, r)}</li>
              ))}
            </ul>
          </Analysis>
          <GradeFooter grade={grade} durationMs={sw.ms} detail={{ picks, hintUsed }} ctx={ctx} />
        </>
      )}
    </div>
  );
}

/** MCQ แบบ NLE: ขีดฆ่าตัวหลอกได้ก่อนตอบ แล้วดูเหตุผลที่ตัดแต่ละตัวหลังจบ */
export function McqGame({ game, ctx }: { game: Mcq; ctx: PlayContext }) {
  const [picks, setPicks] = useState<string[]>([]);
  const [struck, setStruck] = useState<Set<string>>(new Set());
  const [hintUsed, setHintUsed] = useState(false);
  const res = scoreChoice(game.answer, picks);
  const sw = useStopwatch(res.finished);
  const grade = puzzleGrade(ctx, { correct: res.correct, attempts: res.attempts, hintUsed, seconds: sw.seconds, target: game.targetSeconds });

  return (
    <div className="game">
      <div className="game-head">
        <span className="muted small">MCQ · ความยาก {'●'.repeat(game.difficulty)}</span>
        <Timer seconds={sw.seconds} target={game.targetSeconds} />
      </div>
      <div className="flashcard" lang="en">
        <p>{game.stem}</p>
      </div>
      <p className="muted small">แตะตัวเลือกเพื่อตอบ · แตะ ✕ เพื่อขีดฆ่าตัวหลอกก่อน</p>
      <div className="options" lang="en">
        {game.options.map((o) => {
          const picked = picks.includes(o.key);
          const isStruck = struck.has(o.key);
          const cls = res.finished && o.key === game.answer ? 'option correct' : picked ? 'option wrong' : isStruck ? 'option struck' : 'option';
          return (
            <div key={o.key} className="option-row">
              <button type="button" className={cls} disabled={res.finished || picked} onClick={() => setPicks((p) => [...p, o.key])}>
                <strong>{o.key}.</strong> {o.text}
              </button>
              {!res.finished && (
                <button
                  type="button"
                  className="icon-button strike"
                  aria-pressed={isStruck}
                  aria-label={`ขีดฆ่าตัวเลือก ${o.key}`}
                  onClick={() =>
                    setStruck((s) => {
                      const n = new Set(s);
                      if (n.has(o.key)) n.delete(o.key);
                      else n.add(o.key);
                      return n;
                    })
                  }
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
      {attemptsLeftNote(picks.length, res.finished)}
      {!res.finished && <HintButton hint={game.hint} used={hintUsed} onUse={() => setHintUsed(true)} />}
      {res.finished && (
        <>
          <Analysis>
            <p>
              <strong>Tell:</strong> <span lang="en">{game.tell}</span>
            </p>
            <ul className="plain">
              {game.options.map((o) => (
                <li key={o.key} className={o.key === game.answer ? 'feedback good' : ''}>
                  <strong>{o.key}</strong> {o.key === game.answer ? '✓ คำตอบ' : <span lang="en">✕ {o.why}</span>}
                </li>
              ))}
            </ul>
            <p>{game.explanation}</p>
          </Analysis>
          <GradeFooter grade={grade} durationMs={sw.ms} detail={{ picks, struck: [...struck], hintUsed }} ctx={ctx} />
        </>
      )}
    </div>
  );
}

/** Speedrun: นึกคำตอบให้เร็ว เปิดเฉลย แล้วตัดสินตัวเองว่าถูกไหม — เวลาเป็นตัวกำหนดเกรด */
export function SpeedrunGame({ game, ctx }: { game: Speedrun; ctx: PlayContext }) {
  const [revealedAt, setRevealedAt] = useState<number>();
  const [verdict, setVerdict] = useState<boolean>();
  const sw = useStopwatch(revealedAt !== undefined);
  const grade = puzzleGrade(ctx, { correct: verdict === true, attempts: 1, hintUsed: false, seconds: sw.seconds, target: game.targetSeconds });

  return (
    <div className="game">
      <div className="game-head">
        <span className="muted small">Speedrun</span>
        <Timer seconds={sw.seconds} target={game.targetSeconds} />
      </div>
      <div className="flashcard">
        <p className="front">{game.prompt}</p>
        {revealedAt !== undefined && (
          <>
            <hr />
            <p className="back">{game.answer}</p>
          </>
        )}
      </div>
      {revealedAt === undefined ? (
        <div className="answer-bar">
          <button type="button" className="primary big" onClick={() => setRevealedAt(sw.ms)}>
            นึกออกแล้ว — เปิดเฉลย
          </button>
        </div>
      ) : verdict === undefined ? (
        <div className="answer-bar">
          <div className="grade-buttons two">
            <button type="button" className="grade g1" onClick={() => setVerdict(false)}>
              <span className="grade-label">ผิด / นึกไม่ออก</span>
            </button>
            <button type="button" className="grade g3" onClick={() => setVerdict(true)}>
              <span className="grade-label">ถูก</span>
            </button>
          </div>
        </div>
      ) : (
        <GradeFooter grade={grade} durationMs={sw.ms} detail={{ selfCorrect: verdict, seconds: Math.round(sw.seconds) }} ctx={ctx} />
      )}
    </div>
  );
}
