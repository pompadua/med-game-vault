import { z } from 'zod';
import type { ReviewItem } from '../items/types';
import {
  EXPORT_SCHEMA_VERSION,
  ExportFile,
  type ContentFlag,
  type ItemState,
  type PackPrefRecord,
  type ReviewLogEntry,
} from './model';
import { resolveSettings, type ReviewSettings } from './settings';

export interface VaultData {
  settings: ReviewSettings;
  packPrefs: PackPrefRecord[];
  itemStates: ItemState[];
  reviewLogs: ReviewLogEntry[];
  contentFlags: ContentFlag[];
}

export function makeExport(data: VaultData, now: Date): ExportFile {
  const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return {
    kind: 'med-game-vault-backup',
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    settings: data.settings,
    packPrefs: [...data.packPrefs].sort((a, b) => (a.packId < b.packId ? -1 : 1)),
    itemStates: [...data.itemStates].sort(byId),
    reviewLogs: [...data.reviewLogs].sort(byId),
    contentFlags: [...data.contentFlags].sort(byId),
  };
}

type Raw = Record<string, unknown>;
/** migration ของไฟล์ export: version N → N+1 (เพิ่มเมื่อเปลี่ยนรูปแบบไฟล์ และเพิ่ม test) */
export const exportMigrations: Record<number, (f: Raw) => Raw> = {};

export class ImportError extends Error {}

export function parseExport(raw: unknown, migrations = exportMigrations): ExportFile {
  if (typeof raw !== 'object' || raw === null || (raw as Raw).kind !== 'med-game-vault-backup') {
    throw new ImportError('ไม่ใช่ไฟล์สำรองของ Med Game Vault');
  }
  let cur = raw as Raw;
  let v = typeof cur.schemaVersion === 'number' ? cur.schemaVersion : NaN;
  if (!Number.isInteger(v)) throw new ImportError('ไฟล์ไม่มี schemaVersion');
  if (v > EXPORT_SCHEMA_VERSION) throw new ImportError(`ไฟล์ใหม่กว่าแอป (schemaVersion ${v}) — อัปเดตแอปก่อน`);
  while (v < EXPORT_SCHEMA_VERSION) {
    const step = migrations[v];
    if (!step) throw new ImportError(`ไม่มี migration จาก schemaVersion ${v}`);
    cur = step(cur);
    v++;
    if (cur.schemaVersion !== v) throw new ImportError(`migration ต้องตั้ง schemaVersion เป็น ${v}`);
  }
  // settings ที่ขาดฟิลด์ใหม่ เติมด้วยค่าเริ่มต้นก่อนตรวจ
  cur = { ...cur, settings: resolveSettings(cur.settings as Partial<ReviewSettings>) };
  const parsed = ExportFile.safeParse(cur);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ImportError(`ไฟล์ไม่ถูกต้อง: ${first?.path.join('.')} ${first?.message}`);
  }
  return parsed.data;
}

function lastReviewOf(s: ItemState): string {
  return s.card.last_review ?? '';
}

/** เลือกตัวที่ทวนล่าสุดกว่า; เสมอกันใช้ updatedAt */
function newerState(a: ItemState, b: ItemState): ItemState {
  const ra = lastReviewOf(a);
  const rb = lastReviewOf(b);
  if (ra !== rb) return ra > rb ? a : b;
  return a.updatedAt >= b.updatedAt ? a : b;
}

export interface MergeSummary {
  statesAdded: number;
  statesReplaced: number;
  logsAdded: number;
  flagsAdded: number;
}

/** import แบบ merge ตาม item ID: ใช้รายการที่ทวนล่าสุดกว่า, log/flag รวมกันโดยไม่ซ้ำ */
export function mergeVault(current: VaultData, incoming: ExportFile): { data: VaultData; summary: MergeSummary } {
  const summary: MergeSummary = { statesAdded: 0, statesReplaced: 0, logsAdded: 0, flagsAdded: 0 };

  const states = new Map(current.itemStates.map((s) => [s.id, s]));
  for (const s of incoming.itemStates) {
    const cur = states.get(s.id);
    if (!cur) {
      states.set(s.id, s);
      summary.statesAdded++;
    } else if (newerState(cur, s) === s && s !== cur) {
      if (JSON.stringify(cur) !== JSON.stringify(s)) summary.statesReplaced++;
      states.set(s.id, s);
    }
  }

  const logs = new Map(current.reviewLogs.map((l) => [l.id, l]));
  for (const l of incoming.reviewLogs) {
    if (!logs.has(l.id)) {
      logs.set(l.id, l);
      summary.logsAdded++;
    }
  }

  const flags = new Map(current.contentFlags.map((f) => [f.id, f]));
  for (const f of incoming.contentFlags) {
    const cur = flags.get(f.id);
    if (!cur) summary.flagsAdded++;
    // resolved แล้วฝั่งใดฝั่งหนึ่ง = resolved
    flags.set(f.id, cur ? { ...cur, resolved: cur.resolved || f.resolved } : f);
  }

  const prefs = new Map(current.packPrefs.map((p) => [p.packId, p]));
  for (const p of incoming.packPrefs) {
    const cur = prefs.get(p.packId);
    if (!cur || p.updatedAt > cur.updatedAt) prefs.set(p.packId, p);
  }

  const settings = incoming.settings.updatedAt > current.settings.updatedAt ? incoming.settings : current.settings;

  return {
    data: {
      settings,
      packPrefs: [...prefs.values()],
      itemStates: [...states.values()],
      reviewLogs: [...logs.values()],
      contentFlags: [...flags.values()],
    },
    summary,
  };
}

// ---------- export สำหรับ Claude Code (/debrief, /audit-pack) ----------

export const DebriefExport = z.object({
  kind: z.literal('med-game-vault-debrief'),
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  errors: z.array(z.record(z.string(), z.unknown())),
  leeches: z.array(z.record(z.string(), z.unknown())),
  flags: z.array(z.record(z.string(), z.unknown())),
});
export type DebriefExport = z.infer<typeof DebriefExport>;

/**
 * error log (ตอบ Again ที่บันทึกชนิดความผิดพลาด) + leech + item ที่ถูกแจ้งว่าผิด
 * พร้อม packId/type/elementId และข้อความหน้า/หลังการ์ด ให้ Claude Code อ่านต่อได้ทันที
 */
export function makeDebriefExport(data: VaultData, items: Map<string, ReviewItem>, now: Date, since?: Date): DebriefExport {
  const describe = (itemId: string) => {
    const it = items.get(itemId);
    const [packId, type, ...rest] = itemId.split(':');
    return {
      itemId,
      packId: it?.packId ?? packId,
      type: it?.type ?? type,
      elementId: it?.elementId ?? rest.join(':'),
      context: it?.context ?? null,
      front: it?.front ?? null,
      back: it?.back ?? null,
      removedFromVault: !it,
    };
  };
  const errors = data.reviewLogs
    .filter((l) => l.grade === 1 && (!since || new Date(l.reviewedAt) >= since))
    .sort((a, b) => (a.reviewedAt < b.reviewedAt ? -1 : 1))
    .map((l) => ({
      ...describe(l.itemId),
      reviewedAt: l.reviewedAt,
      errorType: l.errorType,
      note: l.note,
      session: l.session,
      detail: l.detail,
    }));
  const leeches = data.itemStates
    .filter((s) => s.leech)
    .map((s) => ({ ...describe(s.id), lapses: s.card.lapses, reps: s.card.reps, suspended: s.suspended }));
  const flags = data.contentFlags
    .filter((f) => !f.resolved)
    .map((f) => ({ ...describe(f.itemId), flagId: f.id, note: f.note, createdAt: f.createdAt }));
  return { kind: 'med-game-vault-debrief', schemaVersion: 1, exportedAt: now.toISOString(), errors, leeches, flags };
}
