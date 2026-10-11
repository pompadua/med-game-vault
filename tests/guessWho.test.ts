import { describe, expect, it } from 'vitest';
import { checkTree, minTreeDepth, treeDepth } from '../src/core/games/guessWho';

const candidates = ['a', 'b', 'c', 'd'];
const questions = [
  { id: 'q-ab', yes: ['a', 'b'] },
  { id: 'q-ac', yes: ['a', 'c'] },
  { id: 'q-a', yes: ['a'] },
];

describe('guessWho', () => {
  it('minTreeDepth หา tree ที่ตื้นที่สุด', () => {
    expect(minTreeDepth(candidates, questions)).toBe(2);
    expect(minTreeDepth(candidates, [{ id: 'q-a', yes: ['a'] }])).toBe(Infinity);
    expect(minTreeDepth(['x'], [])).toBe(0);
  });

  it('treeDepth', () => {
    expect(treeDepth({ leaf: 'a' })).toBe(0);
    expect(treeDepth({ question: 'q', yes: { leaf: 'a' }, no: { question: 'r', yes: { leaf: 'b' }, no: { leaf: 'c' } } })).toBe(2);
  });

  it('checkTree: tree ที่ถูกต้อง', () => {
    const tree = {
      question: 'q-ab',
      yes: { question: 'q-ac', yes: { leaf: 'a' }, no: { leaf: 'b' } },
      no: { question: 'q-ac', yes: { leaf: 'c' }, no: { leaf: 'd' } },
    };
    expect(checkTree(tree, candidates, questions)).toEqual([]);
  });

  it('checkTree: leaf ผิดตัว / แยกไม่ครบ / คำถามไม่มีจริง', () => {
    expect(checkTree({ question: 'q-a', yes: { leaf: 'b' }, no: { leaf: 'c' } }, candidates, questions).length).toBe(2);
    expect(checkTree({ question: 'nope', yes: { leaf: 'a' }, no: { leaf: 'b' } }, candidates, questions)[0]).toContain('nope');
  });
});
