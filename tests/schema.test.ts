import { describe, expect, it } from 'vitest';
import { Pack } from '../src/core/schema/pack';
import { Taxonomy } from '../src/core/schema/taxonomy';
import { samplePack, taxonomy } from './helpers';

describe('pack schema', () => {
  it('sample pack ผ่าน schema', () => {
    expect(Pack.safeParse(samplePack()).success).toBe(true);
  });

  it('taxonomy ผ่าน schema', () => {
    expect(Taxonomy.safeParse(taxonomy).success).toBe(true);
  });

  it('id ที่ไม่ใช่ kebab-case ไม่ผ่าน', () => {
    const p = samplePack();
    p.cards[0].id = 'HFrEF Card';
    expect(Pack.safeParse(p).success).toBe(false);
  });

  it('memorize ที่ไม่มี sourceId ไม่ผ่าน', () => {
    const p = samplePack();
    delete p.cards[0].memorize[0].sourceId;
    expect(Pack.safeParse(p).success).toBe(false);
  });

  it('mcq ต้องมี 5 ตัวเลือกพอดี', () => {
    const p = samplePack();
    p.games.mcq[0].options.pop();
    expect(Pack.safeParse(p).success).toBe(false);
  });

  it('ฟิลด์แปลกที่ระดับบนสุดไม่ผ่าน (strict)', () => {
    const p = samplePack();
    p.extra = 1;
    expect(Pack.safeParse(p).success).toBe(false);
  });

  it('โหมดเกมที่ไม่รู้จักไม่ผ่าน', () => {
    const p = samplePack();
    p.games.trivia = [];
    expect(Pack.safeParse(p).success).toBe(false);
  });

  it('guessWho ต้องมี 4–8 candidate', () => {
    const p = samplePack();
    p.games.guessWho = [
      {
        id: 'gw',
        targetSeconds: 60,
        difficulty: 1,
        basedOn: {},
        title: 't',
        candidates: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        questions: [
          { id: 'q1', text: '?', yes: ['a'] },
          { id: 'q2', text: '?', yes: ['b'] },
        ],
        optimalTree: { question: 'q1', yes: { leaf: 'a' }, no: { leaf: 'b' } },
        explanation: 'x',
      },
    ];
    expect(Pack.safeParse(p).success).toBe(false);
  });
});
