import type { TreeNode } from '../schema/pack';

export interface GwQuestion {
  id: string;
  yes: string[];
}

export function treeDepth(node: TreeNode): number {
  if ('leaf' in node) return 0;
  return 1 + Math.max(treeDepth(node.yes), treeDepth(node.no));
}

/**
 * ความลึกต่ำสุดของ decision tree ที่แยก candidate ทุกตัวได้ (Infinity = แยกไม่ได้ด้วยคำถามที่มี)
 * candidates ≤ 8 จึงใช้ bitmask + memo ได้สบาย
 */
export function minTreeDepth(candidates: string[], questions: GwQuestion[]): number {
  const index = new Map(candidates.map((c, i) => [c, i]));
  const masks = questions.map((q) => q.yes.reduce((m, c) => m | (1 << (index.get(c) ?? 31)), 0));
  const memo = new Map<number, number>();
  const full = (1 << candidates.length) - 1;
  const solve = (set: number): number => {
    if ((set & (set - 1)) === 0) return 0;
    const cached = memo.get(set);
    if (cached !== undefined) return cached;
    let best = Infinity;
    for (const m of masks) {
      const yes = set & m;
      const no = set & ~m;
      if (yes === 0 || no === 0) continue;
      best = Math.min(best, 1 + Math.max(solve(yes), solve(no)));
    }
    memo.set(set, best);
    return best;
  };
  return solve(full);
}

/**
 * ตรวจว่า tree แยก candidate ครบทุกตัวและสอดคล้องกับคำตอบของคำถาม
 * คืน list ของปัญหา (ว่าง = ใช้ได้)
 */
export function checkTree(tree: TreeNode, candidates: string[], questions: GwQuestion[]): string[] {
  const problems: string[] = [];
  const qById = new Map(questions.map((q) => [q.id, new Set(q.yes)]));
  const walk = (node: TreeNode, pool: string[], path: string): void => {
    if ('leaf' in node) {
      if (pool.length === 0) problems.push(`${path}: leaf "${node.leaf}" ไม่มี candidate เหลืออยู่ (กิ่งตาย)`);
      else if (pool.length > 1) problems.push(`${path}: ยังแยกไม่ออก (${pool.join(', ')})`);
      else if (pool[0] !== node.leaf) problems.push(`${path}: leaf ควรเป็น "${pool[0]}" แต่เขียน "${node.leaf}"`);
      return;
    }
    const yesSet = qById.get(node.question);
    if (!yesSet) {
      problems.push(`${path}: ไม่มีคำถาม id "${node.question}"`);
      return;
    }
    walk(node.yes, pool.filter((c) => yesSet.has(c)), `${path}/${node.question}=yes`);
    walk(node.no, pool.filter((c) => !yesSet.has(c)), `${path}/${node.question}=no`);
  };
  walk(tree, candidates, 'root');
  return problems;
}
