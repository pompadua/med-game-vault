import { useMemo } from 'react';
import { ITEM_TYPE_LABEL, type ItemType } from '../../core/items/types';
import { addDaysToKey, studyDayKey } from '../../core/srs/day';
import { ERROR_TYPE_LABEL } from '../../core/srs/model';
import { accuracyBy, dueForecast, errorTypeCounts, leechList, minutesPerDay, streak, trueRetention } from '../../core/srs/stats';
import { ColumnChart, DataTable, HBarList, StatTile } from '../components/charts';
import { findEntry } from '../data/vault';
import { useEnabledPackIds, useItems, useReviewData } from '../hooks';
import { href } from '../router';

const pct = (v: number | undefined) => (v === undefined ? '—' : `${Math.round(v * 100)}%`);
const shortDay = (key: string) => {
  const [, m, d] = key.split('-');
  return `${Number(d)}/${Number(m)}`;
};

/** สถิติทั้งหมดคำนวณจาก review log และ FSRS state จริงในเครื่อง */
export function StatsPage() {
  const data = useReviewData();
  const enabled = useEnabledPackIds();
  const all = useItems();

  const s = useMemo(() => {
    if (!data) return undefined;
    const now = new Date();
    const cfg = { timeZone: data.settings.timeZone, dayStartHour: data.settings.dayStartHour };
    const today = studyDayKey(now, cfg);
    const enabledSet = new Set(enabled ?? []);
    const states = [...data.states.values()];
    const todayLogs = data.logs.filter((l) => studyDayKey(new Date(l.reviewedAt), cfg) === today);
    return {
      retention30: trueRetention(data.logs, addDaysToKey(today, -29), cfg),
      retentionAll: trueRetention(data.logs),
      streak: streak(data.logs, now, cfg),
      today: { reviews: todayLogs.length, minutes: Math.round(todayLogs.reduce((t, l) => t + l.durationMs, 0) / 60_000) },
      forecast: dueForecast(states, now, cfg, 30, (st) => enabledSet.has(st.packId)),
      minutes: minutesPerDay(data.logs, now, cfg, 30),
      byPack: accuracyBy(data.logs, (l) => l.packId),
      byType: accuracyBy(data.logs, (l) => l.type),
      errors: errorTypeCounts(data.logs),
      leeches: leechList(states, new Map((all?.items ?? []).map((i) => [i.id, i]))),
    };
  }, [data, enabled, all]);

  if (!data || !s) return <div className="page">กำลังคำนวณ…</div>;
  const desired = data.settings.desiredRetention;
  const totalErrors = s.errors.reduce((t, e) => t + e.count, 0);

  return (
    <div className="page">
      <header className="page-head">
        <h1>สถิติ</h1>
        <p className="muted small">คำนวณจาก log จริงในเครื่องนี้ ({data.logs.length} ครั้ง)</p>
      </header>

      {data.logs.length === 0 ? (
        <p className="hint">ยังไม่มีข้อมูล — เริ่มทวนแล้วสถิติจะขึ้นที่นี่</p>
      ) : (
        <div className="stack">
          <section className="tiles">
            <StatTile label="Retention จริง (30 วัน)" value={pct(s.retention30.value)} sub={`เป้า ${pct(desired)} · n=${s.retention30.n}`} />
            <StatTile label="Retention จริง (ทั้งหมด)" value={pct(s.retentionAll.value)} sub={`n=${s.retentionAll.n}`} />
            <StatTile label="Streak" value={`${s.streak.current} วัน`} sub={`ยาวสุด ${s.streak.longest} วัน${s.streak.studiedToday ? '' : ' · วันนี้ยังไม่ทวน'}`} />
            <StatTile label="วันนี้" value={`${s.today.reviews} ครั้ง`} sub={`${s.today.minutes} นาที`} />
          </section>
          {s.retention30.n > 0 && s.retention30.n < 30 && <p className="muted small">retention ยังมีตัวอย่างน้อย (n &lt; 30) ตัวเลขยังแกว่งได้มาก</p>}

          <section className="panel">
            <h2>item ที่จะครบกำหนด 30 วันข้างหน้า</h2>
            <p className="muted small">เฉพาะ pack ที่เปิดทวน · วันแรกรวม item ที่ค้างอยู่</p>
            <ColumnChart
              unit="item"
              bars={s.forecast.map((d, i) => ({ key: d.day, label: i === 0 ? 'วันนี้' : shortDay(d.day), value: d.count, detail: `${i === 0 ? 'วันนี้' : shortDay(d.day)}: ${d.count} item` }))}
            />
            <DataTable head={['วัน', 'item']} rows={s.forecast.map((d) => [d.day, d.count])} />
          </section>

          <section className="panel">
            <h2>เวลาที่ใช้ต่อวัน (30 วันล่าสุด)</h2>
            <ColumnChart
              unit="นาที"
              bars={s.minutes.map((d) => ({ key: d.day, label: shortDay(d.day), value: d.minutes, detail: `${shortDay(d.day)}: ${d.minutes} นาที · ${d.reviews} ครั้ง` }))}
            />
            <DataTable head={['วัน', 'นาที', 'ครั้ง']} rows={s.minutes.map((d) => [d.day, d.minutes, d.reviews])} />
          </section>

          <section className="panel">
            <h2>ความแม่นราย pack</h2>
            <HBarList rows={s.byPack.map((r) => ({ key: r.key, label: findEntry(r.key)?.title ?? `${r.key} (ถูกถอด)`, value: r.acc.value, note: `n=${r.acc.n}` }))} format={(v) => pct(v)} />
          </section>

          <section className="panel">
            <h2>ความแม่นตามชนิด item</h2>
            <HBarList rows={s.byType.map((r) => ({ key: r.key, label: ITEM_TYPE_LABEL[r.key as ItemType] ?? r.key, value: r.acc.value, note: `n=${r.acc.n}` }))} format={(v) => pct(v)} />
          </section>

          <section className="panel">
            <h2>ชนิดความผิดพลาด ({totalErrors})</h2>
            <HBarList
              rows={s.errors.map((e) => ({
                key: e.type,
                label: e.type === 'unspecified' ? 'ไม่ได้ระบุ' : ERROR_TYPE_LABEL[e.type],
                value: e.count,
                note: totalErrors ? pct(e.count / totalErrors) : undefined,
              }))}
              format={(v) => `${v} ครั้ง`}
            />
          </section>

          <section className="panel">
            <h2>Leech ({s.leeches.length})</h2>
            {s.leeches.length === 0 ? (
              <p className="muted small">ยังไม่มี item ที่ลืมซ้ำถึง {data.settings.leechThreshold} ครั้ง</p>
            ) : (
              <>
                <ul className="plain">
                  {s.leeches.map((l) => (
                    <li key={l.id} className="row-between">
                      <span className="small">{l.item?.front?.split('\n')[0] ?? l.id}</span>
                      <span className="muted small">ลืม {l.lapses} ครั้ง</span>
                    </li>
                  ))}
                </ul>
                <p className="muted small">
                  ส่งไปให้ Claude เขียนใหม่: <a href={href('/settings')}>ตั้งค่า → Export สำหรับ /debrief</a>
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
