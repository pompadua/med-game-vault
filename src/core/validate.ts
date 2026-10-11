import type { z } from 'zod';
import { checkTree, minTreeDepth, treeDepth } from './games/guessWho';
import { extractItems } from './items/extract';
import { migratePack, MigrationError } from './schema/migrate';
import { GAME_MODES, Pack, type GameMode } from './schema/pack';
import type { Taxonomy } from './schema/taxonomy';

export interface ValidationContext {
  taxonomy: Taxonomy;
  /** packId ที่คาดจากชื่อไฟล์ */
  expectedId?: string;
  /** subject ที่คาดจากชื่อโฟลเดอร์ */
  expectedSubject?: string;
  /** เวอร์ชันก่อนหน้า (เช่น จาก git HEAD) เพื่อกันการลบ element id */
  previous?: unknown;
}

export interface ValidationResult {
  pack?: Pack;
  errors: string[];
  warnings: string[];
}

function formatZod(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`);
}

function normalizeTag(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

/** id ทุกตัวใน pack ที่ห้ามหายไป (ต้อง retire แทนการลบ) */
export function collectElementIds(pack: Pack): Set<string> {
  const ids = new Set<string>();
  for (const it of extractItems(pack)) ids.add(`item ${it.id}`);
  for (const c of pack.cards) ids.add(`card ${c.id}`);
  for (const s of pack.meta.sources) ids.add(`source ${s.id}`);
  return ids;
}

const NUMBER_WITH_UNIT = /\d\s*(%|mg|mcg|g\b|mmol|meq|pg\/ml|ng\/ml|mmhg|mm hg|ml|l\/|ms|bpm|kg|iu|units?)/i;

export function validatePack(raw: unknown, ctx: ValidationContext): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let migrated: unknown;
  try {
    migrated = migratePack(raw);
  } catch (e) {
    if (e instanceof MigrationError) return { errors: [e.message], warnings };
    throw e;
  }

  const parsed = Pack.safeParse(migrated);
  if (!parsed.success) return { errors: formatZod(parsed.error), warnings };
  const pack = parsed.data;
  const { meta, rulebook, cards } = pack;

  // ---------- ชื่อไฟล์ / โฟลเดอร์ ----------
  if (ctx.expectedId && meta.id !== ctx.expectedId) {
    errors.push(`meta.id "${meta.id}" ต้องตรงกับชื่อไฟล์ "${ctx.expectedId}.json"`);
  }
  if (ctx.expectedSubject && meta.subject !== ctx.expectedSubject) {
    errors.push(`meta.subject "${meta.subject}" ต้องตรงกับโฟลเดอร์ "${ctx.expectedSubject}"`);
  }

  // ---------- taxonomy ----------
  const tax = ctx.taxonomy;
  if (!tax.subjects.some((s) => s.id === meta.subject)) {
    errors.push(`meta.subject "${meta.subject}" ไม่อยู่ใน content/taxonomy.json`);
  }
  if (!tax.rotations.some((r) => r.id === meta.rotation)) {
    errors.push(`meta.rotation "${meta.rotation}" ไม่อยู่ใน content/taxonomy.json`);
  }
  const tagIds = new Set(tax.tags.map((t) => t.id));
  for (const tag of meta.tags) {
    if (tagIds.has(tag)) continue;
    const n = normalizeTag(tag);
    const aliasHit = tax.tags.find((t) => t.aliases?.some((a) => normalizeTag(a) === n));
    const near = tax.tags.filter((t) => levenshtein(normalizeTag(t.id), n) <= 2).map((t) => t.id);
    const hint = aliasHit
      ? ` — น่าจะหมายถึง "${aliasHit.id}"`
      : near.length
        ? ` — ใกล้กับ: ${near.join(', ')}`
        : ' — ถ้าเป็น tag ใหม่จริง ให้เพิ่มใน taxonomy.json';
    warnings.push(`tag "${tag}" ไม่อยู่ใน taxonomy${hint}`);
  }

  // ---------- id ซ้ำ ----------
  const dupCheck = (label: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`${label}: id "${id}" ซ้ำ`);
      seen.add(id);
    }
  };
  dupCheck('sources', meta.sources.map((s) => s.id));
  dupCheck('pieces', rulebook.pieces.map((p) => p.id));
  dupCheck('coreRules', rulebook.coreRules.map((r) => r.id));
  dupCheck('errata', rulebook.errata.map((e) => e.id));
  dupCheck('cards', cards.map((c) => c.id));
  dupCheck('memorize (ทั้ง pack)', cards.flatMap((c) => c.memorize.map((m) => m.id)));
  dupCheck('exploits', pack.exploits.map((x) => x.id));
  dupCheck('distractorPatterns', pack.distractorPatterns.map((x) => x.id));
  dupCheck('trapPairs', pack.trapPairs.map((x) => x.id));
  dupCheck('games (ทุกโหมดรวมกัน)', GAME_MODES.flatMap((m) => (pack.games[m] ?? []).map((g) => g.id)));
  for (const c of cards) dupCheck(`cards.${c.id}.tells (vs)`, c.tells.map((t) => t.vs));
  dupCheck('review item id', extractItems(pack).map((i) => i.id));

  // ---------- การอ้างอิงข้าม ----------
  const sourceIds = new Set(meta.sources.map((s) => s.id));
  const ruleIds = new Set(rulebook.coreRules.map((r) => r.id));
  const errataIds = new Set(rulebook.errata.map((e) => e.id));
  const cardIds = new Set(cards.map((c) => c.id));
  const trapIds = new Set(pack.trapPairs.map((t) => t.id));

  const needSource = (where: string, id: string | undefined) => {
    if (id !== undefined && !sourceIds.has(id)) errors.push(`${where}: sourceId "${id}" ไม่มีใน meta.sources`);
  };
  const needRule = (where: string, id: string) => {
    if (!ruleIds.has(id)) errors.push(`${where}: ไม่มี core rule id "${id}"`);
  };
  const needCard = (where: string, id: string) => {
    if (!cardIds.has(id)) errors.push(`${where}: ไม่มี card id "${id}"`);
  };
  const checkVariants = (where: string, variants: { sourceId: string }[] | undefined) =>
    variants?.forEach((v, i) => needSource(`${where}.variants[${i}]`, v.sourceId));

  rulebook.coreRules.forEach((r) => {
    r.sourceIds?.forEach((s) => needSource(`coreRules.${r.id}`, s));
    checkVariants(`coreRules.${r.id}`, r.variants);
  });
  rulebook.errata.forEach((e) => {
    needRule(`errata.${e.id}.breaksRule`, e.breaksRule);
    e.sourceIds?.forEach((s) => needSource(`errata.${e.id}`, s));
    checkVariants(`errata.${e.id}`, e.variants);
  });

  for (const c of cards) {
    const where = `cards.${c.id}`;
    needRule(`${where}.trigger.ruleId`, c.trigger.ruleId);
    c.sourceIds?.forEach((s) => needSource(where, s));
    checkVariants(where, c.variants);
    for (const la of c.lookAlikes) {
      needCard(`${where}.lookAlikes`, la);
      if (la === c.id) errors.push(`${where}.lookAlikes: ห้ามอ้างถึงตัวเอง`);
    }
    for (const t of c.tells) {
      needCard(`${where}.tells.vs`, t.vs);
      if (!c.lookAlikes.includes(t.vs)) warnings.push(`${where}.tells: vs "${t.vs}" ไม่อยู่ใน lookAlikes`);
    }
    for (const la of c.lookAlikes) {
      if (!c.tells.some((t) => t.vs === la)) warnings.push(`${where}: lookAlike "${la}" ยังไม่มี tell`);
    }
    for (const m of c.memorize) {
      needSource(`${where}.memorize.${m.id}`, m.sourceId);
      checkVariants(`${where}.memorize.${m.id}`, m.variants);
    }
    const numericText = [c.signature, c.counter, c.danger, c.who, ...c.tells.map((t) => t.feature)].join(' ');
    if (NUMBER_WITH_UNIT.test(numericText) && !c.sourceIds?.length) {
      warnings.push(`${where}: มีตัวเลข/หน่วยในการ์ดแต่ไม่มี sourceIds — ย้ายเป็น memorize[] หรือใส่ sourceIds`);
    }
  }

  for (const x of pack.exploits) {
    if (x.strength === 'heuristic' && !x.exception) {
      warnings.push(`exploits.${x.id}: heuristic ควรระบุ exception หลัก`);
    }
  }
  for (const t of pack.trapPairs) {
    needCard(`trapPairs.${t.id}.a`, t.a);
    needCard(`trapPairs.${t.id}.b`, t.b);
    if (t.a === t.b) errors.push(`trapPairs.${t.id}: a กับ b ต้องต่างกัน`);
  }

  // ---------- games ----------
  const usedModes = GAME_MODES.filter((m) => (pack.games[m]?.length ?? 0) > 0);
  if (usedModes.length < 2 || usedModes.length > 4) {
    warnings.push(`ใช้ ${usedModes.length} โหมดเกม (${usedModes.join(', ') || '-'}) — แนะนำ 2–4 โหมด`);
  }

  const checkBasedOn = (where: string, b: { rules?: string[]; errata?: string[]; trapPairs?: string[] }) => {
    b.rules?.forEach((r) => needRule(`${where}.basedOn.rules`, r));
    b.errata?.forEach((e) => {
      if (!errataIds.has(e)) errors.push(`${where}.basedOn.errata: ไม่มี erratum id "${e}"`);
    });
    b.trapPairs?.forEach((t) => {
      if (!trapIds.has(t)) errors.push(`${where}.basedOn.trapPairs: ไม่มี trap pair id "${t}"`);
    });
  };

  for (const mode of usedModes) {
    const list = (pack.games[mode] ?? []).filter((g) => !g.retired);
    list.forEach((g) => checkBasedOn(`games.${mode}.${g.id}`, g.basedOn));
    if (list.length >= 2) {
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (first.difficulty !== 1) warnings.push(`games.${mode}: ข้อแรก (${first.id}) ควรเป็น difficulty 1 (ชนะได้ด้วย core rules)`);
      if (!last.basedOn.errata?.length && !last.basedOn.trapPairs?.length) {
        warnings.push(`games.${mode}: ข้อท้าย (${last.id}) ควรใช้ errata หรือ trap pair (basedOn)`);
      }
    }
  }
  validateGames(pack, { errors, needRule, needSource });

  // ---------- ห้ามลบ id ----------
  if (ctx.previous !== undefined) {
    let prevPack: Pack | undefined;
    try {
      const prevParsed = Pack.safeParse(migratePack(ctx.previous));
      if (prevParsed.success) prevPack = prevParsed.data;
    } catch {
      prevPack = undefined;
    }
    if (prevPack) {
      const now = collectElementIds(pack);
      for (const id of collectElementIds(prevPack)) {
        if (!now.has(id)) errors.push(`${id} ถูกลบ — ห้ามลบ ให้ติด "retired": true แทน`);
      }
      if (prevPack.meta.id !== pack.meta.id) errors.push(`meta.id เปลี่ยนจาก "${prevPack.meta.id}" — ห้ามเปลี่ยน packId`);
    }
  }

  return { pack: errors.length ? undefined : pack, errors, warnings };
}

interface GameCheckCtx {
  errors: string[];
  needRule: (where: string, id: string) => void;
  needSource: (where: string, id: string | undefined) => void;
}

function validateGames(pack: Pack, { errors, needRule, needSource }: GameCheckCtx): void {
  const g = pack.games;
  const at = (mode: GameMode, id: string) => `games.${mode}.${id}`;

  for (const d of g.deduction ?? []) {
    const w = at('deduction', d.id);
    const clueIds = new Set(d.clues.map((c) => c.id));
    if (clueIds.size !== d.clues.length) errors.push(`${w}: clue id ซ้ำ`);
    for (const c of d.clues) {
      if (!c.strength && !c.lr) errors.push(`${w}.clues.${c.id}: ต้องมี strength หรือ lr (lr ต้องมี sourceId)`);
      if (c.lr) needSource(`${w}.clues.${c.id}.lr`, c.lr.sourceId);
    }
    let cost = 0;
    for (const id of d.optimalLine) {
      const clue = d.clues.find((c) => c.id === id);
      if (!clue) errors.push(`${w}.optimalLine: ไม่มี clue "${id}"`);
      else cost += clue.cost;
    }
    if (cost > d.budget) errors.push(`${w}: optimalLine ใช้ ${cost} แต้ม เกินงบ ${d.budget}`);
    if (!d.diagnosisOptions.some((o) => o.id === d.answer.diagnosis)) errors.push(`${w}.answer.diagnosis ไม่อยู่ใน diagnosisOptions`);
    if (!d.nextStepOptions.some((o) => o.id === d.answer.nextStep)) errors.push(`${w}.answer.nextStep ไม่อยู่ใน nextStepOptions`);
  }

  for (const q of g.guessWho ?? []) {
    const w = at('guessWho', q.id);
    const cands = q.candidates.map((c) => c.id);
    if (new Set(cands).size !== cands.length) errors.push(`${w}: candidate id ซ้ำ`);
    q.candidates.forEach((c) => {
      if (c.cardId && !pack.cards.some((k) => k.id === c.cardId)) errors.push(`${w}.candidates.${c.id}: ไม่มี card "${c.cardId}"`);
    });
    for (const qq of q.questions) {
      for (const y of qq.yes) if (!cands.includes(y)) errors.push(`${w}.questions.${qq.id}: ไม่มี candidate "${y}"`);
    }
    const problems = checkTree(q.optimalTree, cands, q.questions);
    problems.forEach((p) => errors.push(`${w}.optimalTree ${p}`));
    if (!problems.length) {
      const best = minTreeDepth(cands, q.questions);
      const depth = treeDepth(q.optimalTree);
      if (depth !== best) errors.push(`${w}.optimalTree ลึก ${depth} ชั้น แต่ทำได้ ${best} ชั้น — แก้ให้เป็น tree ที่ตื้นที่สุดจริง`);
    }
  }

  for (const e of g.engine ?? []) {
    const w = at('engine', e.id);
    if (!e.cells.some((c) => c.counterIntuitive)) errors.push(`${w}: ต้องมีช่อง counterIntuitive อย่างน้อย 1 ช่อง`);
    e.cells.forEach((c) => c.ruleId && needRule(`${w}.cells.${c.id}`, c.ruleId));
    if (new Set(e.cells.map((c) => c.id)).size !== e.cells.length) errors.push(`${w}: cell id ซ้ำ`);
  }

  for (const l of g.legality ?? []) {
    const w = at('legality', l.id);
    if (!l.options.some((o) => o.id === l.answer)) errors.push(`${w}.answer ไม่อยู่ใน options`);
    l.ruleIds.forEach((r) => needRule(w, r));
  }

  for (const c of g.campaign ?? []) {
    const w = at('campaign', c.id);
    needSource(`${w}.guidelineSourceId`, c.guidelineSourceId);
    const turnIds = new Set(c.turns.map((t) => t.id));
    if (!turnIds.has(c.startTurn)) errors.push(`${w}.startTurn ไม่มี turn "${c.startTurn}"`);
    for (const t of c.turns) {
      if (!t.choices.some((ch) => ch.quality === 'best')) errors.push(`${w}.turns.${t.id}: ต้องมีตัวเลือก best อย่างน้อย 1`);
      for (const ch of t.choices) {
        if (ch.next !== null && !turnIds.has(ch.next)) errors.push(`${w}.turns.${t.id}.${ch.id}: next "${ch.next}" ไม่มีอยู่`);
      }
    }
    // เส้นทาง best ต้องจบได้ (ไม่วนลูป)
    const seen = new Set<string>();
    let cur: string | null = c.startTurn;
    while (cur !== null && turnIds.has(cur)) {
      if (seen.has(cur)) {
        errors.push(`${w}: เส้นทาง best วนลูปที่ turn "${cur}"`);
        break;
      }
      seen.add(cur);
      const turn = c.turns.find((t) => t.id === cur);
      cur = turn?.choices.find((ch) => ch.quality === 'best')?.next ?? null;
    }
  }

  for (const m of g.matchups ?? []) {
    const w = at('matchups', m.id);
    const conds = m.conditions.map((c) => c.id);
    for (const row of m.rows) {
      const got = row.cells.map((c) => c.condition).sort();
      const want = [...conds].sort();
      if (got.join() !== want.join()) errors.push(`${w}.rows.${row.id}: ต้องมี cell ครบทุก condition พอดี (${want.join(', ')})`);
      row.cells.forEach((cell) => needSource(`${w}.rows.${row.id}.${cell.condition}`, cell.sourceId));
    }
    if (new Set(m.rows.map((r) => r.id)).size !== m.rows.length) errors.push(`${w}: row id ซ้ำ`);
  }

  for (const s of g.speedrun ?? []) needSource(at('speedrun', s.id), s.sourceId);

  for (const q of g.mcq ?? []) {
    const w = at('mcq', q.id);
    const keys = q.options.map((o) => o.key).sort().join('');
    if (keys !== 'ABCDE') errors.push(`${w}: ตัวเลือกต้องเป็น A–E ไม่ซ้ำ`);
    for (const o of q.options) {
      if (o.key !== q.answer && !o.why) errors.push(`${w}.options.${o.key}: ตัวหลอกต้องมีเหตุผลที่ตัดทิ้ง (why)`);
    }
  }
}
