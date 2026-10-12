import { describe, expect, it } from 'vitest';
import { deductionDiff, deductionSpent, evaluateCampaign, evaluatePlayerTree, scoreChoice, scoreEngine, scoreMatchupRow } from '../src/core/games/score';
import { Pack } from '../src/core/schema/pack';
import { readJsonFile, samplePack } from './helpers';

const hf = Pack.parse(samplePack());
const demo = Pack.parse(readJsonFile('tests/fixtures/demo-all-modes.json'));

describe('scoreChoice', () => {
  it('ถูกครั้งแรก / ถูกครั้งที่สอง / ผิดสองครั้ง', () => {
    expect(scoreChoice('b', ['b'])).toEqual({ correct: true, attempts: 1, finished: true });
    expect(scoreChoice('b', ['a', 'b'])).toEqual({ correct: true, attempts: 2, finished: true });
    expect(scoreChoice('b', ['a', 'c'])).toEqual({ correct: false, attempts: 2, finished: true });
    expect(scoreChoice('b', ['a'])).toEqual({ correct: false, attempts: 1, finished: false });
  });
});

describe('scoreEngine / scoreMatchupRow', () => {
  const eng = hf.games.engine![0]!;
  it('ทุกช่องถูก = correct', () => {
    const answers = Object.fromEntries(eng.cells.map((c) => [c.id, c.answer]));
    expect(scoreEngine(eng, answers)).toEqual({ correct: true, wrong: [], complete: true });
  });
  it('ผิดช่องเดียว = ไม่ correct และบอกช่องที่ผิด', () => {
    const answers = Object.fromEntries(eng.cells.map((c) => [c.id, c.answer]));
    const target = eng.cells.find((c) => c.counterIntuitive)!;
    answers[target.id] = target.answer === 'up' ? 'down' : 'up';
    expect(scoreEngine(eng, answers).wrong).toEqual([target.id]);
  });
  it('matchup row', () => {
    const grid = hf.games.matchups![0]!;
    const row = grid.rows.find((r) => r.id === 'arni')!;
    const answers = Object.fromEntries(row.cells.map((c) => [c.condition, c.verdict]));
    expect(scoreMatchupRow(grid, row, answers).correct).toBe(true);
    expect(scoreMatchupRow(grid, row, { ...answers, 'on-acei-12h': 'legal' }).wrong).toEqual(['on-acei-12h']);
    expect(scoreMatchupRow(grid, row, {}).complete).toBe(false);
  });
});

describe('deduction', () => {
  const d = demo.games.deduction![0]!;
  it('นับแต้มและหา clue ที่ซื้อเกิน/ขาด', () => {
    const extra = d.clues.find((c) => !d.optimalLine.includes(c.id))!;
    const bought = [...d.optimalLine, extra.id];
    expect(deductionSpent(d, bought)).toBe(d.optimalLine.reduce((s, id) => s + d.clues.find((c) => c.id === id)!.cost, 0) + extra.cost);
    expect(deductionDiff(d, bought)).toEqual({ wasted: [extra.id], missed: [] });
  });
});

describe('guessWho player tree', () => {
  const gw = demo.games.guessWho![0]!;
  const cands = gw.candidates.map((c) => c.id);
  it('optimal tree ของ pack = แยกครบ ความลึกเท่า optimal', () => {
    const toPlayer = (n: typeof gw.optimalTree): object => ('leaf' in n ? {} : { question: n.question, yes: toPlayer(n.yes), no: toPlayer(n.no) });
    const res = evaluatePlayerTree(toPlayer(gw.optimalTree), cands, gw.questions);
    expect(res.separatesAll).toBe(true);
    expect(res.depth).toBe(2);
  });
  it('tree ที่ยังไม่เสร็จ = แยกไม่ครบ', () => {
    expect(evaluatePlayerTree({}, cands, gw.questions).separatesAll).toBe(false);
  });
});

describe('campaign', () => {
  const c = demo.games.campaign![0]!;
  it('เดินเส้น best จนจบ = ไม่มี harmful', () => {
    const choices: string[] = [];
    let turnId: string | null = c.startTurn;
    while (turnId) {
      const best = c.turns.find((t) => t.id === turnId)!.choices.find((x) => x.quality === 'best')!;
      choices.push(best.id);
      turnId = best.next;
    }
    const res = evaluateCampaign(c, choices);
    expect(res).toMatchObject({ finished: true, harmful: 0, ok: 0 });
  });
  it('เลือก harmful ถูกนับ', () => {
    const first = c.turns.find((t) => t.id === c.startTurn)!;
    const bad = first.choices.find((x) => x.quality === 'harmful')!;
    expect(evaluateCampaign(c, [bad.id]).harmful).toBe(1);
  });
});
