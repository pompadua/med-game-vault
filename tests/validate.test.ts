import { describe, expect, it } from 'vitest';
import { validatePack } from '../src/core/validate';
import { readJsonFile, samplePack, taxonomy } from './helpers';

const ctx = { taxonomy, expectedId: 'cardio-heart-failure', expectedSubject: 'cardio' };

function errorsOf(pack: unknown, extra: Partial<typeof ctx> & { previous?: unknown } = {}) {
  return validatePack(pack, { ...ctx, ...extra }).errors;
}

describe('validatePack', () => {
  it('sample pack ไม่มี error และไม่มี warning', () => {
    const res = validatePack(samplePack(), ctx);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
    expect(res.pack?.meta.id).toBe('cardio-heart-failure');
  });

  it('card id ซ้ำ → error', () => {
    const p = samplePack();
    p.cards[1].id = p.cards[0].id;
    expect(errorsOf(p).some((e) => e.includes('cards') && e.includes('ซ้ำ'))).toBe(true);
  });

  it('memorize id ซ้ำข้ามการ์ด → error', () => {
    const p = samplePack();
    p.cards[1].memorize[0].id = p.cards[0].memorize[0].id;
    expect(errorsOf(p).some((e) => e.includes('memorize') && e.includes('ซ้ำ'))).toBe(true);
  });

  it('game id ซ้ำข้ามโหมด → error', () => {
    const p = samplePack();
    p.games.mcq[0].id = p.games.engine[0].id;
    expect(errorsOf(p).some((e) => e.includes('games') && e.includes('ซ้ำ'))).toBe(true);
  });

  it('meta.id ไม่ตรงชื่อไฟล์ → error', () => {
    expect(errorsOf(samplePack(), { expectedId: 'other-name' }).some((e) => e.includes('ชื่อไฟล์'))).toBe(true);
  });

  it('subject ไม่ตรงโฟลเดอร์ → error', () => {
    expect(errorsOf(samplePack(), { expectedSubject: 'nephro' }).some((e) => e.includes('โฟลเดอร์'))).toBe(true);
  });

  it('memorize อ้าง sourceId ที่ไม่มี → error', () => {
    const p = samplePack();
    p.cards[0].memorize[0].sourceId = 'made-up-source';
    expect(errorsOf(p).some((e) => e.includes('made-up-source'))).toBe(true);
  });

  it('trigger อ้าง rule ที่ไม่มี → error', () => {
    const p = samplePack();
    p.cards[0].trigger.ruleId = 'no-such-rule';
    expect(errorsOf(p).some((e) => e.includes('no-such-rule'))).toBe(true);
  });

  it('erratum breaksRule ที่ไม่มี → error', () => {
    const p = samplePack();
    p.rulebook.errata[0].breaksRule = 'ghost-rule';
    expect(errorsOf(p).some((e) => e.includes('ghost-rule'))).toBe(true);
  });

  it('lookAlike/trapPair อ้างการ์ดที่ไม่มี → error', () => {
    const p = samplePack();
    p.cards[0].lookAlikes.push('ghost-card');
    p.trapPairs[0].b = 'ghost-card-2';
    const errors = errorsOf(p);
    expect(errors.some((e) => e.includes('ghost-card'))).toBe(true);
    expect(errors.some((e) => e.includes('ghost-card-2'))).toBe(true);
  });

  it('subject ที่ไม่อยู่ใน taxonomy → error', () => {
    const p = samplePack();
    p.meta.subject = 'astrology';
    expect(errorsOf(p, { expectedSubject: 'astrology' }).some((e) => e.includes('taxonomy'))).toBe(true);
  });

  it('tag ที่เป็น alias → warning พร้อมเสนอ tag ที่ถูก', () => {
    const p = samplePack();
    p.meta.tags.push('hf');
    const res = validatePack(p, ctx);
    expect(res.errors).toEqual([]);
    expect(res.warnings.some((w) => w.includes('"hf"') && w.includes('heart-failure'))).toBe(true);
  });

  it('engine ไม่มีช่อง counterIntuitive → error', () => {
    const p = samplePack();
    for (const c of p.games.engine[0].cells) delete c.counterIntuitive;
    expect(errorsOf(p).some((e) => e.includes('counterIntuitive'))).toBe(true);
  });

  it('mcq ตัวหลอกไม่มี why → error', () => {
    const p = samplePack();
    const wrong = p.games.mcq[0].options.find((o: { key: string }) => o.key !== p.games.mcq[0].answer);
    delete wrong.why;
    expect(errorsOf(p).some((e) => e.includes('why'))).toBe(true);
  });

  it('matchup row ขาด cell ของบาง condition → error', () => {
    const p = samplePack();
    p.games.matchups[0].rows[0].cells.pop();
    expect(errorsOf(p).some((e) => e.includes('cell ครบ'))).toBe(true);
  });

  it('ลบ element id ที่เคยมีใน git HEAD → error (ต้อง retire แทน)', () => {
    const previous = samplePack();
    const p = samplePack();
    p.cards[0].memorize.splice(0, 1);
    expect(errorsOf(p, { previous }).some((e) => e.includes('ถูกลบ'))).toBe(true);
  });

  it('retire แทนการลบ → ผ่าน', () => {
    const previous = samplePack();
    const p = samplePack();
    p.cards[0].memorize[0].retired = true;
    expect(errorsOf(p, { previous })).toEqual([]);
  });

  it('schemaVersion ใหม่กว่าที่รองรับ → error', () => {
    const p = samplePack();
    p.meta.schemaVersion = 99;
    expect(errorsOf(p)[0]).toContain('ใหม่กว่า');
  });
});

describe('fixture ทุกโหมด', () => {
  it('tests/fixtures/demo-all-modes.json ผ่าน validator (ไม่มี error)', () => {
    const res = validatePack(readJsonFile('tests/fixtures/demo-all-modes.json'), { taxonomy });
    expect(res.errors).toEqual([]);
  });
});

describe('validatePack: games เพิ่มเติม', () => {
  const gw = (tree: unknown) => ({
    id: 'gw-ef',
    targetSeconds: 60,
    difficulty: 1,
    basedOn: { rules: ['ef-sorting'] },
    title: 'แยก phenotype',
    candidates: [
      { id: 'ref', label: 'HFrEF', cardId: 'hfref' },
      { id: 'mref', label: 'HFmrEF', cardId: 'hfmref' },
      { id: 'pef', label: 'HFpEF', cardId: 'hfpef' },
      { id: 'impef', label: 'HFimpEF', cardId: 'hfimpef' },
    ],
    questions: [
      { id: 'now-le-40', text: 'EF ตอนนี้ ≤40%?', yes: ['ref'] },
      { id: 'ever-le-40', text: 'เคยมี EF ≤40%?', yes: ['ref', 'impef'] },
      { id: 'now-ge-50', text: 'EF ตอนนี้ ≥50%?', yes: ['pef'] },
    ],
    optimalTree: tree,
    explanation: 'x',
  });

  it('guessWho tree ที่ตื้นที่สุดจริง → ผ่าน', () => {
    const p = samplePack();
    p.games.guessWho = [
      gw({
        question: 'ever-le-40',
        yes: { question: 'now-le-40', yes: { leaf: 'ref' }, no: { leaf: 'impef' } },
        no: { question: 'now-ge-50', yes: { leaf: 'pef' }, no: { leaf: 'mref' } },
      }),
    ];
    expect(errorsOf(p)).toEqual([]);
  });

  it('guessWho tree ที่ไม่ใช่ optimal → error', () => {
    const p = samplePack();
    p.games.guessWho = [
      gw({
        question: 'now-le-40',
        yes: { leaf: 'ref' },
        no: {
          question: 'now-ge-50',
          yes: { leaf: 'pef' },
          no: { question: 'ever-le-40', yes: { leaf: 'impef' }, no: { leaf: 'mref' } },
        },
      }),
    ];
    // tree นี้แยกได้ครบแต่ลึก 3 ชั้น ทั้งที่เริ่มด้วย ever-le-40 ทำได้ 2 ชั้น
    expect(errorsOf(p).some((e) => e.includes('ตื้นที่สุด'))).toBe(true);
  });

  it('guessWho tree ที่แยกไม่ครบ → error', () => {
    const p = samplePack();
    p.games.guessWho = [gw({ question: 'now-le-40', yes: { leaf: 'ref' }, no: { leaf: 'pef' } })];
    expect(errorsOf(p).some((e) => e.includes('แยกไม่ออก'))).toBe(true);
  });

  it('deduction optimalLine เกินงบ → error', () => {
    const p = samplePack();
    p.games.deduction = [
      {
        id: 'ded-1',
        targetSeconds: 300,
        difficulty: 1,
        basedOn: {},
        title: 'เหนื่อย',
        chiefComplaint: 'เหนื่อย 2 สัปดาห์',
        budget: 3,
        clues: [
          { id: 'orthopnea', kind: 'history', cost: 1, label: 'ถาม orthopnea', reveals: 'มี', strength: 'moderate', why: 'x' },
          { id: 'echo', kind: 'imaging', cost: 5, label: 'echo', reveals: 'EF 30%', strength: 'strong', why: 'x' },
        ],
        diagnosisOptions: [
          { id: 'hfref', label: 'HFrEF' },
          { id: 'copd', label: 'COPD' },
        ],
        nextStepOptions: [
          { id: 'gdmt', label: 'GDMT' },
          { id: 'abx', label: 'antibiotic' },
        ],
        answer: { diagnosis: 'hfref', nextStep: 'gdmt' },
        optimalLine: ['orthopnea', 'echo'],
        explanation: 'x',
      },
    ];
    expect(errorsOf(p).some((e) => e.includes('เกินงบ'))).toBe(true);
  });
});
