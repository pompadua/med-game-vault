import type { Pack } from '../../core/schema/pack';
import type { QueueEntry } from '../../core/srs/queue';
import type { ReviewSettings } from '../../core/srs/settings';
import { MemoryCard, type GradeResult } from './MemoryCard';

/** เลือกตัวแสดงผลตามชนิด item */
export function ItemView({
  entry,
  settings,
  pack,
  showIntervals = true,
  onGraded,
}: {
  entry: QueueEntry;
  settings: ReviewSettings;
  pack: Pack | undefined;
  showIntervals?: boolean;
  onGraded: (r: GradeResult) => void;
}) {
  if (entry.item.kind === 'memory') {
    return <MemoryCard item={entry.item} state={entry.state} settings={settings} showIntervals={showIntervals} onGraded={onGraded} />;
  }
  void pack;
  return <p className="hint">ยังไม่มี UI สำหรับ item ชนิดนี้</p>;
}
