import { z } from 'zod';

/**
 * Schema ของ game pack — ใช้ร่วมกันทั้งสคริปต์ (validate/build:index) และแอป
 * กฎเหล็ก: ทุก element ที่จะกลายเป็น review item มี `id` แบบ slug ที่ตั้งครั้งเดียวแล้วห้ามเปลี่ยน
 * ถ้าความหมายเปลี่ยนจริง ให้ตั้ง id ใหม่ แล้วติด `retired: true` ที่ของเก่า (ห้ามลบ)
 */

export const CURRENT_PACK_SCHEMA_VERSION = 1 as const;

export const Slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'ต้องเป็น kebab-case slug (a-z, 0-9, -)');
const Text = z.string().trim().min(1, 'ห้ามว่าง');
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ต้องเป็นวันที่ YYYY-MM-DD');
const Seconds = z.number().int().positive();

/**
 * แนวทางต่างกันตามภูมิภาค (ไทย / สหรัฐฯ / ยุโรป / สากล): เก็บทุกแบบ
 * และติด examLikely ที่แบบที่ข้อสอบไทยน่าจะยึด
 */
export const Variant = z.object({
  region: z.enum(['TH', 'US', 'EU', 'intl']),
  text: Text,
  sourceId: Slug,
  examLikely: z.boolean().optional(),
});

const elementBase = {
  id: Slug,
  retired: z.boolean().optional(),
};

/** ข้อความที่ตัดทอนให้ง่ายขึ้น ต้องติดป้าย rule of thumb */
const annotations = {
  ruleOfThumb: z.boolean().optional(),
  variants: z.array(Variant).optional(),
};

// ---------- meta ----------

export const SourceType = z.enum([
  'guideline',
  'thai-guideline',
  'statpearls',
  'review',
  'article',
  'textbook',
  'other',
]);

export const Source = z.object({
  id: Slug,
  title: Text,
  url: z.url(),
  type: SourceType,
  accessedAt: IsoDate,
});

export const PackStatus = z.enum(['draft', 'verified', 'needs-audit']);

export const Meta = z.object({
  id: Slug,
  title: Text,
  subject: Slug,
  rotation: Slug,
  tags: z.array(Slug),
  status: PackStatus,
  schemaVersion: z.literal(CURRENT_PACK_SCHEMA_VERSION),
  createdAt: IsoDate,
  verifiedAt: IsoDate.nullable(),
  sources: z.array(Source).min(1, 'ต้องมีแหล่งอ้างอิงอย่างน้อย 1 รายการ'),
});

// ---------- rulebook ----------

export const Piece = z.object({ id: Slug, name: Text, role: Text });

export const CoreRule = z.object({
  ...elementBase,
  ...annotations,
  rule: Text,
  generates: z.array(Text).min(1, 'กฎต้องระบุว่าให้กำเนิดข้อเท็จจริงอะไรบ้าง'),
  sourceIds: z.array(Slug).optional(),
});

export const Erratum = z.object({
  ...elementBase,
  ...annotations,
  text: Text,
  breaksRule: Slug,
  sourceIds: z.array(Slug).optional(),
});

export const Rulebook = z.object({
  board: Text,
  pieces: z.array(Piece).min(1),
  coreRules: z.array(CoreRule).min(1),
  winConditions: z.array(Text).min(1),
  loseConditions: z.array(Text).min(1),
  errata: z.array(Erratum),
});

// ---------- cards ----------

export const Tell = z.object({
  vs: Slug,
  feature: Text,
  retired: z.boolean().optional(),
});

export const MemorizeFact = z.object({
  ...elementBase,
  variants: z.array(Variant).optional(),
  /** หน้าการ์ด: คำถาม */
  prompt: Text,
  /** หลังการ์ด: ข้อเท็จจริงที่ต้องจำ */
  fact: Text,
  /** ค่าจำทุกข้อต้องมีแหล่งอ้างอิง ห้ามแต่งตัวเลขเอง */
  sourceId: Slug,
});

export const Card = z.object({
  ...elementBase,
  ...annotations,
  name: Text,
  who: Text,
  trigger: z.object({ ruleId: Slug, text: Text }),
  signature: Text,
  lookAlikes: z.array(Slug),
  tells: z.array(Tell),
  counter: Text,
  danger: Text,
  memorize: z.array(MemorizeFact),
  sourceIds: z.array(Slug).optional(),
});

// ---------- exploit sheet ----------

export const Exploit = z.object({
  ...elementBase,
  ifSee: Text,
  think: Text,
  strength: z.enum(['rule', 'heuristic']),
  exception: Text.optional(),
});

export const DistractorPattern = z.object({
  ...elementBase,
  pattern: Text,
  kill: Text,
});

export const TrapPair = z.object({
  ...elementBase,
  /** card id ทั้งสองฝั่ง */
  a: Slug,
  b: Slug,
  decider: Text,
});

// ---------- games ----------

/** ข้อในเกมอ้างอิงว่าใช้กฎ/errata/trap pair ใด — ใช้ตรวจการไต่ระดับความยาก */
export const BasedOn = z.object({
  rules: z.array(Slug).optional(),
  errata: z.array(Slug).optional(),
  trapPairs: z.array(Slug).optional(),
});

const gameBase = {
  ...elementBase,
  targetSeconds: Seconds,
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  basedOn: BasedOn,
  hint: Text.optional(),
};

const Option = z.object({ id: Slug, label: Text });

export const ClueStrength = z.enum(['strong', 'moderate', 'weak']);
export const ClueKind = z.enum(['history', 'pe', 'bedside', 'lab', 'imaging']);

export const DeductionClue = z.object({
  id: Slug,
  kind: ClueKind,
  cost: z.number().int().positive(),
  label: Text,
  reveals: Text,
  /** ใช้ LR เฉพาะเมื่อมีแหล่งอ้างอิง ไม่งั้นใช้ strength */
  strength: ClueStrength.optional(),
  lr: z.object({ value: z.number().positive(), sourceId: Slug }).optional(),
  why: Text,
});

export const Deduction = z.object({
  ...gameBase,
  title: Text,
  chiefComplaint: Text,
  vitals: Text.optional(),
  budget: z.number().int().positive(),
  clues: z.array(DeductionClue).min(2),
  diagnosisOptions: z.array(Option).min(2),
  nextStepOptions: z.array(Option).min(2),
  answer: z.object({ diagnosis: Slug, nextStep: Slug }),
  optimalLine: z.array(Slug).min(1),
  explanation: Text,
});

export type TreeNode = { leaf: string } | { question: string; yes: TreeNode; no: TreeNode };
export const TreeNode: z.ZodType<TreeNode> = z.lazy(() =>
  z.union([
    z.object({ leaf: Slug }),
    z.object({ question: Slug, yes: TreeNode, no: TreeNode }),
  ]),
);

export const GuessWho = z.object({
  ...gameBase,
  title: Text,
  candidates: z
    .array(z.object({ id: Slug, label: Text, cardId: Slug.optional() }))
    .min(4, 'guessWho ต้องมี 4–8 โรค')
    .max(8, 'guessWho ต้องมี 4–8 โรค'),
  /** คำถาม yes/no ที่ผู้เล่นเลือกใช้ได้ — `yes` คือ candidate ที่ตอบว่าใช่ */
  questions: z.array(z.object({ id: Slug, text: Text, yes: z.array(Slug) })).min(2),
  optimalTree: TreeNode,
  explanation: Text,
});

export const Direction = z.enum(['up', 'down', 'same']);

export const Engine = z.object({
  ...gameBase,
  perturbation: Text,
  equation: Text.optional(),
  cells: z
    .array(
      z.object({
        id: Slug,
        variable: Text,
        answer: Direction,
        why: Text,
        ruleId: Slug.optional(),
        counterIntuitive: z.boolean().optional(),
      }),
    )
    .min(2),
});

export const Legality = z.object({
  ...gameBase,
  case: Text,
  question: Text,
  options: z.array(Option).min(2),
  answer: Slug,
  ruleIds: z.array(Slug).min(1),
  why: Text,
});

export const CampaignChoice = z.object({
  id: Slug,
  label: Text,
  /** null = จบ campaign */
  next: Slug.nullable(),
  quality: z.enum(['best', 'ok', 'harmful']),
  feedback: Text,
});

export const Campaign = z.object({
  ...gameBase,
  title: Text,
  guidelineSourceId: Slug,
  intro: Text,
  startTurn: Slug,
  turns: z.array(z.object({ id: Slug, state: Text, choices: z.array(CampaignChoice).min(2) })).min(1),
  guidelineSequence: z.array(Text).min(1),
});

export const MatchupVerdict = z.enum(['legal', 'illegal', 'combo']);

export const Matchups = z.object({
  ...gameBase,
  title: Text,
  conditions: z.array(Option).min(2),
  rows: z
    .array(
      z.object({
        id: Slug,
        retired: z.boolean().optional(),
        drug: Text,
        cells: z.array(
          z.object({
            condition: Slug,
            verdict: MatchupVerdict,
            why: Text,
            sourceId: Slug.optional(),
          }),
        ),
      }),
    )
    .min(1),
});

export const Speedrun = z.object({
  ...gameBase,
  prompt: Text,
  answer: Text,
  sourceId: Slug.optional(),
});

export const McqKey = z.enum(['A', 'B', 'C', 'D', 'E']);

export const Mcq = z.object({
  ...gameBase,
  stem: Text,
  options: z
    .array(z.object({ key: McqKey, text: Text, why: Text.optional() }))
    .length(5, 'MCQ ต้องมี 5 ตัวเลือก A–E'),
  answer: McqKey,
  tell: Text,
  explanation: Text,
});

export const Games = z
  .object({
    deduction: z.array(Deduction).optional(),
    guessWho: z.array(GuessWho).optional(),
    engine: z.array(Engine).optional(),
    legality: z.array(Legality).optional(),
    campaign: z.array(Campaign).optional(),
    matchups: z.array(Matchups).optional(),
    speedrun: z.array(Speedrun).optional(),
    mcq: z.array(Mcq).optional(),
  })
  .strict();

export const GAME_MODES = [
  'deduction',
  'guessWho',
  'engine',
  'legality',
  'campaign',
  'matchups',
  'speedrun',
  'mcq',
] as const;
export type GameMode = (typeof GAME_MODES)[number];

// ---------- pack ----------

export const Pack = z
  .object({
    meta: Meta,
    rulebook: Rulebook,
    cards: z.array(Card).min(1),
    exploits: z.array(Exploit),
    distractorPatterns: z.array(DistractorPattern),
    trapPairs: z.array(TrapPair),
    games: Games,
  })
  .strict();

export type Pack = z.infer<typeof Pack>;
export type Meta = z.infer<typeof Meta>;
export type Source = z.infer<typeof Source>;
export type CoreRule = z.infer<typeof CoreRule>;
export type Erratum = z.infer<typeof Erratum>;
export type Card = z.infer<typeof Card>;
export type Tell = z.infer<typeof Tell>;
export type MemorizeFact = z.infer<typeof MemorizeFact>;
export type Exploit = z.infer<typeof Exploit>;
export type DistractorPattern = z.infer<typeof DistractorPattern>;
export type TrapPair = z.infer<typeof TrapPair>;
export type Deduction = z.infer<typeof Deduction>;
export type GuessWho = z.infer<typeof GuessWho>;
export type Engine = z.infer<typeof Engine>;
export type Legality = z.infer<typeof Legality>;
export type Campaign = z.infer<typeof Campaign>;
export type Matchups = z.infer<typeof Matchups>;
export type Speedrun = z.infer<typeof Speedrun>;
export type Mcq = z.infer<typeof Mcq>;
export type Games = z.infer<typeof Games>;
export type PackStatus = z.infer<typeof PackStatus>;
