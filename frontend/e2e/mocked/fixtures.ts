// Backend-free fixtures for visual checks and the mocked Playwright suite (playwright.mock.config.ts).
// Everything is deterministic (seeded) and relative to the real "today", so screenshots always have a live session.
// Routes mocked: /config.json, Cognito InitiateAuth, every /api/* route the SPA calls, and the market module's
// /api/market/day/{date} + /api/market/bars (realistic ES/NQ/VIX, Forex Factory-style events, 1m candles).

import type { Page } from '@playwright/test';

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => ymd(new Date());

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const hash = (str: string) => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const SETUPS = ['Breakout', 'Pullback', 'Reversal', 'Range fade', 'Opening drive'];
const MISTAKES = ['FOMO entry', 'Moved stop', 'Oversized', 'Early exit', 'Revenge trade', 'No plan'];

export interface MockTrade {
  id: string;
  accountId: string | null;
  date: string;
  time?: string;
  exitTime?: string;
  symbol: string;
  assetType: 'futures' | 'option' | 'stock';
  side: 'long' | 'short';
  qty: number;
  entry: number;
  exit: number;
  fees: number;
  multiplier: number;
  setup?: string;
  mistakes?: string[];
  stop?: number;
  notes?: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

const addMin = (hhmm: string, m: number) => {
  const t = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) + m;
  return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
};

export function buildTrades(today = new Date()): MockTrade[] {
  const r = rng(7);
  const out: MockTrade[] = [];
  for (let back = 45; back >= 0; back--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    const wd = d.getDay();
    if (back > 0 && (wd === 0 || wd === 6)) continue;
    if (back > 0 && r() < 0.18) continue;
    const n = back === 0 ? 4 : 1 + Math.floor(r() * 5);
    for (let i = 0; i < n; i++) {
      const mnq = r() < 0.72;
      const sym = mnq ? 'MNQZ5' : 'MESZ5';
      const tick = 0.25;
      const base = mnq ? 21000 + Math.round(r() * 400) * tick : 5800 + Math.round(r() * 80) * tick;
      // Thursdays bleed (a real pattern the day-of-week breakdown should surface); Tuesdays are good.
      const bias = wd === 4 ? -0.62 : wd === 2 ? -0.3 : -0.42;
      const move = (r() + bias) * (mnq ? 40 : 10);
      const side = r() < 0.6 ? 'long' : 'short';
      const qty = 1 + Math.floor(r() * 3);
      const time = `${pad(9 + Math.floor(i * 1.2))}:${pad(30 + Math.floor(r() * 29))}`;
      const t: MockTrade = {
        id: `t${back}x${i}`,
        accountId: 'a1',
        date: ymd(d),
        time,
        exitTime: addMin(time, 2 + Math.floor(r() * 18)),
        symbol: sym,
        assetType: 'futures',
        side,
        qty,
        entry: base,
        exit: Math.round((base + (side === 'long' ? move : -move)) / tick) * tick,
        fees: Math.round(1.24 * qty * 100) / 100,
        multiplier: mnq ? 2 : 5,
        source: back === 0 ? 'manual' : 'tradovate',
        createdAt: d.toISOString(),
        updatedAt: d.toISOString(),
      };
      if (r() < 0.65) t.setup = SETUPS[Math.floor(r() * SETUPS.length)];
      if (r() < 0.28) t.mistakes = [MISTAKES[Math.floor(r() * 5)]!];
      if (r() < 0.35) t.stop = side === 'long' ? base - (mnq ? 10 : 3) : base + (mnq ? 10 : 3);
      out.push(t);
    }
  }
  // Today: a realistic morning — early FOMO loss, then two clean wins and a small give-back.
  const today0 = out.filter((t) => t.date === ymd(today));
  if (today0.length >= 4) {
    today0[0]!.mistakes = ['FOMO entry'];
    today0[0]!.setup = 'Breakout';
    today0[0]!.exit = today0[0]!.side === 'long' ? today0[0]!.entry - 9.5 : today0[0]!.entry + 9.5;
    today0[1]!.setup = 'Pullback';
    today0[1]!.exit = today0[1]!.side === 'long' ? today0[1]!.entry + 14.25 : today0[1]!.entry - 14.25;
    today0[2]!.setup = 'Pullback';
    today0[2]!.exit = today0[2]!.side === 'long' ? today0[2]!.entry + 8 : today0[2]!.entry - 8;
    delete today0[2]!.mistakes;
    delete today0[1]!.mistakes;
  }
  return out;
}

export interface MockOptions {
  /** No accounts/trades/days: first-run empty states. */
  empty?: boolean;
  /** Market routes fail (500) — the market UI must disappear quietly. */
  marketDown?: boolean;
  /** Coach route fails. */
  coachDown?: boolean;
  /** Signed-in user is in the Cognito `admin` group (access token carries cognito:groups) → Settings shows People. */
  admin?: boolean;
  /** The admin users list fails (500). */
  adminDown?: boolean;
}

// ── Admin fixtures ──────────────────────────────────────────────────────

export interface MockAdminUser {
  username: string;
  email: string;
  status: string;
  enabled: boolean;
  createdAt: string;
  lastModified: string;
  isAdmin: boolean;
  isSelf: boolean;
}

export const ME = 'trader@example.com';
export const TEMP_PASSWORD = 'Hk7mQ2pzW9xRt4Ns';

export function buildAdminUsers(): MockAdminUser[] {
  const at = '2026-10-01T12:00:00.000Z';
  const u = (username: string, email: string, over: Partial<MockAdminUser> = {}): MockAdminUser => ({
    username, email, status: 'CONFIRMED', enabled: true, createdAt: at, lastModified: at, isAdmin: false, isSelf: false, ...over,
  });
  return [
    u('u-friend', 'friend@example.com'),
    u('u-invited', 'invited@example.com', { status: 'FORCE_CHANGE_PASSWORD' }),
    u('u-me', ME, { isAdmin: true, isSelf: true }),
    u('u-old', 'old.account.with.a.very.long.address@example-brokerage.com', { enabled: false }),
  ];
}

/** Unsigned JWT-shaped token: the SPA only decodes it for display (the API verifies real ones). */
export function fakeAccessToken(groups: string[]): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'sub-me', username: 'u-me', token_use: 'access', ...(groups.length ? { 'cognito:groups': groups } : {}) })}.sig`;
}

/** Mutable in-memory admin API. Returns the users array so tests can assert against it. */
function adminRoute(o: MockOptions, users: MockAdminUser[], calls: string[]) {
  return async (method: string, p: string, url: URL, body: Record<string, unknown>) => {
    if (!o.admin) return { status: 403, json: { error: 'Only admins can manage people.' } };
    calls.push(`${method} ${p}${url.search}`);
    if (p === '/admin/users' && method === 'GET') {
      if (o.adminDown) return { status: 500, json: { error: 'Something went wrong on our side. Please try again.' } };
      return { status: 200, json: users };
    }
    if (p === '/admin/users' && method === 'POST') {
      const email = String(body.email ?? '');
      if (users.some((x) => x.email === email)) return { status: 409, json: { error: 'That email already has an account.' } };
      const now = new Date().toISOString();
      const user: MockAdminUser = { username: `u-${users.length + 1}`, email, status: 'FORCE_CHANGE_PASSWORD', enabled: true, createdAt: now, lastModified: now, isAdmin: body.admin === true, isSelf: false };
      users.push(user);
      return { status: 201, json: { user, temporaryPassword: TEMP_PASSWORD } };
    }
    const m = p.match(/^\/admin\/users\/([^/]+)(?:\/([a-z-]+))?$/);
    const user = m ? users.find((x) => x.username === decodeURIComponent(m[1]!)) : undefined;
    if (!m || !user) return { status: 404, json: { error: 'That user no longer exists.' } };
    const action = m[2];
    if (method === 'DELETE' && !action) {
      users.splice(users.indexOf(user), 1);
      const purge = url.searchParams.get('purge') === 'true';
      return { status: 200, json: { deleted: true, purged: purge ? { items: 42, photos: 3 } : { items: 0, photos: 0 } } };
    }
    if (action === 'disable') user.enabled = false;
    else if (action === 'enable') user.enabled = true;
    else if (action === 'admin') user.isAdmin = body.admin === true;
    else if (action === 'reset-password') {
      user.status = 'FORCE_CHANGE_PASSWORD';
      return { status: 200, json: { user, temporaryPassword: TEMP_PASSWORD } };
    } else if (action === 'resend') {
      if (user.status !== 'FORCE_CHANGE_PASSWORD') return { status: 409, json: { error: 'They’ve already set a password.' } };
      return { status: 200, json: { user, temporaryPassword: TEMP_PASSWORD } };
    } else return { status: 404, json: { error: 'Not found' } };
    return { status: 200, json: { user } };
  };
}

export function buildBootstrap(o: MockOptions = {}) {
  const today = new Date();
  const now = today.toISOString();
  const yesterday = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
  return {
    settings: {
      defaultAccountId: 'a1',
      feesPerContract: { default: 0, MNQ: 1.24, MES: 1.24, NQ: 4.28, ES: 4.28 },
      breakevenBand: 0,
      setups: SETUPS,
      mistakes: MISTAKES,
      recentSymbols: o.empty ? [] : ['MNQ', 'MES', 'NQ'],
    },
    accounts: o.empty
      ? []
      : [
          { id: 'a1', name: 'Apex 50K #2', type: 'prop-eval', startBalance: 50000, profitTarget: 3000, maxDrawdown: 2500, drawdownType: 'trailing', dailyLossLimit: 1000, status: 'active', createdAt: now },
          { id: 'a2', name: 'Personal', type: 'personal', startBalance: 10000, status: 'active', createdAt: now },
        ],
    trades: o.empty ? [] : buildTrades(today),
    days: o.empty
      ? []
      : [{ date: yesterday, review: { text: 'Chased the open. Good afternoon.', followedPlan: false, mood: 3 }, updatedAt: now }],
  };
}

// ── Market fixtures ─────────────────────────────────────────────────────

const EVENTS_TODAY = [
  { time: '08:30', title: 'CPI m/m', impact: 'high', forecast: '0.3%', previous: '0.4%' },
  { time: '08:30', title: 'Core CPI m/m', impact: 'high', forecast: '0.3%', previous: '0.3%' },
  { time: '10:00', title: 'ISM Services PMI', impact: 'medium', forecast: '51.7', previous: '52.0' },
  { time: '10:30', title: 'Crude Oil Inventories', impact: 'medium' },
  { time: '14:00', title: 'FOMC Meeting Minutes', impact: 'high' },
];

export function marketDay(date: string) {
  const d = new Date(`${date}T12:00:00`);
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  const r = rng(hash(date));
  const es = (r() - 0.45) * 1.6;
  const nq = es * 1.3 + (r() - 0.5) * 0.4;
  return {
    date,
    indices: weekend ? { ES: null, NQ: null } : { ES: { close: 6738.25 + r() * 40, changePct: es }, NQ: { close: 24912.5 + r() * 90, changePct: nq } },
    vix: weekend ? null : { close: 15 + r() * 6, change: (r() - 0.5) * 2 },
    events: weekend ? [] : date === todayStr() ? EVENTS_TODAY : r() < 0.5 ? EVENTS_TODAY.slice(2, 4) : [EVENTS_TODAY[0]],
    sources: { indices: 'yahoo', vix: 'yahoo', events: 'forexfactory' },
  };
}

/** Epoch seconds of an America/New_York wall-clock time (DST-correct). */
function etEpoch(date: string, hh: number, mm: number): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  let guess = Date.UTC(y, m - 1, d, hh + 5, mm); // EST first
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const [gh, gm] = fmt.format(new Date(guess)).split(':').map(Number) as [number, number];
  guess -= ((gh * 60 + gm) - (hh * 60 + mm)) * 60_000;
  return Math.floor(guess / 1000);
}

/** 1m candles for the whole ET day (like the real prepost feed) that pass through each of that day's trades' entry and exit. */
export function marketBars(trades: MockTrade[], symbol: string, date: string) {
  const root = symbol.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '');
  const mine = trades
    .filter((t) => t.date === date && t.symbol.startsWith(root) && t.time)
    .sort((a, b) => a.time!.localeCompare(b.time!));
  const r = rng(hash(symbol + date));
  const anchors = new Map<number, number>();
  for (const t of mine) {
    const [eh, em] = t.time!.split(':').map(Number) as [number, number];
    anchors.set(eh * 60 + em, t.entry);
    if (t.exitTime) {
      const [xh, xm] = t.exitTime.split(':').map(Number) as [number, number];
      anchors.set(xh * 60 + xm, t.exit);
    }
  }
  const keys = [...anchors.keys()].sort((a, b) => a - b);
  const startPrice = mine[0]?.entry ?? (root.includes('NQ') ? 21100 : 5810);
  const tick = 0.25;
  const vol = root.includes('NQ') ? 3.2 : 0.9;
  const bars: { t: number; o: number; h: number; l: number; c: number; v: number }[] = [];
  let p = startPrice + (r() - 0.5) * vol * 20;
  for (let m = 0; m < 24 * 60; m++) {
    // Pull toward the next anchor so the trade's fills sit inside the candles.
    const next = keys.find((k) => k >= m);
    const target = next !== undefined ? anchors.get(next)! : p;
    const steps = next !== undefined ? Math.max(1, next - m) : 1;
    const o = p;
    let c = o + (target - o) / steps + (r() - 0.5) * vol * (next === m ? 0 : 1.6);
    if (next === m) c = target;
    c = Math.round(c / tick) * tick;
    const h = Math.max(o, c) + Math.round((r() * vol) / tick) * tick;
    const l = Math.min(o, c) - Math.round((r() * vol) / tick) * tick;
    bars.push({ t: etEpoch(date, Math.floor(m / 60), m % 60), o, h, l, c, v: Math.round(200 + r() * 1800) });
    p = c;
  }
  return { symbol: `${root}=F`, interval: '1m', bars, tz: 'America/New_York' };
}

const COACH =
  'You were green on 6 of 9 days. Losses cluster before 10:00 — FOMO entries cost $310 across 4 trades.\n\n' +
  'Pullbacks are your best setup (68% win, +$540). Thursdays have been red three weeks running.\n\n' +
  'Next week: no entries in the first 15 minutes, and size down on Thursdays.';

/** Install every route the SPA needs. Returns the bootstrap so tests can assert against it. */
export async function mockBackend(page: Page, o: MockOptions = {}) {
  const boot = buildBootstrap(o);
  await page.route('**/config.json', (r) => r.fulfill({ json: { region: 'us-east-1', userPoolId: 'us-east-1_mock', clientId: 'mock', apiBase: '/api' } }));
  const adminUsers = buildAdminUsers();
  const adminCalls: string[] = [];
  const cognitoCalls: string[] = [];
  const admin = adminRoute(o, adminUsers, adminCalls);
  const accessToken = o.admin ? fakeAccessToken(['admin']) : 'mock-access';
  await page.route('https://cognito-idp.us-east-1.amazonaws.com/', (r) => {
    const op = (r.request().headers()['x-amz-target'] ?? '').split('.').pop() ?? '';
    cognitoCalls.push(op);
    if (op === 'ChangePassword' || op === 'GlobalSignOut' || op === 'RevokeToken') return r.fulfill({ json: {} });
    return r.fulfill({ json: { AuthenticationResult: { AccessToken: accessToken, ExpiresIn: 3600 } } });
  });
  await page.route('**/api/**', async (r) => {
    const req = r.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^\/api/, '');
    if (p === '/bootstrap') return r.fulfill({ json: boot });
    if (p.startsWith('/market/')) {
      if (o.marketDown) return r.fulfill({ status: 502, json: { error: 'Upstream unavailable' } });
      if (p.startsWith('/market/day/')) return r.fulfill({ json: marketDay(decodeURIComponent(p.slice('/market/day/'.length))) });
      if (p === '/market/bars') {
        const symbol = url.searchParams.get('symbol') ?? '';
        const date = url.searchParams.get('date') ?? '';
        return r.fulfill({ json: marketBars(boot.trades, symbol, date) });
      }
    }
    if (p === '/ai/coach') {
      await new Promise((res) => setTimeout(res, 250));
      return o.coachDown ? r.fulfill({ status: 500, json: { error: 'The coach is unavailable right now.' } }) : r.fulfill({ json: { text: COACH } });
    }
    if (p === '/photos/view-urls') return r.fulfill({ json: { urls: {} } });
    let body: Record<string, unknown> = {};
    try {
      body = (req.postDataJSON() as Record<string, unknown>) ?? {};
    } catch {
      body = {};
    }
    if (p.startsWith('/admin/')) {
      await new Promise((res) => setTimeout(res, 120));
      const out = await admin(req.method(), p, url, body);
      return r.fulfill({ status: out.status, json: out.json });
    }
    if (req.method() === 'DELETE') return r.fulfill({ json: { deleted: true } });
    if (Array.isArray(body.trades)) return r.fulfill({ json: { written: body.trades.length } });
    return r.fulfill({ json: (body.merged as object) ?? body });
  });
  return Object.assign(boot, { adminUsers, adminCalls, cognitoCalls });
}

/** Signed-in state without a real Cognito: a stored refresh token + the mocked InitiateAuth above. */
export async function signIn(page: Page, theme: 'dark' | 'light' = 'dark') {
  await page.addInitScript((t) => {
    localStorage.setItem('tj.auth', JSON.stringify({ refreshToken: 'mock-refresh', email: 'trader@example.com' }));
    localStorage.setItem('tj.theme', t);
  }, theme);
}
