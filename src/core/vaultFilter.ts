import { matchesQuery } from './search';
import type { PackIndexEntry } from './vaultIndex';

export interface VaultFilters {
  q?: string;
  subject?: string;
  rotation?: string;
  tag?: string;
  status?: string;
  /** 'on' = เฉพาะ pack ที่เปิดทวน, 'off' = เฉพาะที่พักไว้ */
  review?: 'on' | 'off';
  /** มี item ครบกำหนด (ต้องมีข้อมูล due — ใช้หลังระบบทวนพร้อม) */
  due?: boolean;
  /** ความแม่น < threshold (0–1) */
  weakBelow?: number;
}

export interface PackRuntimeStats {
  dueCount?: number;
  /** ความแม่นจาก log (0–1), undefined = ยังไม่มีข้อมูล */
  accuracy?: number;
}

export function filterPacks(
  entries: PackIndexEntry[],
  f: VaultFilters,
  enabled: Map<string, boolean>,
  stats: Map<string, PackRuntimeStats> = new Map(),
): PackIndexEntry[] {
  return entries.filter((p) => {
    if (f.q && !matchesQuery(p.searchText, f.q)) return false;
    if (f.subject && p.subject !== f.subject) return false;
    if (f.rotation && p.rotation !== f.rotation) return false;
    if (f.tag && !p.tags.includes(f.tag)) return false;
    if (f.status && p.status !== f.status) return false;
    if (f.review === 'on' && !enabled.get(p.id)) return false;
    if (f.review === 'off' && enabled.get(p.id)) return false;
    const s = stats.get(p.id);
    if (f.due && !(s?.dueCount && s.dueCount > 0)) return false;
    if (f.weakBelow !== undefined && !(s?.accuracy !== undefined && s.accuracy < f.weakBelow)) return false;
    return true;
  });
}
