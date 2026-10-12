import { useMemo } from 'react';
import { ITEM_TYPE_LABEL, type ItemType } from '../../core/items/types';
import { computeProgress, type Progress } from '../../core/srs/progress';
import { filterPacks, type PackRuntimeStats, type VaultFilters } from '../../core/vaultFilter';
import type { PackIndexEntry } from '../../core/vaultIndex';
import { Badge, formatDate, StatusBadge, STATUS_LABEL } from '../components/ui';
import { rotationLabel, subjectLabel, taxonomy, vaultIndex } from '../data/vault';
import { useItems, usePackPrefs, useReviewData } from '../hooks';
import { href, navigate } from '../router';

function readFilters(q: URLSearchParams): VaultFilters {
  const review = q.get('review');
  return {
    q: q.get('q') ?? undefined,
    subject: q.get('subject') ?? undefined,
    rotation: q.get('rotation') ?? undefined,
    tag: q.get('tag') ?? undefined,
    status: q.get('status') ?? undefined,
    review: review === 'on' || review === 'off' ? review : undefined,
    due: q.get('due') === '1' || undefined,
  };
}

/** ความคืบหน้าราย pack จาก IndexedDB */
export function usePackProgress(): Map<string, Progress> | undefined {
  const data = useReviewData();
  const all = useItems();
  return useMemo(() => {
    if (!data || !all) return undefined;
    const now = new Date();
    const out = new Map<string, Progress>();
    for (const entry of vaultIndex.packs) {
      const items = all.items.filter((i) => i.packId === entry.id);
      const logs = data.logs.filter((l) => l.packId === entry.id);
      out.set(entry.id, computeProgress(items, data.states, logs, now));
    }
    return out;
  }, [data, all]);
}

export function VaultPage({ query }: { query: URLSearchParams }) {
  const filters = readFilters(query);
  const weak = query.get('weak') === '1';
  const prefs = usePackPrefs();
  const data = useReviewData();
  const progress = usePackProgress();

  const stats = useMemo(() => {
    const m = new Map<string, PackRuntimeStats>();
    for (const [id, p] of progress ?? []) m.set(id, { dueCount: p.due, accuracy: p.accuracy });
    return m;
  }, [progress]);
  const packs = filterPacks(vaultIndex.packs, { ...filters, weakBelow: weak && data ? data.settings.weakThreshold : undefined }, prefs, stats);

  const update = (patch: Record<string, string | undefined>) => {
    const next: Record<string, string | undefined> = {};
    for (const [k, v] of query.entries()) next[k] = v;
    Object.assign(next, patch);
    navigate('/vault', next, true);
  };

  const usedSubjects = [...new Set(vaultIndex.packs.map((p) => p.subject))];
  const usedRotations = [...new Set(vaultIndex.packs.map((p) => p.rotation))];
  const usedTags = [...new Set(vaultIndex.packs.flatMap((p) => p.tags))].sort();
  const anyFilter = [...query.keys()].length > 0;

  return (
    <div className="page">
      <header className="page-head">
        <h1>คลัง</h1>
        <p className="muted">{vaultIndex.packs.length} pack</p>
      </header>

      <input
        className="search"
        type="search"
        inputMode="search"
        placeholder="ค้นหา เช่น หัวใจ, HFrEF, ARNI…"
        value={filters.q ?? ''}
        onChange={(e) => update({ q: e.target.value || undefined })}
        aria-label="ค้นหา pack"
      />

      <div className="filters">
        <select value={filters.subject ?? ''} onChange={(e) => update({ subject: e.target.value || undefined })} aria-label="subject">
          <option value="">ทุก subject</option>
          {taxonomy.subjects
            .filter((s) => usedSubjects.includes(s.id))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.th}
              </option>
            ))}
        </select>
        <select value={filters.rotation ?? ''} onChange={(e) => update({ rotation: e.target.value || undefined })} aria-label="rotation">
          <option value="">ทุก rotation</option>
          {taxonomy.rotations
            .filter((r) => usedRotations.includes(r.id))
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.th}
              </option>
            ))}
        </select>
        <select value={filters.tag ?? ''} onChange={(e) => update({ tag: e.target.value || undefined })} aria-label="tag">
          <option value="">ทุก tag</option>
          {usedTags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
        <select value={filters.status ?? ''} onChange={(e) => update({ status: e.target.value || undefined })} aria-label="สถานะ">
          <option value="">ทุกสถานะ</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={filters.review ?? ''} onChange={(e) => update({ review: e.target.value || undefined })} aria-label="การทวน">
          <option value="">ทวน: ทั้งหมด</option>
          <option value="on">เปิดทวนอยู่</option>
          <option value="off">พักไว้</option>
        </select>
      </div>
      <div className="chips">
        <button type="button" className={filters.due ? 'chip active' : 'chip'} aria-pressed={!!filters.due} onClick={() => update({ due: filters.due ? undefined : '1' })}>
          มี item ครบกำหนด
        </button>
        <button type="button" className={weak ? 'chip active' : 'chip'} aria-pressed={weak} onClick={() => update({ weak: weak ? undefined : '1' })}>
          จุดอ่อน (แม่น &lt; {Math.round((data?.settings.weakThreshold ?? 0.8) * 100)}%)
        </button>
        {anyFilter && (
          <button type="button" className="link-button" onClick={() => navigate('/vault', {}, true)}>
            ล้างตัวกรอง
          </button>
        )}
      </div>

      <ul className="pack-list">
        {packs.map((p) => (
          <li key={p.id}>
            <PackCard entry={p} enabled={prefs.get(p.id) ?? false} progress={progress?.get(p.id)} />
          </li>
        ))}
      </ul>
      {packs.length === 0 && <p className="empty">ไม่พบ pack ที่ตรงกับเงื่อนไข</p>}
    </div>
  );
}

const pct = (v: number | undefined) => (v === undefined ? '—' : `${Math.round(v * 100)}%`);

function PackCard({ entry, enabled, progress: p }: { entry: PackIndexEntry; enabled: boolean; progress: Progress | undefined }) {
  const top = (Object.entries(entry.countsByType) as [ItemType, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([t, n]) => `${ITEM_TYPE_LABEL[t]} ${n}`)
    .join(' · ');
  const total = p?.total || entry.itemCount;
  const seg = (n: number) => `${(100 * n) / Math.max(1, total)}%`;
  return (
    <a className="pack-card" href={href(`/pack/${entry.id}`)}>
      <div className="pack-card-head">
        <h2>{entry.title}</h2>
        <StatusBadge status={entry.status} />
      </div>
      <div className="badges">
        <Badge tone="accent">{subjectLabel(entry.subject)}</Badge>
        <Badge tone="muted">{rotationLabel(entry.rotation)}</Badge>
        <Badge tone={enabled ? 'accent' : 'muted'}>{enabled ? 'เปิดทวน' : 'พักไว้'}</Badge>
        {p && p.due > 0 && <Badge tone="warn">ครบกำหนด {p.due}</Badge>}
        {p && p.leeches > 0 && <Badge tone="warn">leech {p.leeches}</Badge>}
      </div>
      <div className="progress-bar" aria-hidden="true">
        <span className="seg-review" style={{ width: seg(p?.review ?? 0) }} />
        <span className="seg-learning" style={{ width: seg(p?.learning ?? 0) }} />
      </div>
      <div className="progress-row" aria-label="ความคืบหน้า">
        <span>
          <strong>{p?.newCount ?? entry.itemCount}</strong> ใหม่
        </span>
        <span>
          <strong>{p?.learning ?? 0}</strong> กำลังเรียน
        </span>
        <span>
          <strong>{p?.review ?? 0}</strong> ทวน
        </span>
      </div>
      <p className="muted small">{top}</p>
      <p className="muted small">
        ทวนล่าสุด {formatDate(p?.lastReviewedAt)} · retention {pct(p?.retention)} · แม่น {pct(p?.accuracy)} · verified {formatDate(entry.verifiedAt)}
      </p>
    </a>
  );
}
