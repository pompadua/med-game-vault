import { describe, expect, it } from 'vitest';
import { Pack } from '../src/core/schema/pack';
import { matchesQuery, normalizeSearch } from '../src/core/search';
import { filterPacks } from '../src/core/vaultFilter';
import { buildIndexEntry } from '../src/core/vaultIndex';
import { samplePack, taxonomy } from './helpers';

const entry = buildIndexEntry(Pack.parse(samplePack()), 'cardio/cardio-heart-failure.json', taxonomy);

describe('ค้นหา', () => {
  it('ภาษาไทยแบบไม่มีเว้นวรรค (substring)', () => {
    expect(matchesQuery(entry.searchText, 'หัวใจ')).toBe(true); // จากชื่อ subject ภาษาไทย
    expect(matchesQuery(entry.searchText, 'ความดันย้อน')).toBe(true); // กลางประโยคในกฎ
  });

  it('อังกฤษไม่สนตัวพิมพ์', () => {
    expect(matchesQuery(entry.searchText, 'hfref')).toBe(true);
    expect(matchesQuery(entry.searchText, 'STARLING')).toBe(true);
  });

  it('ค้นชื่อยาใน counter / matchups ได้', () => {
    expect(matchesQuery(entry.searchText, 'ARNI')).toBe(true);
    expect(matchesQuery(entry.searchText, 'diltiazem')).toBe(true);
  });

  it('หลายคำ = AND', () => {
    expect(matchesQuery(entry.searchText, 'HFpEF หัวใจ')).toBe(true);
    expect(matchesQuery(entry.searchText, 'HFpEF pneumothorax')).toBe(false);
  });

  it('คำค้นว่าง = ผ่านทุก pack', () => {
    expect(matchesQuery(entry.searchText, '   ')).toBe(true);
  });

  it('normalize ตัด zero-width space', () => {
    expect(normalizeSearch('หัว​ใจ')).toBe('หัวใจ');
  });
});

describe('ตัวกรองคลัง', () => {
  const other = { ...entry, id: 'nephro-x', subject: 'nephro', status: 'verified' as const, tags: ['electrolytes'], searchText: 'sodium' };
  const all = [entry, other];

  it('กรอง subject / tag / status', () => {
    expect(filterPacks(all, { subject: 'cardio' }, new Map()).map((p) => p.id)).toEqual(['cardio-heart-failure']);
    expect(filterPacks(all, { tag: 'electrolytes' }, new Map()).map((p) => p.id)).toEqual(['nephro-x']);
    expect(filterPacks(all, { status: 'draft' }, new Map()).map((p) => p.id)).toEqual(['cardio-heart-failure']);
  });

  it('กรองเปิดทวน / พักไว้', () => {
    const enabled = new Map([['nephro-x', true]]);
    expect(filterPacks(all, { review: 'on' }, enabled).map((p) => p.id)).toEqual(['nephro-x']);
    expect(filterPacks(all, { review: 'off' }, enabled).map((p) => p.id)).toEqual(['cardio-heart-failure']);
  });

  it('กรอง due และจุดอ่อนจาก stats', () => {
    const stats = new Map([
      ['cardio-heart-failure', { dueCount: 3, accuracy: 0.6 }],
      ['nephro-x', { dueCount: 0, accuracy: 0.95 }],
    ]);
    expect(filterPacks(all, { due: true }, new Map(), stats).map((p) => p.id)).toEqual(['cardio-heart-failure']);
    expect(filterPacks(all, { weakBelow: 0.8 }, new Map(), stats).map((p) => p.id)).toEqual(['cardio-heart-failure']);
  });
});
