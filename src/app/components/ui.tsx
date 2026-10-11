import type { ReactNode } from 'react';
import type { PackStatus } from '../../core/schema/pack';

export const STATUS_LABEL: Record<PackStatus, string> = {
  draft: 'ร่าง',
  verified: 'ตรวจแล้ว',
  'needs-audit': 'ต้อง audit',
};

export function StatusBadge({ status }: { status: PackStatus }) {
  return <span className={`badge status-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function Badge({ children, tone }: { children: ReactNode; tone?: 'muted' | 'warn' | 'accent' }) {
  return <span className={`badge ${tone ? `tone-${tone}` : ''}`}>{children}</span>;
}

export function RuleOfThumb() {
  return (
    <Badge tone="warn">
      <span title="ข้อความนี้ถูกตัดทอนให้ง่ายขึ้น ใช้เป็นหลักจำ ไม่ใช่ข้อความแม่นยำทุกกรณี">rule of thumb</span>
    </Badge>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="toggle">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      <span>{label}</span>
    </label>
  );
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}
