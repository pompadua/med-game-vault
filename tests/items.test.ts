import { describe, expect, it } from 'vitest';
import { contentHash, stableStringify } from '../src/core/hash';
import { extractItems, parseItemId } from '../src/core/items/extract';
import { Pack } from '../src/core/schema/pack';
import { samplePack } from './helpers';

const extract = (raw: unknown) => extractItems(Pack.parse(raw));

describe('stableStringify / contentHash', () => {
  it('ลำดับ key ไม่มีผล', () => {
    expect(stableStringify({ a: 1, b: [1, { y: 2, x: 1 }] })).toBe(stableStringify({ b: [1, { x: 1, y: 2 }], a: 1 }));
    expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }));
  });

  it('เนื้อหาเปลี่ยน → hash เปลี่ยน, ภาษาไทยไม่พัง', () => {
    expect(contentHash({ t: 'หัวใจล้มเหลว' })).not.toBe(contentHash({ t: 'หัวใจล้มเหลว ' }));
    expect(contentHash('x')).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('extractItems', () => {
  it('deterministic: เรียกซ้ำได้ผลเดิมทุกครั้ง', () => {
    expect(extract(samplePack())).toEqual(extract(samplePack()));
  });

  it('ID อยู่ในรูป packId:type:elementId และไม่ซ้ำ', () => {
    const items = extract(samplePack());
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const it of items) {
      const parsed = parseItemId(it.id);
      expect(parsed).toEqual({ packId: 'cardio-heart-failure', type: it.type, elementId: it.elementId });
    }
    expect(ids).toContain('cardio-heart-failure:tell:hfref~hfmref');
    expect(ids).toContain('cardio-heart-failure:matchup:mu-hfref-drugs.arni');
    expect(ids).toContain('cardio-heart-failure:memorize:arni-acei-washout');
  });

  it('แก้ถ้อยคำ → ID เดิม แต่ contentHash เปลี่ยน', () => {
    const before = extract(samplePack());
    const p = samplePack();
    p.cards[0].memorize[0].fact = 'LVEF ≤ 40 เปอร์เซ็นต์';
    p.rulebook.coreRules[0].rule += ' (แก้ถ้อยคำ)';
    const after = extract(p);
    expect(after.map((i) => i.id)).toEqual(before.map((i) => i.id));
    const changed = after.filter((a, i) => a.contentHash !== before[i]!.contentHash).map((i) => i.id);
    expect(changed).toContain('cardio-heart-failure:memorize:ef-cutoff-hfref');
    expect(changed).toContain('cardio-heart-failure:rule:frank-starling');
    // erratum แสดงข้อความกฎที่มันฝ่าฝืนบนหน้าการ์ด จึงถือว่าเนื้อหาอัปเดตด้วย
    expect(changed).toContain('cardio-heart-failure:erratum:hfpef-preload-dependent');
    expect(changed).toHaveLength(3);
  });

  it('สลับลำดับการ์ด / กฎ / tells / เกม → ID และ hash เหมือนเดิม', () => {
    const before = extract(samplePack());
    const p = samplePack();
    p.cards.reverse();
    p.rulebook.coreRules.reverse();
    p.cards.forEach((c: { tells: unknown[]; memorize: unknown[] }) => {
      c.tells.reverse();
      c.memorize.reverse();
    });
    p.games.mcq.reverse();
    p.games.matchups[0].rows.reverse();
    expect(extract(p)).toEqual(before);
  });

  it('retired → item ยังอยู่ (ประวัติไม่หาย) แต่ติด retired', () => {
    const p = samplePack();
    p.cards[0].retired = true;
    const items = extract(p).filter((i) => i.siblingKey === 'cardio-heart-failure:card:hfref');
    expect(items.length).toBeGreaterThan(3);
    expect(items.every((i) => i.retired)).toBe(true);
  });

  it('item จากการ์ดเดียวกันมี siblingKey เดียวกัน', () => {
    const items = extract(samplePack()).filter((i) => i.siblingKey === 'cardio-heart-failure:card:hfref');
    const types = new Set(items.map((i) => i.type));
    expect([...types].sort()).toEqual(['counter', 'danger', 'memorize', 'signature', 'tell']);
  });

  it('item ความจำมีหน้า/หลังการ์ด, item ปริศนามี targetSeconds', () => {
    for (const it of extract(samplePack())) {
      if (it.kind === 'memory') {
        expect(it.front, it.id).toBeTruthy();
        expect(it.back, it.id).toBeTruthy();
      } else {
        expect(it.targetSeconds, it.id).toBeGreaterThan(0);
      }
    }
  });

  it('deduction/campaign ถูกติด long', () => {
    const p = samplePack();
    p.games.deduction = [
      {
        id: 'ded-x',
        targetSeconds: 300,
        difficulty: 1,
        basedOn: {},
        title: 't',
        chiefComplaint: 'c',
        budget: 10,
        clues: [
          { id: 'a', kind: 'history', cost: 1, label: 'a', reveals: 'a', strength: 'weak', why: 'a' },
          { id: 'b', kind: 'lab', cost: 4, label: 'b', reveals: 'b', strength: 'strong', why: 'b' },
        ],
        diagnosisOptions: [
          { id: 'x', label: 'x' },
          { id: 'y', label: 'y' },
        ],
        nextStepOptions: [
          { id: 'x', label: 'x' },
          { id: 'y', label: 'y' },
        ],
        answer: { diagnosis: 'x', nextStep: 'x' },
        optimalLine: ['b'],
        explanation: 'e',
      },
    ];
    const ded = extract(p).find((i) => i.type === 'deduction');
    expect(ded?.long).toBe(true);
  });
});
