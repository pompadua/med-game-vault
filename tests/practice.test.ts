import { describe, expect, it } from 'vitest';
import { extractItems } from '../src/core/items/extract';
import { Pack } from '../src/core/schema/pack';
import type { ReviewLogEntry } from '../src/core/srs/model';
import { pickPracticeItems, seededRandom, shuffle } from '../src/core/srs/practice';
import { readJsonFile, samplePack } from './helpers';

const hf = extractItems(Pack.parse(samplePack()));
const demo = extractItems(Pack.parse(readJsonFile('tests/fixtures/demo-all-modes.json')));
const all = [...hf, ...demo];

const log = (itemId: string, grade: 1 | 3): ReviewLogEntry => ({
  id: `${itemId}@${Math.random()}`,
  itemId,
  packId: itemId.split(':')[0]!,
  type: itemId.split(':')[1]!,
  reviewedAt: '2026-10-12T00:00:00.000Z',
  grade,
  durationMs: 1000,
  errorType: null,
  note: null,
  session: 'scheduled',
  countsToFsrs: true,
  stateBefore: 2,
  elapsedDays: 1,
  scheduledDays: 1,
  contentHash: 'h',
  detail: null,
});

describe('ฝึกนอกตาราง / boss', () => {
  it('seed เดิม = ผลเดิม, seed ต่าง = ลำดับต่าง', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], seededRandom(42));
    expect(shuffle([1, 2, 3, 4, 5, 6, 7, 8], seededRandom(42))).toEqual(a);
    expect(shuffle([1, 2, 3, 4, 5, 6, 7, 8], seededRandom(43))).not.toEqual(a);
  });

  it('กรอง pack / ชนิด และจำกัดจำนวน', () => {
    const out = pickPracticeItems(all, new Map(), [], { packIds: new Set(['demo-all-modes']), types: new Set(['speedrun', 'mcq']), count: 2, seed: 1 });
    expect(out).toHaveLength(2);
    expect(out.every((i) => i.packId === 'demo-all-modes' && (i.type === 'speedrun' || i.type === 'mcq'))).toBe(true);
  });

  it('สลับ pack ไม่ให้ติดกันเมื่อทำได้', () => {
    const out = pickPracticeItems(all, new Map(), [], { count: 20, seed: 7 });
    let adjacent = 0;
    for (let i = 1; i < out.length; i++) if (out[i]!.packId === out[i - 1]!.packId) adjacent++;
    // demo มี item น้อยกว่า จึงอาจต้องติดกันช่วงท้าย แต่ช่วงต้นต้องสลับ
    expect(out[0]!.packId).not.toBe(out[1]!.packId);
    expect(adjacent).toBeLessThan(out.length - 1);
  });

  it('จุดอ่อน: เอาเฉพาะ item ที่แม่น < เกณฑ์หรือ leech และเรียงแย่สุดก่อน', () => {
    const [a, b, c] = hf;
    const logs = [log(a!.id, 1), log(a!.id, 1), log(b!.id, 1), log(b!.id, 3), log(c!.id, 3)];
    const out = pickPracticeItems(hf, new Map(), logs, { weakBelow: 0.8, count: 10, seed: 1 });
    expect(out.map((i) => i.id)).toEqual([a!.id, b!.id]);
  });
});
