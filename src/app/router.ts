import { useEffect, useState } from 'react';

/**
 * Hash router ขนาดเล็ก — GitHub Pages ไม่มี SPA fallback ถ้าใช้ path ปกติ รีเฟรชแล้วจะ 404
 * รูปแบบ: #/  #/vault  #/pack/<id>?tab=rules  #/settings
 */
export interface Route {
  path: string[];
  query: URLSearchParams;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [pathPart = '/', queryPart = ''] = raw.split('?');
  return {
    path: pathPart.split('/').filter(Boolean).map(decodeURIComponent),
    query: new URLSearchParams(queryPart),
  };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function href(path: string, query?: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v) q.set(k, v);
  const qs = q.toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

export function navigate(path: string, query?: Record<string, string | undefined>, replace = false): void {
  const target = href(path, query);
  if (replace) window.history.replaceState(null, '', target);
  else window.location.hash = target.slice(1);
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}
