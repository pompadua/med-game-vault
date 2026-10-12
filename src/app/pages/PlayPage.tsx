import { useEffect, useMemo, useRef, useState } from 'react';
import { extractItems } from '../../core/items/extract';
import { ITEM_TYPE_LABEL, ITEM_TYPES, MEMORY_ITEM_TYPES, PUZZLE_ITEM_TYPES, type ItemType, type ReviewItem } from '../../core/items/types';
import { migratePack } from '../../core/schema/migrate';
import { Pack } from '../../core/schema/pack';
import { GRADE_LABEL, type GradeValue } from '../../core/srs/model';
import { pickPracticeItems } from '../../core/srs/practice';
import type { QueueEntry } from '../../core/srs/queue';
import { Badge } from '../components/ui';
import { vaultIndex } from '../data/vault';
import { useItems, useReviewData } from '../hooks';
import { recordReview } from '../repo';
import { ItemView } from '../review/ItemView';
import type { GradeResult } from '../review/MemoryCard';
import { href } from '../router';

/** DEV เท่านั้น: pack fixture ที่มีครบทุกโหมด ไว้ทดลองเล่น (ไม่ถูก bundle ใน production) */
async function loadDemoPack(): Promise<Pack | undefined> {
  if (!import.meta.env.DEV) return undefined;
  const mods = import.meta.glob<{ default: unknown }>('/tests/fixtures/demo-all-modes.json');
  const load = Object.values(mods)[0];
  return load ? Pack.parse(migratePack((await load()).default)) : undefined;
}

function parseTypes(v: string | null): Set<ItemType> | undefined {
  if (!v || v === 'all') return undefined;
  if (v === 'memory') return new Set(MEMORY_ITEM_TYPES);
  if (v === 'puzzle') return new Set(PUZZLE_ITEM_TYPES);
  const list = v.split(',').filter((t): t is ItemType => (ITEM_TYPES as readonly string[]).includes(t));
  return list.length ? new Set(list) : undefined;
}

/**
 * ฝึกนอกตาราง / boss round / เล่นข้อเดียวจากหน้า pack
 * - practice: ไม่กระทบตาราง FSRS (บันทึก log แบบ countsToFsrs=false)
 * - boss: สุ่มผสมหลาย pack แบบจับเวลา เลือกได้ว่าจะนับเข้า FSRS ไหม
 */
export function PlayPage({ query }: { query: URLSearchParams }) {
  const mode = query.get('mode') === 'boss' ? 'boss' : 'practice';
  const single = query.get('item');
  const demo = query.get('demo') === '1';
  const countsToFsrs = mode === 'boss' && query.get('fsrs') === '1';
  const n = Math.max(1, Math.min(200, Number(query.get('n')) || 10));
  const minutes = Number(query.get('minutes')) || 0;
  const packParam = query.get('packs');
  const tag = query.get('tag');
  const rotation = query.get('rotation');
  const weak = query.get('weak') === '1';
  const types = parseTypes(query.get('types'));

  const packIds = useMemo(() => {
    let list = vaultIndex.packs;
    if (packParam) list = list.filter((p) => packParam.split(',').includes(p.id));
    if (tag) list = list.filter((p) => p.tags.includes(tag));
    if (rotation) list = list.filter((p) => p.rotation === rotation);
    if (single) list = vaultIndex.packs.filter((p) => p.id === single.split(':')[0]);
    return list.map((p) => p.id);
  }, [packParam, tag, rotation, single]);

  const data = useReviewData();
  const vaultItems = useItems(demo ? [] : packIds);
  const [demoPack, setDemoPack] = useState<Pack>();
  useEffect(() => {
    if (demo) void loadDemoPack().then(setDemoPack);
  }, [demo]);

  const source = useMemo(() => {
    if (demo) return demoPack ? { items: extractItems(demoPack), packs: new Map([[demoPack.meta.id, demoPack]]) } : undefined;
    return vaultItems;
  }, [demo, demoPack, vaultItems]);

  const seed = useRef(Number(query.get('seed')) || Date.now());
  const [session, setSession] = useState<ReviewItem[]>();
  useEffect(() => {
    if (session || !source || !data) return;
    if (single) {
      const it = source.items.find((i) => i.id === single);
      setSession(it ? [it] : []);
    } else if (demo) {
      setSession(source.items.filter((i) => !types || types.has(i.type)));
    } else {
      setSession(
        pickPracticeItems(source.items, data.states, data.logs, {
          packIds: new Set(packIds),
          types,
          weakBelow: weak ? data.settings.weakThreshold : undefined,
          count: n,
          seed: seed.current,
        }),
      );
    }
  }, [session, source, data, single, demo, types, packIds, weak, n]);

  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<{ item: ReviewItem; grade: GradeValue }[]>([]);
  const startedAt = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const timeLimit = mode === 'boss' && session ? (minutes > 0 ? minutes * 60 : session.reduce((s, i) => s + (i.targetSeconds ?? 20), 0)) : undefined;
  useEffect(() => {
    if (!timeLimit) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timeLimit]);
  const elapsed = (now - startedAt.current) / 1000;
  const timeUp = timeLimit !== undefined && elapsed >= timeLimit;

  if (!session || !data || !source) return <div className="page">กำลังเตรียม…</div>;

  const current = !timeUp ? session[index] : undefined;

  const onGraded = async (r: GradeResult) => {
    if (!current) return;
    if (!demo) {
      await recordReview({
        item: current,
        grade: r.grade,
        now: new Date(),
        durationMs: r.durationMs,
        errorType: r.errorType,
        note: r.note,
        detail: r.detail,
        session: mode,
        countsToFsrs,
      });
    }
    setResults((x) => [...x, { item: current, grade: r.grade }]);
    setIndex((i) => i + 1);
  };

  if (!current) {
    const counts = ([1, 2, 3, 4] as GradeValue[]).map((g) => [g, results.filter((r) => r.grade === g).length] as const);
    const correct = results.filter((r) => r.grade > 1).length;
    return (
      <div className="page done">
        <h1>{mode === 'boss' ? 'จบ Boss round' : 'จบการฝึก'}</h1>
        {session.length === 0 && <p className="hint">ไม่มี item ที่ตรงเงื่อนไข</p>}
        {timeUp && <p className="hint">หมดเวลา</p>}
        <p className="hero-number">
          {correct}/{results.length}
        </p>
        <p className="muted">
          {counts.map(([g, c]) => `${GRADE_LABEL[g]} ${c}`).join(' · ')} · {Math.round(elapsed / 60)} นาที
        </p>
        <p className="muted small">
          {demo ? 'โหมด demo: ไม่บันทึกอะไร' : countsToFsrs ? 'นับเข้าตาราง FSRS แล้ว' : 'ไม่กระทบตาราง FSRS (บันทึก log ไว้ดูสถิติ/จุดอ่อน)'}
        </p>
        <div className="button-row center">
          <a className="button-link" href={href('/practice')}>
            ฝึกชุดใหม่
          </a>
          <a className="button-link" href={href('/')}>
            หน้าหลัก
          </a>
        </div>
      </div>
    );
  }

  const entry: QueueEntry = { item: current, state: data.states.get(current.id), r: undefined, isNew: !data.states.has(current.id), estSeconds: current.targetSeconds ?? 20 };
  return (
    <div className="page review">
      <header className="review-head">
        <a href={single ? href(`/pack/${current.packId}`, { tab: 'games' }) : href('/practice')} className="back" aria-label="ออก">
          ✕
        </a>
        <span className="muted small">
          {mode === 'boss' ? '👑 Boss' : demo ? 'Demo' : 'ฝึก'} · {index + 1}/{session.length}
          {timeLimit !== undefined && ` · เหลือ ${Math.max(0, Math.ceil(timeLimit - elapsed))} วิ`}
        </span>
        <span />
      </header>
      <div className="badges">
        <Badge tone="accent">{ITEM_TYPE_LABEL[current.type]}</Badge>
        {!countsToFsrs && <Badge tone="muted">ไม่นับเข้า FSRS</Badge>}
      </div>
      {current.context && current.kind === 'memory' && <p className="muted small context">{current.context}</p>}
      <ItemView key={`${current.id}#${index}`} entry={entry} settings={data.settings} pack={source.packs.get(current.packId)} showIntervals={countsToFsrs} practice={!countsToFsrs} onGraded={onGraded} />
    </div>
  );
}
