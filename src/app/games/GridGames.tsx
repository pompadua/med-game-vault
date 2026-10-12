import { useState } from 'react';
import { scoreEngine, scoreMatchupRow } from '../../core/games/score';
import type { Engine, Matchups, Pack } from '../../core/schema/pack';
import { Badge } from '../components/ui';
import { Analysis, GradeFooter, HintButton, puzzleGrade, SubmitBar, Timer, useStopwatch, type PlayContext } from './common';

const DIRS = [
  { id: 'up', label: '↑' },
  { id: 'down', label: '↓' },
  { id: 'same', label: '↔' },
] as const;
const DIR_LABEL: Record<string, string> = { up: '↑ เพิ่ม', down: '↓ ลด', same: '↔ ไม่เปลี่ยน/เปลี่ยนน้อย' };

/** Engine puzzle: ทำนาย ↑/↓/↔ ทุกช่อง แล้วดูเหตุผลจากสมการหรือกฎ */
export function EngineGame({ game, pack, ctx }: { game: Engine; pack: Pack; ctx: PlayContext }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const sw = useStopwatch(submitted);
  const res = scoreEngine(game, answers);
  const grade = puzzleGrade(ctx, { correct: res.correct, attempts: 1, hintUsed, seconds: sw.seconds, target: game.targetSeconds });
  const ruleNo = (id?: string) => (id ? pack.rulebook.coreRules.findIndex((r) => r.id === id) + 1 : 0);

  return (
    <div className="game">
      <div className="game-head">
        <span className="muted small">Engine · perturbation grid</span>
        <Timer seconds={sw.seconds} target={game.targetSeconds} />
      </div>
      <div className="flashcard">
        <p>
          <strong>Perturbation:</strong> {game.perturbation}
        </p>
        {game.equation && <p className="muted small">สมการ: {game.equation}</p>}
      </div>
      <div className="grid-cells">
        {game.cells.map((c) => {
          const wrong = submitted && res.wrong.includes(c.id);
          return (
            <div key={c.id} className={submitted ? (wrong ? 'cell-row wrong' : 'cell-row correct') : 'cell-row'}>
              <span className="cell-var">{c.variable}</span>
              <div className="dir-buttons" role="radiogroup" aria-label={c.variable}>
                {DIRS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    role="radio"
                    aria-checked={answers[c.id] === d.id}
                    className={answers[c.id] === d.id ? 'dir active' : 'dir'}
                    disabled={submitted}
                    onClick={() => setAnswers((a) => ({ ...a, [c.id]: d.id }))}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {submitted && (
                <p className="cell-why small">
                  {wrong && <strong>เฉลย {DIR_LABEL[c.answer]} · </strong>}
                  {c.counterIntuitive && <Badge tone="warn">ขัดสัญชาตญาณ</Badge>} {c.why}
                  {c.ruleId && <span className="muted"> (กฎข้อ {ruleNo(c.ruleId)})</span>}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {!submitted && <HintButton hint={game.hint} used={hintUsed} onUse={() => setHintUsed(true)} />}
      {submitted ? (
        <>
          <Analysis>
            <p>
              ถูก {game.cells.length - res.wrong.length}/{game.cells.length} ช่อง {res.correct ? '— ผ่าน' : '— ต้องถูกทุกช่องจึงนับว่าผ่าน'}
            </p>
          </Analysis>
          <GradeFooter grade={grade} durationMs={sw.ms} detail={{ answers, wrong: res.wrong, hintUsed }} ctx={ctx} />
        </>
      ) : (
        <SubmitBar disabled={!res.complete} onSubmit={() => setSubmitted(true)} label={res.complete ? 'ส่งคำตอบ' : 'เลือกให้ครบทุกช่อง'} />
      )}
    </div>
  );
}

const VERDICTS = [
  { id: 'legal', label: 'Legal' },
  { id: 'illegal', label: 'Illegal' },
  { id: 'combo', label: 'Combo' },
] as const;

/** Matchups: ยาหนึ่งตัว × ทุกสถานการณ์ (1 review item = 1 แถว) */
export function MatchupGame({ grid, row, ctx }: { grid: Matchups; row: Matchups['rows'][number]; ctx: PlayContext }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const sw = useStopwatch(submitted);
  const res = scoreMatchupRow(grid, row, answers);
  const target = grid.targetSeconds;
  const grade = puzzleGrade(ctx, { correct: res.correct, attempts: 1, hintUsed, seconds: sw.seconds, target });

  return (
    <div className="game">
      <div className="game-head">
        <span className="muted small">Matchups · {grid.title}</span>
        <Timer seconds={sw.seconds} target={target} />
      </div>
      <div className="flashcard">
        <p>
          <strong>{row.drug}</strong> ในแต่ละสถานการณ์ เป็น legal / illegal (contraindicated) / combo (ใช้ร่วมกับยาที่มีอยู่แบบเสริมกัน หรือมี interaction ที่ต้องเฝ้าระวัง)?
        </p>
      </div>
      <div className="grid-cells">
        {grid.conditions.map((cond) => {
          const cell = row.cells.find((c) => c.condition === cond.id)!;
          const wrong = submitted && res.wrong.includes(cond.id);
          return (
            <div key={cond.id} className={submitted ? (wrong ? 'cell-row wrong' : 'cell-row correct') : 'cell-row'}>
              <span className="cell-var">{cond.label}</span>
              <div className="dir-buttons" role="radiogroup" aria-label={cond.label}>
                {VERDICTS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={answers[cond.id] === v.id}
                    className={answers[cond.id] === v.id ? `dir active v-${v.id}` : 'dir'}
                    disabled={submitted}
                    onClick={() => setAnswers((a) => ({ ...a, [cond.id]: v.id }))}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              {submitted && (
                <p className="cell-why small">
                  {wrong && <strong>เฉลย {cell.verdict} · </strong>}
                  {cell.why}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {!submitted && <HintButton hint={grid.hint} used={hintUsed} onUse={() => setHintUsed(true)} />}
      {submitted ? (
        <GradeFooter grade={grade} durationMs={sw.ms} detail={{ answers, wrong: res.wrong, hintUsed }} ctx={ctx} />
      ) : (
        <SubmitBar disabled={!res.complete} onSubmit={() => setSubmitted(true)} label={res.complete ? 'ส่งคำตอบ' : 'เลือกให้ครบทุกช่อง'} />
      )}
    </div>
  );
}
