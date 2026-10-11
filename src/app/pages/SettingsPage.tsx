import { useEffect, useState } from 'react';

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
      <section className="panel">
        <h2>ระบบทวนและข้อมูล</h2>
        <p className="muted">
          Desired retention, ขอบวัน 04:00, จำกัด item ใหม่ต่อวัน, export/import และรายการ pack ที่ถูกถอด จะมาใน Phase 2
        </p>
      </section>
    </div>
  );
}
