import { createContext, useContext, useEffect, useState } from 'react';

export type ThemePref = 'dark' | 'light' | 'system';
const KEY = 'tj.theme';

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'system' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

function resolve(p: ThemePref): 'dark' | 'light' {
  if (p !== 'system') return p;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(p: ThemePref) {
  const t = resolve(p);
  document.documentElement.setAttribute('data-theme', t);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'light' ? '#f0f4f8' : '#0a0e1a');
  window.dispatchEvent(new Event('tj-theme'));
}

export function useThemePref(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(readThemePref);
  useEffect(() => {
    applyTheme(pref);
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const on = () => applyTheme('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [pref]);
  return [
    pref,
    (p) => {
      try {
        localStorage.setItem(KEY, p);
      } catch {
        /* ignore */
      }
      setPref(p);
    },
  ];
}

/** Resolved token colours for libraries (recharts) that need literal values. Updates on theme change. */
export function useTokens() {
  const read = () => {
    const cs = getComputedStyle(document.documentElement);
    const g = (n: string) => cs.getPropertyValue(n).trim();
    return {
      gain: g('--gain'),
      loss: g('--loss'),
      flat: g('--flat'),
      brand: g('--brand'),
      ink2: g('--ink-2'),
      ink3: g('--ink-3'),
      line: g('--line'),
      lineStrong: g('--line-strong'),
      surface2: g('--surface-2'),
    };
  };
  const [t, setT] = useState(read);
  useEffect(() => {
    const on = () => setT(read());
    window.addEventListener('tj-theme', on);
    return () => window.removeEventListener('tj-theme', on);
  }, []);
  return t;
}

export const ThemeContext = createContext<[ThemePref, (p: ThemePref) => void]>(['dark', () => {}]);
export function useTheme() {
  return useContext(ThemeContext);
}
