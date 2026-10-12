import { useState } from 'react';
import { ERROR_TYPE_LABEL, ERROR_TYPES, type ErrorType } from '../../core/srs/model';

const HINT: Record<ErrorType, string> = {
  fact: 'จำข้อมูลไม่ได้ / ไม่เคยรู้',
  rule: 'รู้ข้อมูลแต่ใช้กฎหรือเหตุผลผิด',
  trap: 'โดนตัวหลอกหรือ trap pair',
  clue: 'มองข้ามหรืออ่านโจทย์/clue ผิด',
};

/** ตอบผิดทุกครั้งต้องเลือกชนิดความผิดพลาด (บันทึกไว้ให้ /debrief) */
export function ErrorSheet({ onSubmit, onCancel }: { onSubmit: (type: ErrorType, note: string) => void; onCancel?: () => void }) {
  const [type, setType] = useState<ErrorType>();
  const [note, setNote] = useState('');
  return (
    <div className="sheet" role="dialog" aria-label="ชนิดความผิดพลาด">
      <h3>พลาดเพราะอะไร?</h3>
      <div className="error-types" role="radiogroup">
        {ERROR_TYPES.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={type === t} className={type === t ? 'choice active' : 'choice'} onClick={() => setType(t)}>
            <strong>{ERROR_TYPE_LABEL[t]}</strong>
            <span className="muted small">{HINT[t]}</span>
          </button>
        ))}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="โน้ตสั้น ๆ (ไม่บังคับ)" rows={2} />
      <div className="sheet-actions">
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            กลับ
          </button>
        )}
        <button type="button" className="primary" disabled={!type} onClick={() => type && onSubmit(type, note)}>
          บันทึก
        </button>
      </div>
    </div>
  );
}
