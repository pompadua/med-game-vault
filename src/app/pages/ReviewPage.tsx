import { useEffect, useMemo, useRef, useState } from 'react';
import { ITEM_TYPE_LABEL } from '../../core/items/types';
import { nextDayStart, studyDayKey } from '../../core/srs/day';
import { averageSecondsByType, buildQueue, type QueueEntry } from '../../core/srs/queue';
import { makeScheduler } from '../../core/srs/scheduler';
import { Badge } from '../components/ui';
import { useEnabledPackIds, useItems, useReviewData } from '../hooks';
import { PLAYABLE_TYPES } from '../playable';
import { recordReview } from '../repo';
import { ItemMenu } from '../review/ItemMenu';
import { ItemView } from '../review/ItemView';
import type { GradeResult } from '../review/MemoryCard';
import { href } from '../router';

/** หน้าทวนตามตาราง FSRS */
export function ReviewPage({ query }: { query: URLSearchParams }) {
  const data = useReviewData();
  const enabled = useEnabledPackIds();
  const itemsData = useItems(enabled ?? []);
  const budgetParam = Number(query.get('min'));
  const budgetMinutes = Number.isFinite(budgetParam) && budgetParam > 0 ? budgetParam : undefined;

  const startedAt = useRef(Date.now());
  const [tick, setTick] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [answeredAt, setAnsweredAt] = useState<Map<string, string>>(new Map());
  const [learnAhead, setLearnAhead] = useState(false);
  const [busy, setBusy] = useState(false);

  // รีเฟรชคิวเป็นระยะ เพื่อดึง item ใน learning step ที่ครบกำหนดกลับมา
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 20_000);
    return () => window.clearInterval(id);
  }, []);

  const result = useMemo(() => {
    if (!data || !itemsData || !enabled) return undefined;
    const now = new Date();
    const dayCfg = { timeZone: data.settings.timeZone, dayStartHour: data.settings.dayStartHour };
    const todayKey = studyDayKey(now, dayCfg);
    const usedMinutes = (Date.now() - startedAt.current) / 60_000;
    return buildQueue({
      items: itemsData.items,
      states: data.states,
      enabledPacks: new Set(enabled),
      todayLogs: data.logs.filter((l) => studyDayKey(new Date(l.reviewedAt), dayCfg) === todayKey),
      now,
      settings: data.settings,
      scheduler: makeScheduler(data.settings),
      allowedTypes: new Set(PLAYABLE_TYPES),
      timeBudgetMinutes: budgetMinutes !== undefined ? Math.max(0, budgetMinutes - usedMinutes) : undefined,
      avgSecondsByType: averageSecondsByType(data.logs),
    });
    // tick ใช้บังคับให้คำนวณใหม่ตามเวลา
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, itemsData, enabled, budgetMinutes, tick]);

  if (!result || !data) return <div className="page">กำลังเตรียมคิว…</div>;

  // ตัด item ที่เพิ่งตอบไปแต่ข้อมูลใน DB ยังไม่อัปเดต
  const fresh = (e: QueueEntry) => {
    const at = answeredAt.get(e.item.id);
    return !at || (e.state?.updatedAt ?? '') >= at;
  };
  const budgetUsedUp = budgetMinutes !== undefined && (Date.now() - startedAt.current) / 60_000 >= budgetMinutes;
  const queue = budgetUsedUp ? [] : [...result.queue, ...(learnAhead ? result.laterToday : [])].filter(fresh);
  const current = queue[0];

  const onGraded = async (r: GradeResult) => {
    if (!current || busy) return;
    setBusy(true);
    const now = new Date();
    try {
      await recordReview({ item: current.item, now, durationMs: r.durationMs, grade: r.grade, errorType: r.errorType, note: r.note, detail: r.detail });
      setAnsweredAt((m) => new Map(m).set(current.item.id, now.toISOString()));
      setDoneCount((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  const onMenu = () => {
    if (!current) return;
    setAnsweredAt((m) => new Map(m).set(current.item.id, new Date().toISOString()));
  };

  if (!current) {
    const minutes = Math.round((Date.now() - startedAt.current) / 60_000);
    const dayCfg = { timeZone: data.settings.timeZone, dayStartHour: data.settings.dayStartHour };
    const tomorrowEnd = nextDayStart(nextDayStart(new Date(), dayCfg), dayCfg);
    const dueTomorrow = [...data.states.values()].filter((s) => !s.suspended && s.card.state !== 0 && new Date(s.card.due) < tomorrowEnd && new Date(s.card.due) > new Date()).length;
    const waiting = result.laterToday.filter(fresh);
    return (
      <div className="page done">
        <h1>{doneCount > 0 ? 'จบคิววันนี้' : 'ไม่มี item ที่ต้องทวนตอนนี้'}</h1>
        <p>
          ทวนไป <strong>{doneCount}</strong> item · {minutes} นาที
        </p>
        {budgetUsedUp && <p className="hint">ครบเวลาที่ตั้งไว้ ({budgetMinutes} นาที) แล้ว</p>}
        {result.overBudget > 0 && !budgetUsedUp && <p className="hint">มีอีก {result.overBudget} item ที่ถูกตัดเพราะงบเวลา</p>}
        {waiting.length > 0 && !learnAhead && (
          <div className="panel">
            <p>
              อีก {waiting.length} item อยู่ใน learning step และจะกลับมาภายในวันนี้ (ถัดไปใน{' '}
              {Math.max(1, Math.round((new Date(waiting[0]!.state!.card.due).getTime() - Date.now()) / 60_000))} นาที)
            </p>
            <button type="button" className="secondary" onClick={() => setLearnAhead(true)}>
              ทวนล่วงหน้าเลย
            </button>
          </div>
        )}
        {enabled && enabled.length === 0 && (
          <p className="hint">
            ยังไม่มี pack ที่เปิดทวน — ไปที่ <a href={href('/vault')}>คลัง</a> แล้วกดสวิตช์ “เปิดทวน” ในหน้า pack
          </p>
        )}
        <p className="muted">พรุ่งนี้ครบกำหนดประมาณ {dueTomorrow} item</p>
        <a className="button-link" href={href('/')}>
          กลับหน้าหลัก
        </a>
      </div>
    );
  }

  const st = current.state;
  const updated = st && st.contentHash !== current.item.contentHash;
  return (
    <div className="page review">
      <header className="review-head">
        <a href={href('/')} className="back" aria-label="ออกจากการทวน">
          ✕
        </a>
        <span className="muted small">
          เหลือ {queue.length} · ทำแล้ว {doneCount}
        </span>
        <ItemMenu item={current.item} onDone={(a) => a !== 'flag' && onMenu()} />
      </header>
      <div className="badges">
        <Badge tone="accent">{ITEM_TYPE_LABEL[current.item.type]}</Badge>
        {current.isNew && <Badge tone="muted">ใหม่</Badge>}
        {updated && <Badge tone="warn">เนื้อหาอัปเดต</Badge>}
        {st?.leech && <Badge tone="warn">leech</Badge>}
      </div>
      {current.item.context && current.item.context !== ITEM_TYPE_LABEL[current.item.type] && <p className="muted small context">{current.item.context}</p>}
      <ItemView key={current.item.id} entry={current} settings={data.settings} pack={itemsData?.packs.get(current.item.packId)} onGraded={onGraded} />
    </div>
  );
}
