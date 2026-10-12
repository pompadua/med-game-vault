import { useState } from 'react';
import { minTreeDepth, treeDepth } from '../../core/games/guessWho';
import { deductionDiff, deductionSpent, evaluateCampaign, evaluatePlayerTree, type PlayerNode } from '../../core/games/score';
import { optimalPoints } from '../../core/games/lookup';
import type { Campaign, Deduction, GuessWho, TreeNode } from '../../core/schema/pack';
import { gradeDeduction, gradeGuessWho } from '../../core/srs/grading';
import { Badge } from '../components/ui';
import { Analysis, GradeFooter, HintButton, puzzleGrade, SubmitBar, Timer, useStopwatch, type PlayContext } from './common';

// ---------------- Guess Who ----------------

function NodeEditor({
  node,
  pool,
  game,
  disabled,
  onChange,
}: {
  node: PlayerNode;
  pool: string[];
  game: GuessWho;
  disabled: boolean;
  onChange: (n: PlayerNode) => void;
}) {
  const label = (id: string) => game.candidates.find((c) => c.id === id)?.label ?? id;
  if (pool.length <= 1) {
    return <div className={pool.length ? 'tree-leaf' : 'tree-leaf empty'}>{pool.length ? `= ${label(pool[0]!)}` : '(ไม่มีโรคเหลือ)'}</div>;
  }
  const q = game.questions.find((x) => x.id === node.question);
  const yesPool = q ? pool.filter((c) => q.yes.includes(c)) : [];
  const noPool = q ? pool.filter((c) => !q.yes.includes(c)) : [];
  return (
    <div className="tree-node">
      <div className="muted small">เหลือ: {pool.map(label).join(', ')}</div>
      <select
        value={node.question ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value ? { question: e.target.value, yes: {}, no: {} } : {})}
        aria-label="เลือกคำถาม"
      >
        <option value="">— เลือกคำถาม —</option>
        {game.questions.map((x) => (
          <option key={x.id} value={x.id}>
            {x.text}
          </option>
        ))}
      </select>
      {q && (
        <div className="tree-branches">
          <div className="tree-branch">
            <span className="branch-label yes">ใช่</span>
            <NodeEditor node={node.yes ?? {}} pool={yesPool} game={game} disabled={disabled} onChange={(yes) => onChange({ ...node, yes })} />
          </div>
          <div className="tree-branch">
            <span className="branch-label no">ไม่ใช่</span>
            <NodeEditor node={node.no ?? {}} pool={noPool} game={game} disabled={disabled} onChange={(no) => onChange({ ...node, no })} />
          </div>
        </div>
      )}
    </div>
  );
}

function TreeView({ node, game }: { node: TreeNode; game: GuessWho }) {
  if ('leaf' in node) return <div className="tree-leaf">= {game.candidates.find((c) => c.id === node.leaf)?.label ?? node.leaf}</div>;
  return (
    <div className="tree-node">
      <strong>{game.questions.find((q) => q.id === node.question)?.text ?? node.question}</strong>
      <div className="tree-branches">
        <div className="tree-branch">
          <span className="branch-label yes">ใช่</span>
          <TreeView node={node.yes} game={game} />
        </div>
        <div className="tree-branch">
          <span className="branch-label no">ไม่ใช่</span>
          <TreeView node={node.no} game={game} />
        </div>
      </div>
    </div>
  );
}

/** Guess Who: สร้าง decision tree ที่ตื้นที่สุดที่แยกทุกโรคได้ */
export function GuessWhoGame({ game, ctx }: { game: GuessWho; ctx: PlayContext }) {
  const [root, setRoot] = useState<PlayerNode>({});
  const [submitted, setSubmitted] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const sw = useStopwatch(submitted);
  const cands = game.candidates.map((c) => c.id);
  const res = evaluatePlayerTree(root, cands, game.questions);
  const optimal = Math.min(treeDepth(game.optimalTree), minTreeDepth(cands, game.questions));
  // hint ลดเกรดได้สูงสุดเป็น Hard เหมือนโหมดอื่น
  const base = gradeGuessWho({ separatesAll: res.separatesAll, depth: res.depth, optimalDepth: optimal }, ctx.grading);
  const grade = hintUsed && base > 2 ? 2 : base;

  return (
    <div className="game">
      <div className="game-head">
        <span className="muted small">Guess Who · {game.title}</span>
        <Timer seconds={sw.seconds} target={game.targetSeconds} />
      </div>
      <p className="muted small">เลือกคำถาม yes/no ที่แต่ละจุดจนเหลือโรคเดียวในทุกกิ่ง — ยิ่งตื้นยิ่งดี</p>
      <NodeEditor node={root} pool={cands} game={game} disabled={submitted} onChange={setRoot} />
      {!submitted && <HintButton hint={game.hint} used={hintUsed} onUse={() => setHintUsed(true)} />}
      {submitted ? (
        <>
          <Analysis>
            <p>
              tree ของคุณลึก <strong>{res.depth}</strong> ชั้น · optimal <strong>{optimal}</strong> ชั้น
              {!res.separatesAll && ' · ยังแยกไม่ครบทุกโรค'}
            </p>
            <p className="muted small">Optimal tree:</p>
            <TreeView node={game.optimalTree} game={game} />
            <p>{game.explanation}</p>
          </Analysis>
          <GradeFooter grade={grade} durationMs={sw.ms} detail={{ tree: root, depth: res.depth, optimal, separatesAll: res.separatesAll, hintUsed }} ctx={ctx} />
        </>
      ) : (
        <SubmitBar onSubmit={() => setSubmitted(true)} label={res.separatesAll ? `ส่ง tree (ลึก ${res.depth} ชั้น)` : 'ส่ง (ยังแยกไม่ครบ)'} />
      )}
    </div>
  );
}

// ---------------- Deduction ----------------

const KIND_LABEL: Record<string, string> = { history: 'History', pe: 'Physical exam', bedside: 'Bedside test', lab: 'Lab', imaging: 'Imaging' };
const STRENGTH_LABEL: Record<string, string> = { strong: 'strong', moderate: 'moderate', weak: 'weak' };

/** Deduction: ซื้อข้อมูลด้วยแต้ม แล้ววินิจฉัย + เลือก next step ภายในงบ */
export function DeductionGame({ game, ctx }: { game: Deduction; ctx: PlayContext }) {
  const [bought, setBought] = useState<string[]>([]);
  const [dx, setDx] = useState<string>();
  const [step, setStep] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const sw = useStopwatch(submitted);
  const spent = deductionSpent(game, bought);
  const opt = optimalPoints(game);
  const base = gradeDeduction({
    diagnosisCorrect: dx === game.answer.diagnosis,
    nextStepCorrect: step === game.answer.nextStep,
    pointsSpent: spent,
    budget: game.budget,
    optimalPoints: opt,
  });
  const grade = hintUsed && base > 2 ? 2 : base;
  const diff = deductionDiff(game, bought);
  const kinds = [...new Set(game.clues.map((c) => c.kind))];

  return (
    <div className="game">
      <div className="game-head">
        <span className="muted small">Deduction · {game.title}</span>
        <Timer seconds={sw.seconds} target={game.targetSeconds} />
      </div>
      <div className="flashcard">
        <p>
          <strong>CC:</strong> {game.chiefComplaint}
        </p>
        {game.vitals && <p className="muted">{game.vitals}</p>}
      </div>
      <p className={spent > game.budget ? 'budget-line over' : 'budget-line'}>
        ใช้ไป <strong>{spent}</strong> / งบ {game.budget} แต้ม
      </p>
      {kinds.map((k) => (
        <section key={k} className="clue-group">
          <h4>{KIND_LABEL[k] ?? k}</h4>
          {game.clues
            .filter((c) => c.kind === k)
            .map((c) => {
              const has = bought.includes(c.id);
              return (
                <div key={c.id} className={has ? 'clue bought' : 'clue'}>
                  {has ? (
                    <p>
                      <strong>{c.label}:</strong> {c.reveals}
                    </p>
                  ) : (
                    <button type="button" className="secondary" disabled={submitted} onClick={() => setBought((b) => [...b, c.id])}>
                      {c.label} · {c.cost} แต้ม
                    </button>
                  )}
                  {submitted && (
                    <p className="muted small">
                      <Badge tone={game.optimalLine.includes(c.id) ? 'accent' : 'muted'}>{game.optimalLine.includes(c.id) ? 'optimal' : 'ไม่จำเป็น'}</Badge>{' '}
                      {c.lr ? `LR ${c.lr.value}` : STRENGTH_LABEL[c.strength ?? '']} · {c.why}
                      {!has && ` (ไม่ได้ซื้อ: ${c.reveals})`}
                    </p>
                  )}
                </div>
              );
            })}
        </section>
      ))}
      <section className="panel">
        <label className="field">
          <span>วินิจฉัย</span>
          <select value={dx ?? ''} disabled={submitted} onChange={(e) => setDx(e.target.value || undefined)}>
            <option value="">— เลือก —</option>
            {game.diagnosisOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Next step</span>
          <select value={step ?? ''} disabled={submitted} onChange={(e) => setStep(e.target.value || undefined)}>
            <option value="">— เลือก —</option>
            {game.nextStepOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </section>
      {!submitted && <HintButton hint={game.hint} used={hintUsed} onUse={() => setHintUsed(true)} />}
      {submitted ? (
        <>
          <Analysis>
            <p>
              วินิจฉัย {dx === game.answer.diagnosis ? '✓' : '✕'} · next step {step === game.answer.nextStep ? '✓' : '✕'} · ใช้ {spent} แต้ม (optimal {opt}, งบ {game.budget})
            </p>
            <p>
              <strong>เส้นทางที่ดีที่สุด:</strong> {game.optimalLine.map((id) => game.clues.find((c) => c.id === id)?.label).join(' → ')}
            </p>
            {diff.wasted.length > 0 && <p className="muted small">ซื้อเกิน: {diff.wasted.map((id) => game.clues.find((c) => c.id === id)?.label).join(', ')}</p>}
            <p>
              <strong>เฉลย:</strong> {game.diagnosisOptions.find((o) => o.id === game.answer.diagnosis)?.label} → {game.nextStepOptions.find((o) => o.id === game.answer.nextStep)?.label}
            </p>
            <p>{game.explanation}</p>
          </Analysis>
          <GradeFooter grade={grade} durationMs={sw.ms} detail={{ bought, spent, dx, step, hintUsed }} ctx={ctx} />
        </>
      ) : (
        <SubmitBar disabled={!dx || !step} onSubmit={() => setSubmitted(true)} label={dx && step ? 'ส่งคำวินิจฉัย' : 'เลือกวินิจฉัยและ next step'} />
      )}
    </div>
  );
}

// ---------------- Campaign ----------------

/** Campaign: management ทีละ turn ตาม guideline — เลือกผิดมีผลตามจริง แล้วได้โอกาสแก้ตัว */
export function CampaignGame({ game, ctx }: { game: Campaign; ctx: PlayContext }) {
  const [choices, setChoices] = useState<string[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const res = evaluateCampaign(game, choices);
  const sw = useStopwatch(res.finished && !showFeedback);
  const grade = puzzleGrade(ctx, { correct: res.harmful === 0, attempts: 1 + res.ok, hintUsed, seconds: sw.seconds, target: game.targetSeconds });
  const last = res.path[res.path.length - 1];
  const lastTurn = last && game.turns.find((t) => t.id === last.turnId);
  const lastChoice = lastTurn?.choices.find((c) => c.id === last?.choiceId);
  const turn = res.currentTurn ? game.turns.find((t) => t.id === res.currentTurn) : undefined;
  const ended = res.finished && !showFeedback;

  return (
    <div className="game">
      <div className="game-head">
        <span className="muted small">Campaign · {game.title}</span>
        <Timer seconds={sw.seconds} target={game.targetSeconds} />
      </div>
      {choices.length === 0 && (
        <div className="flashcard">
          <p>{game.intro}</p>
        </div>
      )}
      {showFeedback && lastChoice && (
        <div className={`feedback-card q-${lastChoice.quality}`}>
          <p>
            <strong>{lastChoice.quality === 'best' ? '✓ ดีที่สุด' : lastChoice.quality === 'ok' ? '△ พอได้' : '✕ อันตราย'}</strong> — {lastChoice.feedback}
          </p>
        </div>
      )}
      {!showFeedback && turn && (
        <>
          <div className="flashcard">
            <p className="muted small">Turn {res.path.length + 1}</p>
            <p>{turn.state}</p>
          </div>
          <div className="options">
            {turn.choices.map((c) => (
              <button
                key={c.id}
                type="button"
                className="option"
                onClick={() => {
                  setChoices((x) => [...x, c.id]);
                  setShowFeedback(true);
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <HintButton hint={game.hint} used={hintUsed} onUse={() => setHintUsed(true)} />
        </>
      )}
      {showFeedback && <SubmitBar label={res.finished ? 'ดูสรุป' : 'turn ถัดไป'} onSubmit={() => setShowFeedback(false)} />}
      {ended && (
        <>
          <Analysis>
            <p>
              ตัวเลือกอันตราย {res.harmful} ครั้ง · พอได้ {res.ok} ครั้ง
            </p>
            <ol className="small">
              {res.path.map((p, i) => {
                const t = game.turns.find((x) => x.id === p.turnId);
                const c = t?.choices.find((x) => x.id === p.choiceId);
                return (
                  <li key={i} className={`q-${p.quality}`}>
                    {c?.label}
                  </li>
                );
              })}
            </ol>
            <p>
              <strong>ลำดับตาม guideline:</strong>
            </p>
            <ol className="small">
              {game.guidelineSequence.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </Analysis>
          <GradeFooter grade={grade} durationMs={sw.ms} detail={{ path: res.path, harmful: res.harmful, ok: res.ok, hintUsed }} ctx={ctx} />
        </>
      )}
    </div>
  );
}
