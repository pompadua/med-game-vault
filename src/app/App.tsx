import { HomePage } from './pages/HomePage';
import { PackPage } from './pages/PackPage';
import { PlayPage } from './pages/PlayPage';
import { PracticePage } from './pages/PracticePage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { VaultPage } from './pages/VaultPage';
import { href, useRoute } from './router';

const NAV = [
  { path: '/', label: 'หน้าหลัก', match: '' },
  { path: '/vault', label: 'คลัง', match: 'vault' },
  { path: '/stats', label: 'สถิติ', match: 'stats' },
  { path: '/settings', label: 'ตั้งค่า', match: 'settings' },
];

export function App() {
  const route = useRoute();
  const [section = '', param] = route.path;

  let page;
  if (section === 'vault') page = <VaultPage query={route.query} />;
  else if (section === 'pack' && param) page = <PackPage packId={param} tab={route.query.get('tab') ?? undefined} />;
  else if (section === 'review') page = <ReviewPage query={route.query} />;
  else if (section === 'play') page = <PlayPage key={route.query.toString()} query={route.query} />;
  else if (section === 'practice') page = <PracticePage />;
  else if (section === 'stats') page = <StatsPage />;
  else if (section === 'settings') page = <SettingsPage />;
  else page = <HomePage />;

  const active = section === 'pack' ? 'vault' : section;
  // หน้าทวน/เล่นเกมซ่อนแถบเมนู ให้พื้นที่ล่างจอเป็นของปุ่มตอบ
  const focusMode = section === 'review' || section === 'play';

  return (
    <div className={focusMode ? 'app focus' : 'app'}>
      <main className="main">{page}</main>
      {!focusMode && (
        <nav className="tabbar" aria-label="เมนูหลัก">
          {NAV.map((n) => (
            <a key={n.path} href={href(n.path)} className={active === n.match ? 'tab active' : 'tab'} aria-current={active === n.match ? 'page' : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
