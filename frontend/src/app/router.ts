import { useEffect, useState } from 'react';

export const ROUTES = ['today', 'calendar', 'trades', 'insights', 'settings'] as const;
export type Route = (typeof ROUTES)[number];

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, '').split(/[?/]/)[0] ?? '';
  return (ROUTES as readonly string[]).includes(h) ? (h as Route) : 'today';
}

export function useRoute(): Route {
  const [r, setR] = useState<Route>(parse);
  useEffect(() => {
    const on = () => setR(parse());
    window.addEventListener('hashchange', on);
    // Normalize unknown/empty hashes without adding a history entry.
    if (!/^#\/(today|calendar|trades|insights|settings)\b/.test(location.hash)) {
      history.replaceState(null, '', `#/${parse()}`);
    }
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [r]);
  return r;
}

export function href(r: Route): string {
  return `#/${r}`;
}

export function navigate(r: Route) {
  if (parse() !== r) location.hash = `/${r}`;
}
