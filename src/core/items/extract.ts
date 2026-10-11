import { contentHash } from '../hash';
import { GAME_MODES, type Pack, type GameMode } from '../schema/pack';
import { LONG_ITEM_TYPES, MEMORY_ITEM_TYPES, type ItemType, type ReviewItem } from './types';

const MEMORY = new Set<ItemType>(MEMORY_ITEM_TYPES);

/** ตัวคั่น elementId ของ tell: `${cardId}~${vsCardId}` */
export const TELL_SEP = '~';
/** ตัวคั่น elementId ของแถว matchup: `${gridId}.${rowId}` */
export const MATCHUP_SEP = '.';

export function itemId(packId: string, type: ItemType, elementId: string): string {
  return `${packId}:${type}:${elementId}`;
}

export function parseItemId(id: string): { packId: string; type: ItemType; elementId: string } {
  const [packId, type, ...rest] = id.split(':');
  return { packId: packId ?? '', type: type as ItemType, elementId: rest.join(':') };
}

const GAME_ITEM_TYPE: Record<GameMode, ItemType> = {
  deduction: 'deduction',
  guessWho: 'guessWho',
  engine: 'engine',
  legality: 'legality',
  campaign: 'campaign',
  matchups: 'matchup',
  speedrun: 'speedrun',
  mcq: 'mcq',
};

function omitRetired<T extends { retired?: boolean }>(el: T): Omit<T, 'retired'> {
  const { retired: _r, ...rest } = el;
  return rest;
}

/**
 * แตก pack เป็น review items แบบ deterministic: input เดิม → output เดิมเสมอ
 * และผลลัพธ์เรียงตาม id (ไม่ขึ้นกับลำดับใน array ของ JSON)
 */
export function extractItems(pack: Pack): ReviewItem[] {
  const packId = pack.meta.id;
  const out: ReviewItem[] = [];
  const cardName = new Map(pack.cards.map((c) => [c.id, c.name]));
  const ruleText = new Map(pack.rulebook.coreRules.map((r) => [r.id, r.rule]));

  const push = (
    type: ItemType,
    elementId: string,
    siblingKey: string,
    hashed: unknown,
    retired: boolean | undefined,
    extra: Partial<ReviewItem> = {},
  ) => {
    out.push({
      id: itemId(packId, type, elementId),
      packId,
      type,
      elementId,
      kind: MEMORY.has(type) ? 'memory' : 'puzzle',
      siblingKey: `${packId}:${siblingKey}`,
      contentHash: contentHash(hashed),
      retired: retired === true,
      long: LONG_ITEM_TYPES.includes(type),
      ...extra,
    });
  };

  for (const r of pack.rulebook.coreRules) {
    push('rule', r.id, `rule:${r.id}`, omitRetired(r), r.retired, {
      context: 'กฎหลัก',
      front: `ข้อเท็จจริงเหล่านี้มาจากกฎข้อไหน?\n${r.generates.map((g) => `• ${g}`).join('\n')}`,
      back: r.rule,
    });
  }

  for (const e of pack.rulebook.errata) {
    const rule = ruleText.get(e.breaksRule) ?? e.breaksRule;
    push('erratum', e.id, `rule:${e.breaksRule}`, { ...omitRetired(e), rule }, e.retired, {
      context: 'ข้อยกเว้น',
      front: `กฎ: “${rule}”\nข้อยกเว้น (errata) ที่ฝ่าฝืนกฎนี้คืออะไร?`,
      back: e.text,
    });
  }

  for (const c of pack.cards) {
    const sib = `card:${c.id}`;
    const base = { name: c.name, who: c.who };
    push('signature', c.id, sib, { ...base, signature: c.signature }, c.retired, {
      context: c.name,
      front: `${c.name}: signature move (finding ที่จำเพาะที่สุด) คืออะไร?`,
      back: `${c.signature}\n\nผู้ป่วยแบบฉบับ: ${c.who}`,
    });
    push('counter', c.id, sib, { ...base, counter: c.counter }, c.retired, {
      context: c.name,
      front: `${c.name}: counter (first-line management) คืออะไร?`,
      back: c.counter,
    });
    push('danger', c.id, sib, { ...base, danger: c.danger }, c.retired, {
      context: c.name,
      front: `${c.name}: danger (ภาวะแทรกซ้อน/ทางแพ้ที่ต้องระวัง) คืออะไร?`,
      back: c.danger,
    });
    for (const t of c.tells) {
      const vsName = cardName.get(t.vs) ?? t.vs;
      push('tell', `${c.id}${TELL_SEP}${t.vs}`, sib, { card: c.name, vs: vsName, feature: t.feature }, c.retired || t.retired, {
        context: `${c.name} vs ${vsName}`,
        front: `${c.name} vs ${vsName}: feature ไหนแยกสองโรคนี้ได้?`,
        back: t.feature,
      });
    }
    for (const m of c.memorize) {
      push('memorize', m.id, sib, { card: c.name, ...omitRetired(m) }, c.retired || m.retired, {
        context: `${c.name} · ค่าจำ`,
        front: m.prompt,
        back: m.fact,
      });
    }
  }

  for (const x of pack.exploits) {
    push('exploit', x.id, `exploit:${x.id}`, omitRetired(x), x.retired, {
      context: x.strength === 'rule' ? 'ช่องโหว่ (rule)' : 'ช่องโหว่ (heuristic)',
      front: `ถ้าเห็น: ${x.ifSee}\n→ คิดถึงอะไร?`,
      back: x.exception ? `${x.think}\n\nข้อยกเว้น: ${x.exception}` : x.think,
    });
  }

  for (const d of pack.distractorPatterns) {
    push('distractor', d.id, `distractor:${d.id}`, omitRetired(d), d.retired, {
      context: 'ตัวหลอก',
      front: `ตัวหลอกแบบนี้: ${d.pattern}\nฆ่าตัวเลือกนี้ยังไง?`,
      back: d.kill,
    });
  }

  for (const p of pack.trapPairs) {
    const a = cardName.get(p.a) ?? p.a;
    const b = cardName.get(p.b) ?? p.b;
    push('trapPair', p.id, `trap:${p.id}`, { a, b, decider: p.decider }, p.retired, {
      context: `${a} vs ${b}`,
      front: `Trap pair: ${a} vs ${b}\nตัวตัดสิน (decider) คืออะไร?`,
      back: p.decider,
    });
  }

  for (const mode of GAME_MODES) {
    const list = pack.games[mode];
    if (!list) continue;
    const type = GAME_ITEM_TYPE[mode];
    for (const g of list) {
      if (mode === 'matchups') {
        const grid = g as NonNullable<Pack['games']['matchups']>[number];
        for (const row of grid.rows) {
          const conditions = grid.conditions.map((c) => c.label);
          push(type, `${grid.id}${MATCHUP_SEP}${row.id}`, `game:${grid.id}`, { conditions, ...omitRetired(row) }, grid.retired || row.retired, {
            context: `${grid.title} · ${row.drug}`,
            targetSeconds: grid.targetSeconds,
          });
        }
        continue;
      }
      push(type, g.id, `game:${g.id}`, omitRetired(g), g.retired, {
        context: 'title' in g ? g.title : undefined,
        targetSeconds: g.targetSeconds,
      });
    }
  }

  return out.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

export function countByType(items: ReviewItem[]): Partial<Record<ItemType, number>> {
  const counts: Partial<Record<ItemType, number>> = {};
  for (const it of items) {
    if (it.retired) continue;
    counts[it.type] = (counts[it.type] ?? 0) + 1;
  }
  return counts;
}
