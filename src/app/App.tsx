import { HomePage } from './pages/HomePage';
import { PackPage } from './pages/PackPage';
import { SettingsPage } from './pages/SettingsPage';
import { VaultPage } from './pages/VaultPage';
import { href, useRoute } from './router';

const NAV = [
  { path: '/', label: 'หน้าหลัก', match: '' },
  { path: '/vault', label: 'คลัง', match: 'vault' },
  { path: '/settings', label: 'ตั้งค่า', match: 'settings' },
];

export function App() {
  const route = useRoute();
  const [section = '', param] = route.path;

  let page;
  if (section === 'vault') page = <VaultPage query={route.query} />;
  else if (section === 'pack' && param) page = <PackPage packId={param} tab={route.query.get('tab') ?? undefined} />;
  else if (section === 'settings') page = <SettingsPage />;
  else page = <HomePage />;

  const active = section === 'pack' ? 'vault' : section;

  return (
    <div className="app">
      <main className="main">{page}</main>
      <nav className="tabbar" aria-label="เมนูหลัก">
        {NAV.map((n) => (
          <a key={n.path} href={href(n.path)} className={active === n.match ? 'tab active' : 'tab'} aria-current={active === n.match ? 'page' : undefined}>
            {n.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
