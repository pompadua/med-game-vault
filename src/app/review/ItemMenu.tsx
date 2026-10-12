import { useState } from 'react';
import type { ReviewItem } from '../../core/items/types';
import { buryUntilTomorrow, flagContent, setSuspended } from '../repo';

/** เมนูระหว่างทวน: พักไว้ / เลื่อนไปพรุ่งนี้ / แจ้งว่าเนื้อหาน่าจะผิด */
export function ItemMenu({ item, onDone }: { item: ReviewItem; onDone: (action: 'suspend' | 'bury' | 'flag') => void }) {
  const [open, setOpen] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const [note, setNote] = useState('');

  if (flagging) {
    return (
      <div className="sheet" role="dialog" aria-label="แจ้งว่าเนื้อหาน่าจะผิด">
        <h3>แจ้งว่าเนื้อหาน่าจะผิด</h3>
        <p className="muted small">จะถูกส่งต่อให้ /audit-pack ผ่าน “Export สำหรับ Claude” ในหน้าตั้งค่า</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="อะไรผิด / ควรเป็นอะไร / อ้างอิงจากไหน" rows={3} autoFocus />
        <div className="sheet-actions">
          <button type="button" className="secondary" onClick={() => setFlagging(false)}>
            ยกเลิก
          </button>
          <button
            type="button"
            className="primary"
            disabled={!note.trim()}
            onClick={async () => {
              await flagContent(item, note);
              setFlagging(false);
              setNote('');
              onDone('flag');
            }}
          >
            ส่งแจ้ง
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="item-menu">
      <button type="button" className="icon-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} aria-label="ตัวเลือกเพิ่มเติม">
        ⋯
      </button>
      {open && (
        <div className="menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await setSuspended(item, true);
              onDone('suspend');
            }}
          >
            พักไว้ (suspend)
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await buryUntilTomorrow(item);
              onDone('bury');
            }}
          >
            เลื่อนไปพรุ่งนี้ (bury)
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setFlagging(true);
            }}
          >
            แจ้งว่าเนื้อหาน่าจะผิด
          </button>
        </div>
      )}
    </div>
  );
}
