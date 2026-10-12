import { useEffect, useMemo, useState } from 'react';
import { makeDebriefExport } from '../../core/srs/backup';
import type { ReviewSettings } from '../../core/srs/settings';
import { formatDate } from '../components/ui';
import { vaultIndex } from '../data/vault';
import { downloadJson, readJsonFile, stamp } from '../download';
import { useItems, useReviewData } from '../hooks';
import { exportAll, importMerge, loadVaultData, resolveFlags, saveSettings, setSuspended } from '../repo';

type Theme = 'system' | 'light' | 'dark';
const THEME_KEY = 'mgv-theme';

export function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function SettingsPage() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const data = useReviewData();

  useEffect(() => {
    applyTheme(theme);
    try {
      if (theme === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, theme);
    } catch {
      // browser storage ใช้ไม่ได้ (private mode) — ธีมยังเปลี่ยนได้ในรอบนี้
    }
  }, [theme]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>ตั้งค่า</h1>
      </header>
      <div className="stack">
        <section className="panel">
          <h2>ธีม</h2>
          <div className="segmented" role="radiogroup" aria-label="ธีม">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={theme === t} className={theme === t ? 'seg active' : 'seg'} onClick={() => setTheme(t)}>
                {t === 'system' ? 'ตามระบบ' : t === 'light' ? 'สว่าง' : 'มืด'}
              </button>
            ))}
          </div>
        </section>
        {data ? (
          <>
            <ReviewSettingsForm settings={data.settings} />
            <DataSection lastExportAt={data.lastExportAt} />
            <ClaudeSection />
            <SuspendedSection />
            <RemovedPacks />
          </>
        ) : (
          <p className="muted">กำลังโหลด…</p>
        )}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  hint,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  hint?: string;
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const v = Number(text);
    if (Number.isFinite(v) && v >= min && v <= max) onCommit(v);
    else setText(String(value));
  };
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" inputMode="decimal" min={min} max={max} step={step} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} />
      {hint && <span className="muted small">{hint}</span>}
    </label>
  );
}

function ReviewSettingsForm({ settings: s }: { settings: ReviewSettings }) {
  const save = (patch: Partial<ReviewSettings>) => void saveSettings(patch);
  return (
    <section className="panel">
      <h2>ระบบทวน</h2>
      <div className="form-grid">
        <NumberField label="Desired retention" value={s.desiredRetention} min={0.7} max={0.99} step={0.01} hint="สูง = ทวนถี่ขึ้น จำได้มากขึ้น (ค่าเริ่มต้น 0.9)" onCommit={(v) => save({ desiredRetention: v })} />
        <NumberField label="item ใหม่ต่อวัน" value={s.newPerDay} min={0} max={500} onCommit={(v) => save({ newPerDay: v })} />
        <NumberField label="Deduction/Campaign ต่อวัน" value={s.longPerDay} min={0} max={50} onCommit={(v) => save({ longPerDay: v })} />
        <NumberField label="วันใหม่เริ่มกี่โมง" value={s.dayStartHour} min={0} max={23} hint={`time zone: ${s.timeZone}`} onCommit={(v) => save({ dayStartHour: v })} />
        <NumberField label="Leech เมื่อลืมซ้ำ ≥" value={s.leechThreshold} min={2} max={50} onCommit={(v) => save({ leechThreshold: v })} />
        <NumberField label="จุดอ่อน: ความแม่น <" value={s.weakThreshold} min={0} max={1} step={0.05} onCommit={(v) => save({ weakThreshold: v })} />
        <NumberField label="Easy เมื่อใช้เวลา ≤ (สัดส่วนของ targetSeconds)" value={s.easyTimeRatio} min={0.1} max={1} step={0.05} onCommit={(v) => save({ easyTimeRatio: v })} />
        <NumberField label="Guess Who: Hard เมื่อลึกกว่า optimal ≥" value={s.guessWhoHardExtraDepth} min={1} max={5} onCommit={(v) => save({ guessWhoHardExtraDepth: v })} />
        <NumberField label="เตือนสำรองเมื่อไม่ได้ export เกิน (วัน)" value={s.backupReminderDays} min={1} max={90} onCommit={(v) => save({ backupReminderDays: v })} />
        <label className="field">
          <span>Time zone</span>
          <select value={s.timeZone} onChange={(e) => save({ timeZone: e.target.value })}>
            {['Asia/Bangkok', 'UTC', 'Asia/Tokyo', 'Europe/London', 'America/New_York'].map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>
        <label className="field checkbox">
          <input type="checkbox" checked={s.enableFuzz} onChange={(e) => save({ enableFuzz: e.target.checked })} />
          <span>Fuzz interval (กันไม่ให้ item ที่เรียนพร้อมกันครบกำหนดวันเดียวกันหมด)</span>
        </label>
      </div>
    </section>
  );
}

function DataSection({ lastExportAt }: { lastExportAt: string | undefined }) {
  const [msg, setMsg] = useState<string>();
  return (
    <section className="panel" id="data">
      <h2>สำรอง / กู้คืนข้อมูล</h2>
      <p className="muted small">
        ข้อมูลการทวนอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น (IndexedDB) ไม่ได้ขึ้นเว็บ — export เป็นไฟล์ JSON เก็บไว้เป็นระยะ · export ล่าสุด {formatDate(lastExportAt)}
      </p>
      <div className="button-row">
        <button
          type="button"
          className="primary"
          onClick={async () => {
            const file = await exportAll();
            downloadJson(`med-game-vault-backup-${stamp()}.json`, file);
            setMsg(`export แล้ว: ${file.itemStates.length} item, ${file.reviewLogs.length} log`);
          }}
        >
          Export ทั้งหมด
        </button>
        <label className="secondary file-button">
          Import (merge)
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const s = await importMerge(await readJsonFile(f));
                setMsg(`import แล้ว: เพิ่ม ${s.statesAdded} item, แทนที่ ${s.statesReplaced} item (ที่ทวนล่าสุดกว่า), log ใหม่ ${s.logsAdded}, แจ้งผิดใหม่ ${s.flagsAdded}`);
              } catch (err) {
                setMsg(`import ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
              }
            }}
          />
        </label>
      </div>
      {msg && <p className="hint">{msg}</p>}
    </section>
  );
}

function ClaudeSection() {
  const all = useItems();
  const data = useReviewData();
  const [msg, setMsg] = useState<string>();
  const counts = useMemo(() => {
    if (!data) return undefined;
    return {
      errors: data.logs.filter((l) => l.grade === 1).length,
      leeches: [...data.states.values()].filter((s) => s.leech).length,
      flags: data.flags.filter((f) => !f.resolved).length,
    };
  }, [data]);
  return (
    <section className="panel">
      <h2>Export สำหรับ Claude Code</h2>
      <p className="muted small">
        error log + leech + item ที่แจ้งว่าผิด เป็น JSON — วางไฟล์ไว้ในโฟลเดอร์โปรเจกต์ แล้วสั่ง <code>/debrief &lt;path&gt;</code> หรือ <code>/audit-pack &lt;packId&gt;</code>
      </p>
      {counts && (
        <p className="small">
          ตอบผิด {counts.errors} ครั้ง · leech {counts.leeches} · แจ้งผิดค้างอยู่ {counts.flags}
        </p>
      )}
      <div className="button-row">
        <button
          type="button"
          className="primary"
          disabled={!all}
          onClick={async () => {
            const vault = await loadVaultData();
            const out = makeDebriefExport(vault, new Map(all!.items.map((i) => [i.id, i])), new Date());
            downloadJson(`med-game-vault-debrief-${stamp()}.json`, out);
            setMsg(`export แล้ว: error ${out.errors.length}, leech ${out.leeches.length}, flag ${out.flags.length}`);
          }}
        >
          Export สำหรับ /debrief
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!counts?.flags}
          onClick={async () => {
            await resolveFlags(data!.flags.filter((f) => !f.resolved).map((f) => f.id));
            setMsg('ทำเครื่องหมายว่าแก้แล้วทั้งหมด');
          }}
        >
          ทำเครื่องหมายว่าแก้ flag แล้ว
        </button>
      </div>
      {msg && <p className="hint">{msg}</p>}
    </section>
  );
}

function SuspendedSection() {
  const data = useReviewData();
  const all = useItems();
  if (!data || !all) return null;
  const byId = new Map(all.items.map((i) => [i.id, i]));
  const suspended = [...data.states.values()].filter((s) => s.suspended);
  if (!suspended.length) return null;
  return (
    <section className="panel">
      <h2>item ที่พักไว้ ({suspended.length})</h2>
      <ul className="plain">
        {suspended.map((s) => {
          const it = byId.get(s.id);
          return (
            <li key={s.id} className="row-between">
              <span className="small">{it?.front?.split('\n')[0] ?? s.id}</span>
              {it && (
                <button type="button" className="link-button" onClick={() => void setSuspended(it, false)}>
                  เลิกพัก
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** pack ที่หายจาก repo: ไม่ลบประวัติ แค่แสดงไว้ที่นี่ */
function RemovedPacks() {
  const data = useReviewData();
  if (!data) return null;
  const known = new Set(vaultIndex.packs.map((p) => p.id));
  const removed = new Map<string, { states: number; logs: number }>();
  for (const s of data.states.values()) {
    if (known.has(s.packId)) continue;
    const r = removed.get(s.packId) ?? { states: 0, logs: 0 };
    r.states++;
    removed.set(s.packId, r);
  }
  for (const l of data.logs) {
    if (known.has(l.packId)) continue;
    const r = removed.get(l.packId) ?? { states: 0, logs: 0 };
    r.logs++;
    removed.set(l.packId, r);
  }
  return (
    <section className="panel">
      <h2>pack ที่ถูกถอด</h2>
      {removed.size === 0 ? (
        <p className="muted small">ไม่มี — ถ้า pack หายจาก repo ประวัติการทวนจะยังอยู่และแสดงที่นี่</p>
      ) : (
        <ul className="plain">
          {[...removed].map(([id, r]) => (
            <li key={id}>
              <strong>{id}</strong>
              <span className="muted small">
                {' '}
                · {r.states} item state · {r.logs} log (เก็บไว้ ไม่ถูกลบ)
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
