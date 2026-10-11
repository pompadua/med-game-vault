export const MEMORY_ITEM_TYPES = [
  'rule',
  'erratum',
  'signature',
  'counter',
  'danger',
  'tell',
  'memorize',
  'exploit',
  'distractor',
  'trapPair',
] as const;

export const PUZZLE_ITEM_TYPES = [
  'speedrun',
  'engine',
  'guessWho',
  'legality',
  'matchup',
  'mcq',
  'deduction',
  'campaign',
] as const;

export const ITEM_TYPES = [...MEMORY_ITEM_TYPES, ...PUZZLE_ITEM_TYPES] as const;

export type MemoryItemType = (typeof MEMORY_ITEM_TYPES)[number];
export type PuzzleItemType = (typeof PUZZLE_ITEM_TYPES)[number];
export type ItemType = (typeof ITEM_TYPES)[number];

/** ใช้เวลานาน — จำกัดจำนวนต่อวันแยกต่างหาก */
export const LONG_ITEM_TYPES: readonly ItemType[] = ['deduction', 'campaign'];

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  rule: 'กฎหลัก',
  erratum: 'ข้อยกเว้น',
  signature: 'Signature',
  counter: 'Counter',
  danger: 'Danger',
  tell: 'Tell (X vs Y)',
  memorize: 'ค่าจำ',
  exploit: 'ช่องโหว่',
  distractor: 'ตัวหลอก',
  trapPair: 'Trap pair',
  speedrun: 'Speedrun',
  engine: 'Engine',
  guessWho: 'Guess Who',
  legality: 'Legality',
  matchup: 'Matchup',
  mcq: 'MCQ',
  deduction: 'Deduction',
  campaign: 'Campaign',
};

export interface ReviewItem {
  /** `${packId}:${type}:${elementId}` — elementId มาจากฟิลด์ id ใน JSON ไม่ได้มาจากข้อความ */
  id: string;
  packId: string;
  type: ItemType;
  elementId: string;
  kind: 'memory' | 'puzzle';
  /** item ที่มาจาก element เดียวกัน (เช่น การ์ดใบเดียวกัน) ห้ามออกวันเดียวกัน */
  siblingKey: string;
  contentHash: string;
  retired: boolean;
  long: boolean;
  targetSeconds?: number;
  /** หัวข้อสั้น ๆ ของ item (เช่น ชื่อโรค) */
  context?: string;
  /** สำหรับ item ความจำ */
  front?: string;
  back?: string;
}
