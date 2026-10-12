import type { Campaign, Deduction, Engine, Matchups } from '../schema/pack';
import type { GwQuestion } from './guessWho';

/** ตรรกะการตรวจคำตอบของแต่ละโหมด (pure — UI เรียกใช้ และมี test) */

/** ข้อแบบเลือกตัวเลือก: ตอบได้สูงสุด maxAttempts ครั้ง กันการไล่กดทีละตัวจนถูก */
export const MAX_CHOICE_ATTEMPTS = 2;

export function scoreChoice(answer: string, picks: string[], maxAttempts = MAX_CHOICE_ATTEMPTS) {
  const idx = picks.indexOf(answer);
  const correct = idx !== -1 && idx < maxAttempts;
  return { correct, attempts: correct ? idx + 1 : Math.min(picks.length, maxAttempts), finished: correct || picks.length >= maxAttempts };
}

export function scoreEngine(game: Engine, answers: Record<string, string | undefined>) {
  const wrong = game.cells.filter((c) => answers[c.id] !== c.answer).map((c) => c.id);
  return { correct: wrong.length === 0, wrong, complete: game.cells.every((c) => answers[c.id] !== undefined) };
}

export function scoreMatchupRow(grid: Matchups, row: Matchups['rows'][number], answers: Record<string, string | undefined>) {
  const wrong = row.cells.filter((c) => answers[c.condition] !== c.verdict).map((c) => c.condition);
  return { correct: wrong.length === 0, wrong, complete: grid.conditions.every((c) => answers[c.id] !== undefined) };
}

export function deductionSpent(d: Deduction, bought: string[]): number {
  return bought.reduce((sum, id) => sum + (d.clues.find((c) => c.id === id)?.cost ?? 0), 0);
}

/** clue ที่ซื้อแต่ไม่อยู่ใน optimal line (ซื้อเกิน) และ clue ใน optimal line ที่ไม่ได้ซื้อ */
export function deductionDiff(d: Deduction, bought: string[]) {
  const opt = new Set(d.optimalLine);
  return { wasted: bought.filter((id) => !opt.has(id)), missed: d.optimalLine.filter((id) => !bought.includes(id)) };
}

/** tree ที่ผู้เล่นสร้าง: node ที่ยังไม่เลือกคำถาม = leaf */
export interface PlayerNode {
  question?: string;
  yes?: PlayerNode;
  no?: PlayerNode;
}

export function evaluatePlayerTree(root: PlayerNode, candidates: string[], questions: GwQuestion[]) {
  const qById = new Map(questions.map((q) => [q.id, new Set(q.yes)]));
  let separatesAll = true;
  const depthOf = (node: PlayerNode, pool: string[]): number => {
    const yesSet = node.question ? qById.get(node.question) : undefined;
    if (!yesSet) {
      if (pool.length > 1) separatesAll = false;
      return 0;
    }
    const y = pool.filter((c) => yesSet.has(c));
    const n = pool.filter((c) => !yesSet.has(c));
    return 1 + Math.max(depthOf(node.yes ?? {}, y), depthOf(node.no ?? {}, n));
  };
  const depth = depthOf(root, candidates);
  return { separatesAll, depth };
}

/** เดินตามตัวเลือกใน campaign แล้วสรุปผล */
export function evaluateCampaign(game: Campaign, choiceIds: string[]) {
  let turnId: string | null = game.startTurn;
  let harmful = 0;
  let ok = 0;
  const path: { turnId: string; choiceId: string; quality: string }[] = [];
  for (const cid of choiceIds) {
    if (turnId === null) break;
    const turn = game.turns.find((t) => t.id === turnId);
    const choice = turn?.choices.find((c) => c.id === cid);
    if (!turn || !choice) break;
    path.push({ turnId: turn.id, choiceId: choice.id, quality: choice.quality });
    if (choice.quality === 'harmful') harmful++;
    if (choice.quality === 'ok') ok++;
    turnId = choice.next;
  }
  return { finished: turnId === null, currentTurn: turnId, harmful, ok, path };
}
