import { useState } from 'react';

/**
 * กราฟเล็ก ๆ ไม่ใช้ library: single series สีเดียว (accent) จึงไม่ต้องมี legend
 * แตะ/hover แท่งเพื่อดูค่า และมีตารางสำรองเสมอ (ไม่พึ่งสีอย่างเดียว)
 */

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-tile">
      <span className="muted small">{label}</span>
      <strong className="stat-value">{value}</strong>
      {sub && <span className="muted small">{sub}</span>}
    </div>
  );
}

export interface Bar {
  key: string;
  label: string;
  value: number;
  /** ข้อความใน readout เมื่อเลือกแท่งนี้ */
  detail: string;
}

/** กราฟแท่งแนวตั้ง (เช่น ต่อวัน) — แตะแท่งเพื่อดูค่า */
export function ColumnChart({ bars, unit, height = 120, tickEvery = 7 }: { bars: Bar[]; unit: string; height?: number; tickEvery?: number }) {
  const [active, setActive] = useState<number>();
  const realMax = Math.max(0, ...bars.map((b) => b.value));
  // สเกลแกน: กันหารศูนย์เท่านั้น ห้ามเอาไปแสดงเป็นค่า
  const max = realMax > 0 ? realMax : 1;
  const shown = active !== undefined ? bars[active] : undefined;
  const total = bars.reduce((s, b) => s + b.value, 0);
  return (
    <figure className="chart">
      <p className="readout" aria-live="polite">
        {shown ? shown.detail : `รวม ${Math.round(total * 10) / 10} ${unit} · สูงสุด ${Math.round(realMax * 10) / 10} ${unit}/วัน`}
      </p>
      <div className="columns" style={{ height }} onMouseLeave={() => setActive(undefined)}>
        {bars.map((b, i) => (
          <button
            key={b.key}
            type="button"
            className={active === i ? 'column active' : 'column'}
            aria-label={b.detail}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
          >
            <span className="column-fill" style={{ height: b.value > 0 ? `max(${(b.value / max) * 100}%, 3px)` : 0 }} />
          </button>
        ))}
      </div>
      <div className="column-axis muted small" aria-hidden="true">
        {bars.map((b, i) => (
          <span key={b.key}>{i % tickEvery === 0 ? b.label : ''}</span>
        ))}
      </div>
    </figure>
  );
}

/** แท่งแนวนอนพร้อม label ตรงตัว (เช่น ความแม่นราย pack) */
export function HBarList({ rows, format }: { rows: { key: string; label: string; value: number | undefined; note?: string }[]; format: (v: number) => string }) {
  const max = Math.max(1e-9, ...rows.map((r) => r.value ?? 0));
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="hbar-head">
            <span>{r.label}</span>
            <span className="muted">
              {r.value === undefined ? '—' : format(r.value)}
              {r.note && <span className="small"> · {r.note}</span>}
            </span>
          </div>
          <div className="hbar-track" aria-hidden="true">
            <span className="hbar-fill" style={{ width: `${((r.value ?? 0) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="table-toggle">
      <summary>ดูเป็นตาราง</summary>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
