import { vaultIndex } from '../data/vault';
import { usePackPrefs } from '../hooks';
import { href } from '../router';

export function HomePage() {
  const prefs = usePackPrefs();
  const enabled = vaultIndex.packs.filter((p) => prefs.get(p.id));
  const itemCount = enabled.reduce((sum, p) => sum + p.itemCount, 0);

  return (
    <div className="page home">
      <header className="page-head">
        <h1>Med Game Vault</h1>
        <p className="muted">คลังเกม + ระบบทวน</p>
      </header>

      <section className="hero panel">
        <p className="muted small">วันนี้</p>
        <p className="hero-number">—</p>
        <p className="muted">item ครบกำหนด (ระบบทวนจะเปิดใน Phase 2)</p>
        <button type="button" className="primary big" disabled>
          เริ่มทวน
        </button>
        <p className="muted small">
          เปิดทวนอยู่ {enabled.length} pack · {itemCount} item
        </p>
      </section>

      <nav className="shortcuts">
        <a className="shortcut" href={href('/vault')}>
          <strong>คลัง</strong>
          <span className="muted small">{vaultIndex.packs.length} pack</span>
        </a>
        <span className="shortcut disabled" aria-disabled="true">
          <strong>สถิติ</strong>
          <span className="muted small">Phase 5</span>
        </span>
        <a className="shortcut" href={href('/settings')}>
          <strong>ตั้งค่า</strong>
          <span className="muted small">ธีม, ข้อมูล</span>
        </a>
      </nav>
    </div>
  );
}
