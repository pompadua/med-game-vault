import { ITEM_TYPE_LABEL, type ItemType } from '../../core/items/types';
import { filterPacks, type VaultFilters } from '../../core/vaultFilter';
import type { PackIndexEntry } from '../../core/vaultIndex';
import { Badge, formatDate, StatusBadge, STATUS_LABEL } from '../components/ui';
import { rotationLabel, subjectLabel, taxonomy, vaultIndex } from '../data/vault';
import { usePackPrefs } from '../hooks';
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
  };
}

export function VaultPage({ query }: { query: URLSearchParams }) {
  const filters = readFilters(query);
  const prefs = usePackPrefs();
  const packs = filterPacks(vaultIndex.packs, filters, prefs);

  const update = (patch: Partial<Record<keyof VaultFilters, string | undefined>>) => {
    const next: Record<string, string | undefined> = {};
    for (const [k, v] of query.entries()) next[k] = v;
    Object.assign(next, patch);
    navigate('/vault', next, true);
  };

  const usedSubjects = [...new Set(vaultIndex.packs.map((p) => p.subject))];
  const usedRotations = [...new Set(vaultIndex.packs.map((p) => p.rotation))];
  const usedTags = [...new Set(vaultIndex.packs.flatMap((p) => p.tags))].sort();
  const anyFilter = Object.values(filters).some(Boolean);

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
      <p className="hint">ตัวกรอง “มี item ครบกำหนด” และ “จุดอ่อน” จะใช้ได้เมื่อระบบทวนพร้อม (Phase 2)</p>

      {anyFilter && (
        <button type="button" className="link-button" onClick={() => navigate('/vault', {}, true)}>
          ล้างตัวกรอง
        </button>
      )}

      <ul className="pack-list">
        {packs.map((p) => (
          <li key={p.id}>
            <PackCard entry={p} enabled={prefs.get(p.id) ?? false} />
          </li>
        ))}
      </ul>
      {packs.length === 0 && <p className="empty">ไม่พบ pack ที่ตรงกับเงื่อนไข</p>}
    </div>
  );
}

function PackCard({ entry, enabled }: { entry: PackIndexEntry; enabled: boolean }) {
  const top = (Object.entries(entry.countsByType) as [ItemType, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([t, n]) => `${ITEM_TYPE_LABEL[t]} ${n}`)
    .join(' · ');
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
      </div>
      <div className="progress-row" aria-label="ความคืบหน้า">
        <span>
          <strong>{entry.itemCount}</strong> ใหม่
        </span>
        <span>
          <strong>0</strong> กำลังเรียน
        </span>
        <span>
          <strong>0</strong> ทวน
        </span>
      </div>
      <p className="muted small">{top}</p>
      <p className="muted small">
        ทวนล่าสุด — · retention — · verified {formatDate(entry.verifiedAt)}
      </p>
    </a>
  );
}
