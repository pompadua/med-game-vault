import { useMemo, useState } from 'react';
import { studyDayKey } from '../../core/srs/day';
import { averageSecondsByType, buildQueue } from '../../core/srs/queue';
import { makeScheduler } from '../../core/srs/scheduler';
import { vaultIndex } from '../data/vault';
import { useEnabledPackIds, useItems, useReviewData } from '../hooks';
import { PLAYABLE_TYPES } from '../playable';
import { href, navigate } from '../router';

const BUDGETS = [0, 10, 20, 30, 45, 60];
const BUDGET_KEY = 'mgv-budget';

function readBudget(): number {
  try {
    const v = Number(localStorage.getItem(BUDGET_KEY));
    return BUDGETS.includes(v) ? v : 0;
  } catch {
    return 0;
  }
}

export function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 1) return '< 1 นาที';
  if (m < 60) return `~${m} นาที`;
  return `~${Math.floor(m / 60)} ชม. ${m % 60} นาที`;
}

export function HomePage() {
  const data = useReviewData();
  const enabled = useEnabledPackIds();
  const itemsData = useItems(enabled ?? []);
  const [budget, setBudget] = useState(readBudget);

  const result = useMemo(() => {
    if (!data || !itemsData || !enabled) return undefined;
    const now = new Date();
    const dayCfg = { timeZone: data.settings.timeZone, dayStartHour: data.settings.dayStartHour };
    const today = studyDayKey(now, dayCfg);
    return buildQueue({
      items: itemsData.items,
      states: data.states,
      enabledPacks: new Set(enabled),
      todayLogs: data.logs.filter((l) => studyDayKey(new Date(l.reviewedAt), dayCfg) === today),
      now,
      settings: data.settings,
      scheduler: makeScheduler(data.settings),
      allowedTypes: new Set(PLAYABLE_TYPES),
      timeBudgetMinutes: budget || undefined,
      avgSecondsByType: averageSecondsByType(data.logs),
    });
  }, [data, itemsData, enabled, budget]);

  const backupDue = useMemo(() => {
    if (!data || data.logs.length === 0) return false;
    if (!data.lastExportAt) return true;
    return Date.now() - new Date(data.lastExportAt).getTime() > data.settings.backupReminderDays * 86_400_000;
  }, [data]);

  const total = result ? result.queue.length : undefined;
  const pickBudget = (m: number) => {
    setBudget(m);
    try {
      localStorage.setItem(BUDGET_KEY, String(m));
    } catch {
      // ไม่มี storage ก็ใช้ค่านี้ได้ในรอบนี้
    }
  };

  return (
    <div className="page home">
      <header className="page-head">
        <h1>Med Game Vault</h1>
      </header>

      {backupDue && (
        <a className="banner warn" href={href('/settings', { tab: 'data' })}>
          ไม่ได้สำรองข้อมูลเกิน {data!.settings.backupReminderDays} วัน — กดเพื่อ export
        </a>
      )}

      <section className="hero panel">
        <p className="muted small">วันนี้</p>
        <p className="hero-number">{total ?? '…'}</p>
        <p className="muted">
          item พร้อมทวน
          {result && ` · ทวน ${result.dueCount} · ใหม่ ${result.newCount} · ${formatMinutes(result.estimatedSeconds)}`}
        </p>
        <button type="button" className="primary big" disabled={!total} onClick={() => navigate('/review', { min: budget ? String(budget) : undefined })}>
          เริ่มทวน
        </button>
        <div className="budget" role="radiogroup" aria-label="วันนี้มีเวลา">
          <span className="muted small">วันนี้มีเวลา</span>
          {BUDGETS.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={budget === m} className={budget === m ? 'chip active' : 'chip'} onClick={() => pickBudget(m)}>
              {m === 0 ? 'ไม่จำกัด' : `${m} นาที`}
            </button>
          ))}
        </div>
        {result && result.overBudget > 0 && <p className="muted small">ตัดออก {result.overBudget} item ตามเวลาที่มี</p>}
        {result && result.laterToday.length > 0 && <p className="muted small">อีก {result.laterToday.length} item ใน learning step จะกลับมาภายหลังวันนี้</p>}
        {enabled && enabled.length === 0 && (
          <p className="hint">
            ยังไม่มี pack ที่เปิดทวน — เข้า <a href={href('/vault')}>คลัง</a> แล้วกดสวิตช์ “เปิดทวน”
          </p>
        )}
      </section>

      <nav className="shortcuts">
        <a className="shortcut" href={href('/vault')}>
          <strong>คลัง</strong>
          <span className="muted small">{vaultIndex.packs.length} pack</span>
        </a>
        <a className="shortcut" href={href('/practice')}>
          <strong>ฝึก / Boss</strong>
          <span className="muted small">นอกตาราง</span>
        </a>
        <a className="shortcut" href={href('/stats')}>
          <strong>สถิติ</strong>
          <span className="muted small">retention, forecast</span>
        </a>
        <a className="shortcut" href={href('/settings')}>
          <strong>ตั้งค่า</strong>
          <span className="muted small">ทวน, ข้อมูล</span>
        </a>
      </nav>
    </div>
  );
}
