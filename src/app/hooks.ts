import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import type { Pack } from '../core/schema/pack';
import { loadPack } from './data/vault';
import { db } from './db';

/** map packId → เปิดทวนอยู่ไหม (ไม่มี record = ยังไม่เปิด) */
export function usePackPrefs(): Map<string, boolean> {
  const prefs = useLiveQuery(() => db.packPrefs.toArray(), [], []);
  return new Map(prefs.map((p) => [p.packId, p.enabled]));
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
