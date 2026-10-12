import { MATCHUP_SEP } from '../items/extract';
import type { ReviewItem } from '../items/types';
import type { Campaign, Deduction, Engine, GuessWho, Legality, Matchups, Mcq, Pack, Speedrun } from '../schema/pack';

export type GameRef =
  | { mode: 'deduction'; game: Deduction }
  | { mode: 'guessWho'; game: GuessWho }
  | { mode: 'engine'; game: Engine }
  | { mode: 'legality'; game: Legality }
  | { mode: 'campaign'; game: Campaign }
  | { mode: 'matchups'; game: Matchups; row: Matchups['rows'][number] }
  | { mode: 'speedrun'; game: Speedrun }
  | { mode: 'mcq'; game: Mcq };

/** หา element ของเกมที่ review item ชี้อยู่ */
export function findGame(pack: Pack, item: ReviewItem): GameRef | undefined {
  const g = pack.games;
  const byId = <T extends { id: string }>(list: T[] | undefined, id: string) => list?.find((x) => x.id === id);
  switch (item.type) {
    case 'deduction': {
      const game = byId(g.deduction, item.elementId);
      return game && { mode: 'deduction', game };
    }
    case 'guessWho': {
      const game = byId(g.guessWho, item.elementId);
      return game && { mode: 'guessWho', game };
    }
    case 'engine': {
      const game = byId(g.engine, item.elementId);
      return game && { mode: 'engine', game };
    }
    case 'legality': {
      const game = byId(g.legality, item.elementId);
      return game && { mode: 'legality', game };
    }
    case 'campaign': {
      const game = byId(g.campaign, item.elementId);
      return game && { mode: 'campaign', game };
    }
    case 'speedrun': {
      const game = byId(g.speedrun, item.elementId);
      return game && { mode: 'speedrun', game };
    }
    case 'mcq': {
      const game = byId(g.mcq, item.elementId);
      return game && { mode: 'mcq', game };
    }
    case 'matchup': {
      const [gridId = '', rowId = ''] = item.elementId.split(MATCHUP_SEP);
      const game = byId(g.matchups, gridId);
      const row = game?.rows.find((r) => r.id === rowId);
      return game && row ? { mode: 'matchups', game, row } : undefined;
    }
    default:
      return undefined;
  }
}

/** แต้มรวมของ optimalLine ใน deduction */
export function optimalPoints(d: Deduction): number {
  return d.optimalLine.reduce((sum, id) => sum + (d.clues.find((c) => c.id === id)?.cost ?? 0), 0);
}
