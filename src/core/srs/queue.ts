import type { FSRS } from 'ts-fsrs';
import type { ItemType, ReviewItem } from '../items/types';
import { nextDayStart, studyDayKey, type DayConfig } from './day';
import type { ItemState, ReviewLogEntry } from './model';
import { retrievability } from './scheduler';
import type { ReviewSettings } from './settings';

/** ลำดับ item ใหม่: กฎก่อน แล้วค่อยการ์ด แล้วค่อยเกม */
const NEW_TYPE_ORDER: ItemType[] = [
  'rule',
  'signature',
  'tell',
  'counter',
  'danger',
  'memorize',
  'erratum',
  'trapPair',
  'exploit',
  'distractor',
  'speedrun',
  'legality',
  'engine',
  'matchup',
  'guessWho',
  'mcq',
  'deduction',
  'campaign',
];

export interface QueueEntry {
  item: ReviewItem;
  state: ItemState | undefined;
  /** retrievability ณ ตอนสร้างคิว (item ใหม่ = undefined) */
  r: number | undefined;
  isNew: boolean;
  estSeconds: number;
}

export interface QueueInput {
  items: ReviewItem[];
  states: Map<string, ItemState>;
  enabledPacks: Set<string>;
  /** log ของวันทวนนี้ (ใช้นับ item ใหม่/long ที่ทำไปแล้ว และ sibling) */
  todayLogs: ReviewLogEntry[];
  now: Date;
  settings: ReviewSettings;
  scheduler: FSRS;
  /** ชนิด item ที่แอปเล่นได้ (เช่น ยังไม่มี UI ของเกม = ใส่แค่ memory) */
  allowedTypes?: Set<ItemType>;
  /** "วันนี้มีเวลา X นาที" — ตัดคิวตามเวลาประมาณ */
  timeBudgetMinutes?: number;
  /** เวลาเฉลี่ยจริงต่อชนิด item (วินาที) จาก log */
  avgSecondsByType?: Map<ItemType, number>;
}

export interface QueueResult {
  /** คิวที่พร้อมทวนตอนนี้ เรียงแล้ว */
  queue: QueueEntry[];
  /** item ใน learning step ที่จะครบกำหนดภายหลังในวันนี้ */
  laterToday: QueueEntry[];
  /** due ที่ถูกเลื่อนไปพรุ่งนี้เพราะ sibling */
  siblingDeferred: number;
  /** due ที่ถูกตัดเพราะงบเวลา */
  overBudget: number;
  dueCount: number;
  newCount: number;
  estimatedSeconds: number;
}

export function estimateSeconds(item: ReviewItem, s: ReviewSettings, avg?: Map<ItemType, number>): number {
  const measured = avg?.get(item.type);
  if (measured && measured > 0) return measured;
  return item.targetSeconds ?? s.defaultMemorySeconds;
}

/**
 * สลับหัวข้อ (interleave): เลือกตัวแรกในลำดับความสำคัญที่มาจาก pack ต่างจากตัวก่อนหน้า
 * ถ้าเหลือแต่ pack เดียวกัน ก็ยอมให้ติดกัน
 */
export function interleave<T>(sorted: T[], packOf: (x: T) => string): T[] {
  const rest = [...sorted];
  const out: T[] = [];
  let lastPack: string | undefined;
  while (rest.length) {
    let idx = rest.findIndex((x) => packOf(x) !== lastPack);
    if (idx === -1) idx = 0;
    const [picked] = rest.splice(idx, 1);
    out.push(picked!);
    lastPack = packOf(picked!);
  }
  return out;
}

export function buildQueue(input: QueueInput): QueueResult {
  const { items, states, enabledPacks, todayLogs, now, settings: s, scheduler } = input;
  const dayCfg: DayConfig = { timeZone: s.timeZone, dayStartHour: s.dayStartHour };
  const dayEnd = nextDayStart(now, dayCfg);
  const todayKey = studyDayKey(now, dayCfg);
  const scheduledToday = todayLogs.filter((l) => l.countsToFsrs && studyDayKey(new Date(l.reviewedAt), dayCfg) === todayKey);

  // item ที่ทวนวันนี้แล้ว แยกตาม sibling group
  const siblingSeen = new Map<string, Set<string>>();
  const itemById = new Map(items.map((i) => [i.id, i]));
  for (const l of scheduledToday) {
    const it = itemById.get(l.itemId);
    if (!it) continue;
    const set = siblingSeen.get(it.siblingKey) ?? new Set<string>();
    set.add(it.id);
    siblingSeen.set(it.siblingKey, set);
  }

  const newDoneToday = new Set(scheduledToday.filter((l) => l.stateBefore === 0).map((l) => l.itemId)).size;
  const longDoneToday = new Set(scheduledToday.filter((l) => itemById.get(l.itemId)?.long).map((l) => l.itemId)).size;
  let newLeft = Math.max(0, s.newPerDay - newDoneToday);
  let longLeft = Math.max(0, s.longPerDay - longDoneToday);

  const dueNow: QueueEntry[] = [];
  const later: QueueEntry[] = [];
  const fresh: QueueEntry[] = [];

  for (const item of items) {
    if (item.retired || !enabledPacks.has(item.packId)) continue;
    if (input.allowedTypes && !input.allowedTypes.has(item.type)) continue;
    const st = states.get(item.id);
    if (st?.suspended) continue;
    if (st?.buriedUntil && new Date(st.buriedUntil) > now) continue;
    const entry: QueueEntry = {
      item,
      state: st,
      r: st ? retrievability(scheduler, st.card, now) : undefined,
      isNew: !st || st.card.state === 0,
      estSeconds: estimateSeconds(item, s, input.avgSecondsByType),
    };
    if (entry.isNew) fresh.push(entry);
    else {
      const due = new Date(st!.card.due);
      if (due <= now) dueNow.push(entry);
      else if (due < dayEnd) later.push(entry);
    }
  }

  // review ที่ครบกำหนด: R ต่ำก่อน (เสี่ยงลืมก่อน), เสมอกันเรียงตาม id ให้ผลคงที่
  dueNow.sort((a, b) => (a.r ?? 0) - (b.r ?? 0) || (a.item.id < b.item.id ? -1 : 1));
  // item ใหม่: ตามลำดับชนิด แล้วตาม id
  const typeRank = (t: ItemType) => NEW_TYPE_ORDER.indexOf(t);
  fresh.sort((a, b) => typeRank(a.item.type) - typeRank(b.item.type) || (a.item.id < b.item.id ? -1 : 1));
  // interleave ข้าม pack ภายในกลุ่ม item ใหม่ก่อนตัดตามโควตา เพื่อให้ทุก pack ได้ item ใหม่บ้าง
  const freshInterleaved = interleave(fresh, (e) => e.item.packId);

  const selected: QueueEntry[] = [];
  let siblingDeferred = 0;
  const pickedSiblings = new Map<string, string>();
  const allowSibling = (e: QueueEntry): boolean => {
    const key = e.item.siblingKey;
    const seen = siblingSeen.get(key);
    if (seen && !seen.has(e.item.id)) return false;
    const picked = pickedSiblings.get(key);
    if (picked && picked !== e.item.id) return false;
    return true;
  };

  for (const e of dueNow) {
    if (e.item.long && longLeft <= 0) continue;
    if (!allowSibling(e)) {
      siblingDeferred++;
      continue;
    }
    if (e.item.long) longLeft--;
    pickedSiblings.set(e.item.siblingKey, e.item.id);
    selected.push(e);
  }
  for (const e of freshInterleaved) {
    if (newLeft <= 0) break;
    if (e.item.long && longLeft <= 0) continue;
    if (!allowSibling(e)) continue;
    if (e.item.long) longLeft--;
    newLeft--;
    pickedSiblings.set(e.item.siblingKey, e.item.id);
    selected.push(e);
  }

  let ordered = interleave(selected, (e) => e.item.packId);

  let overBudget = 0;
  if (input.timeBudgetMinutes !== undefined) {
    const budget = input.timeBudgetMinutes * 60;
    let used = 0;
    const kept: QueueEntry[] = [];
    for (const e of ordered) {
      if (used + e.estSeconds > budget && kept.length > 0) {
        overBudget++;
        continue;
      }
      used += e.estSeconds;
      kept.push(e);
    }
    ordered = kept;
  }

  later.sort((a, b) => new Date(a.state!.card.due).getTime() - new Date(b.state!.card.due).getTime());

  return {
    queue: ordered,
    laterToday: later,
    siblingDeferred,
    overBudget,
    dueCount: ordered.filter((e) => !e.isNew).length,
    newCount: ordered.filter((e) => e.isNew).length,
    estimatedSeconds: ordered.reduce((sum, e) => sum + e.estSeconds, 0),
  };
}

/** เวลาเฉลี่ย (วินาที) ต่อชนิด item จาก log — ตัด outlier ที่เกิน 10 นาที */
export function averageSecondsByType(logs: ReviewLogEntry[]): Map<ItemType, number> {
  const sum = new Map<ItemType, { total: number; n: number }>();
  for (const l of logs) {
    if (l.durationMs <= 0 || l.durationMs > 600_000) continue;
    const t = l.type as ItemType;
    const cur = sum.get(t) ?? { total: 0, n: 0 };
    cur.total += l.durationMs / 1000;
    cur.n++;
    sum.set(t, cur);
  }
  return new Map([...sum].map(([t, v]) => [t, Math.round(v.total / v.n)]));
}
