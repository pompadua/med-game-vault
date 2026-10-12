import type { ReviewItem } from '../core/items/types';
import { makeExport, mergeVault, parseExport, type MergeSummary, type VaultData } from '../core/srs/backup';
import { nextDayStart } from '../core/srs/day';
import type { ErrorType, ExportFile, GradeValue, ItemState, ReviewLogEntry, SessionKind } from '../core/srs/model';
import { applyGrade, makeScheduler, newStoredCard } from '../core/srs/scheduler';
import { resolveSettings, type ReviewSettings } from '../core/srs/settings';
import { db as defaultDb, type VaultDB } from './db';

/** ชั้นเข้าถึงข้อมูล — ทุกฟังก์ชันรับ db ได้ เพื่อเทสด้วย fake-indexeddb */

export async function getSettings(database: VaultDB = defaultDb): Promise<ReviewSettings> {
  const row = await database.kv.get('settings');
  return resolveSettings(row?.value as Partial<ReviewSettings> | undefined);
}

export async function saveSettings(patch: Partial<ReviewSettings>, database: VaultDB = defaultDb): Promise<ReviewSettings> {
  const next = resolveSettings({ ...(await getSettings(database)), ...patch, updatedAt: new Date().toISOString() });
  await database.kv.put({ key: 'settings', value: next });
  return next;
}

export async function getLastExportAt(database: VaultDB = defaultDb): Promise<string | undefined> {
  return (await database.kv.get('lastExportAt'))?.value as string | undefined;
}

export interface RecordReviewInput {
  item: ReviewItem;
  grade: GradeValue;
  now: Date;
  durationMs: number;
  errorType?: ErrorType | null;
  note?: string | null;
  session?: SessionKind;
  /** false = ฝึกนอกตาราง/boss ที่ไม่นับเข้า FSRS */
  countsToFsrs?: boolean;
  detail?: Record<string, unknown> | null;
}

/** บันทึกผลการทวน: อัปเดต FSRS state (ถ้านับ) + เพิ่ม review log (append-only) ใน transaction เดียว */
export async function recordReview(input: RecordReviewInput, database: VaultDB = defaultDb): Promise<{ state: ItemState | undefined; log: ReviewLogEntry }> {
  const settings = await getSettings(database);
  const counts = input.countsToFsrs ?? true;
  return database.transaction('rw', database.itemStates, database.reviewLogs, async () => {
    const prev = await database.itemStates.get(input.item.id);
    let state: ItemState | undefined = prev;
    let elapsedDays = 0;
    let scheduledDays = 0;
    const stateBefore = prev?.card.state ?? 0;
    if (counts) {
      const outcome = applyGrade(makeScheduler(settings), input.item, prev, input.grade, input.now, settings.leechThreshold);
      state = outcome.state;
      elapsedDays = outcome.elapsedDays;
      scheduledDays = outcome.scheduledDays;
      await database.itemStates.put(state);
    } else if (prev?.card.last_review) {
      elapsedDays = Math.max(0, (input.now.getTime() - new Date(prev.card.last_review).getTime()) / 86_400_000);
    }
    const reviewedAt = input.now.toISOString();
    const log: ReviewLogEntry = {
      id: `${input.item.id}@${reviewedAt}`,
      itemId: input.item.id,
      packId: input.item.packId,
      type: input.item.type,
      reviewedAt,
      grade: input.grade,
      durationMs: Math.max(0, Math.round(input.durationMs)),
      errorType: input.grade === 1 ? (input.errorType ?? null) : null,
      note: input.note?.trim() ? input.note.trim() : null,
      session: input.session ?? 'scheduled',
      countsToFsrs: counts,
      stateBefore,
      elapsedDays: Math.round(elapsedDays * 1000) / 1000,
      scheduledDays,
      contentHash: input.item.contentHash,
      detail: input.detail ?? null,
    };
    await database.reviewLogs.add(log);
    return { state, log };
  });
}

async function ensureState(item: ReviewItem, now: Date, database: VaultDB): Promise<ItemState> {
  const prev = await database.itemStates.get(item.id);
  return (
    prev ?? {
      id: item.id,
      packId: item.packId,
      card: newStoredCard(now),
      contentHash: item.contentHash,
      suspended: false,
      buriedUntil: null,
      leech: false,
      updatedAt: now.toISOString(),
    }
  );
}

/** พักไว้ (suspend) หรือยกเลิกการพัก */
export async function setSuspended(item: ReviewItem, suspended: boolean, now = new Date(), database: VaultDB = defaultDb): Promise<void> {
  await database.transaction('rw', database.itemStates, async () => {
    const st = await ensureState(item, now, database);
    await database.itemStates.put({ ...st, suspended, updatedAt: now.toISOString() });
  });
}

/** เลื่อนไปพรุ่งนี้ (bury) จนถึงต้นวันทวนถัดไป */
export async function buryUntilTomorrow(item: ReviewItem, now = new Date(), database: VaultDB = defaultDb): Promise<void> {
  const s = await getSettings(database);
  const until = nextDayStart(now, { timeZone: s.timeZone, dayStartHour: s.dayStartHour });
  await database.transaction('rw', database.itemStates, async () => {
    const st = await ensureState(item, now, database);
    await database.itemStates.put({ ...st, buriedUntil: until.toISOString(), updatedAt: now.toISOString() });
  });
}

/** แจ้งว่า "เนื้อหาน่าจะผิด" — ส่งต่อให้ /audit-pack ผ่าน export สำหรับ Claude */
export async function flagContent(item: ReviewItem, note: string, now = new Date(), database: VaultDB = defaultDb): Promise<void> {
  const createdAt = now.toISOString();
  await database.contentFlags.put({
    id: `${item.id}@${createdAt}`,
    itemId: item.id,
    packId: item.packId,
    note: note.trim(),
    createdAt,
    resolved: false,
  });
}

export async function loadVaultData(database: VaultDB = defaultDb): Promise<VaultData> {
  const [settings, packPrefs, itemStates, reviewLogs, contentFlags] = await Promise.all([
    getSettings(database),
    database.packPrefs.toArray(),
    database.itemStates.toArray(),
    database.reviewLogs.toArray(),
    database.contentFlags.toArray(),
  ]);
  return { settings, packPrefs, itemStates, reviewLogs, contentFlags };
}

export async function exportAll(now = new Date(), database: VaultDB = defaultDb): Promise<ExportFile> {
  const file = makeExport(await loadVaultData(database), now);
  await database.kv.put({ key: 'lastExportAt', value: now.toISOString() });
  return file;
}

/** import แบบ merge ตาม item ID (ใช้รายการที่ทวนล่าสุดกว่า) */
export async function importMerge(raw: unknown, database: VaultDB = defaultDb): Promise<MergeSummary> {
  const incoming = parseExport(raw);
  const current = await loadVaultData(database);
  const { data, summary } = mergeVault(current, incoming);
  await database.transaction('rw', [database.packPrefs, database.itemStates, database.reviewLogs, database.contentFlags, database.kv], async () => {
    await database.itemStates.bulkPut(data.itemStates);
    await database.reviewLogs.bulkPut(data.reviewLogs);
    await database.contentFlags.bulkPut(data.contentFlags);
    await database.packPrefs.bulkPut(data.packPrefs);
    await database.kv.put({ key: 'settings', value: data.settings });
  });
  return summary;
}

export async function resolveFlags(ids: string[], database: VaultDB = defaultDb): Promise<void> {
  await database.contentFlags.where('id').anyOf(ids).modify({ resolved: true });
}
