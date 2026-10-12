import { findGame } from '../../core/games/lookup';
import type { Pack } from '../../core/schema/pack';
import type { QueueEntry } from '../../core/srs/queue';
import type { ReviewSettings } from '../../core/srs/settings';
import { LegalityGame, McqGame, SpeedrunGame } from '../games/ChoiceGames';
import type { PlayContext } from '../games/common';
import { EngineGame, MatchupGame } from '../games/GridGames';
import { CampaignGame, DeductionGame, GuessWhoGame } from '../games/TreeGames';
import { MemoryCard, type GradeResult } from './MemoryCard';

/** เลือกตัวแสดงผลตามชนิด item */
export function ItemView({
  entry,
  settings,
  pack,
  showIntervals = true,
  practice = false,
  onGraded,
}: {
  entry: QueueEntry;
  settings: ReviewSettings;
  pack: Pack | undefined;
  showIntervals?: boolean;
  practice?: boolean;
  onGraded: (r: GradeResult) => void;
}) {
  if (entry.item.kind === 'memory') {
    return <MemoryCard item={entry.item} state={entry.state} settings={settings} showIntervals={showIntervals} onGraded={onGraded} />;
  }
  const ref = pack && findGame(pack, entry.item);
  if (!pack || !ref) return <p className="error">หาเกมของ item นี้ไม่เจอ ({entry.item.id})</p>;
  const ctx: PlayContext = {
    grading: { easyTimeRatio: settings.easyTimeRatio, guessWhoHardExtraDepth: settings.guessWhoHardExtraDepth },
    practice,
    onGraded,
  };
  switch (ref.mode) {
    case 'legality':
      return <LegalityGame game={ref.game} pack={pack} ctx={ctx} />;
    case 'mcq':
      return <McqGame game={ref.game} ctx={ctx} />;
    case 'speedrun':
      return <SpeedrunGame game={ref.game} ctx={ctx} />;
    case 'engine':
      return <EngineGame game={ref.game} pack={pack} ctx={ctx} />;
    case 'matchups':
      return <MatchupGame grid={ref.game} row={ref.row} ctx={ctx} />;
    case 'guessWho':
      return <GuessWhoGame game={ref.game} ctx={ctx} />;
    case 'deduction':
      return <DeductionGame game={ref.game} ctx={ctx} />;
    case 'campaign':
      return <CampaignGame game={ref.game} ctx={ctx} />;
  }
}
