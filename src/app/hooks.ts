import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import type { ReviewItem } from '../core/items/types';
import type { Pack } from '../core/schema/pack';
import type { ContentFlag, ItemState, ReviewLogEntry } from '../core/srs/model';
import { resolveSettings, type ReviewSettings } from '../core/srs/settings';
import { loadAllItems, loadItems } from './data/items';
import { loadPack } from './data/vault';
import { db } from './db';

/** map packId → เปิดทวนอยู่ไหม (ไม่มี record = ยังไม่เปิด) */
export function usePackPrefs(): Map<string, boolean> {
  const prefs = useLiveQuery(() => db.packPrefs.toArray(), [], []);
  return useMemo(() => new Map(prefs.map((p) => [p.packId, p.enabled])), [prefs]);
}

/** pack ที่เปิดทวนอยู่ (undefined = กำลังโหลด) */
export function useEnabledPackIds(): string[] | undefined {
  return useLiveQuery(async () => (await db.packPrefs.toArray()).filter((p) => p.enabled).map((p) => p.packId), []);
}

export type Loadable<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; value: T };

export function usePack(packId: string): Loadable<Pack> {
  const [state, setState] = useState<Loadable<Pack>>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    loadPack(packId).then(
      (value) => alive && setState({ status: 'ready', value }),
      (e: unknown) => alive && setState({ status: 'error', error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      alive = false;
    };
  }, [packId]);
  return state;
}

export function useSettings(): ReviewSettings | undefined {
  return useLiveQuery(async () => resolveSettings((await db.kv.get('settings'))?.value as Partial<ReviewSettings> | undefined), []);
}

export interface ReviewData {
  settings: ReviewSettings;
  states: Map<string, ItemState>;
  logs: ReviewLogEntry[];
  flags: ContentFlag[];
  lastExportAt: string | undefined;
}

/** ข้อมูลการทวนทั้งหมดจาก IndexedDB (อัปเดตอัตโนมัติเมื่อ DB เปลี่ยน) */
export function useReviewData(): ReviewData | undefined {
  return useLiveQuery(async () => {
    const [settingsRow, states, logs, flags, lastExport] = await Promise.all([
      db.kv.get('settings'),
      db.itemStates.toArray(),
      db.reviewLogs.toArray(),
      db.contentFlags.toArray(),
      db.kv.get('lastExportAt'),
    ]);
    return {
      settings: resolveSettings(settingsRow?.value as Partial<ReviewSettings> | undefined),
      states: new Map(states.map((s) => [s.id, s])),
      logs,
      flags,
      lastExportAt: lastExport?.value as string | undefined,
    };
  }, []);
}

/** items ของ pack ตามรายการ (หรือทุก pack ถ้าไม่ระบุ) */
export function useItems(packIds?: string[]): { items: ReviewItem[]; packs: Map<string, Pack> } | undefined {
  const key = packIds ? [...packIds].sort().join('|') : '*';
  const [value, setValue] = useState<{ key: string; items: ReviewItem[]; packs: Map<string, Pack> }>();
  useEffect(() => {
    let alive = true;
    (packIds ? loadItems(packIds) : loadAllItems()).then((v) => alive && setValue({ key, ...v }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return value && value.key === key ? value : undefined;
}
