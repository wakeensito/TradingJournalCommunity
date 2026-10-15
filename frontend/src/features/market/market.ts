// Market context: response types, defensive parsers, formatting and pure chart maths.
// Everything here is framework-free so it is unit-tested in __tests__/market.test.ts.
// Contract: docs/market-context.md (GET /api/market/day/{date}, GET /api/market/bars).

import type { AssetType, Side, Trade } from '@/lib/types';

/** Fetches a path relative to the API base ('/market/…'), like lib/api.ts `send`. Throws on non-2xx. */
export type ApiGet = (path: string) => Promise<unknown>;

export type Impact = 'high' | 'medium' | 'low';

export interface MarketEvent {
  time: string; // 'HH:MM' America/New_York
  title: string;
  impact: Impact;
  actual?: string;
  forecast?: string;
  previous?: string;
}

export interface IndexQuote {
  close: number;
  changePct: number | null;
}

export interface VixQuote {
  close: number;
  change: number | null;
}

export interface MarketDay {
  date: string;
  indices: { ES: IndexQuote | null; NQ: IndexQuote | null };
  vix: VixQuote | null;
  events: MarketEvent[];
  sources: Record<string, string>;
}

export interface Bar {
  t: number; // epoch seconds
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface MarketBars {
  symbol: string;
  interval: '1m' | '5m';
  bars: Bar[];
  tz: 'America/New_York';
  /** Yahoo hasn't published bars for (all of) the trade window yet — ask again in `retryAfterSec`. */
  pending?: boolean;
  retryAfterSec?: number;
  /** 'market-closed': a settled day with no bars at all (weekend or holiday). */
  reason?: 'market-closed';
}

export interface BarsRequest {
  symbol: string;
  date: string;
  assetType: AssetType;
  underlying?: string;
  /** The trade window as ET 'HH:MM' on `date`, so the server can say when bars don't reach it yet. */
  from?: string;
  to?: string;
}

export const MAX_INTRADAY_DAYS = 60;
export const ET = 'America/New_York';
const MINUS = '−';

// ── Parsers (the network is untrusted; never let a bad payload crash a sheet) ──
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const str = (x: unknown): string | undefined => (typeof x === 'string' && x.trim() ? x : undefined);

function parseIndex(x: unknown): IndexQuote | null {
  if (!isObj(x)) return null;
  const close = num(x.close);
  return close === null ? null : { close, changePct: num(x.changePct) };
}

export function parseMarketDay(x: unknown): MarketDay | null {
  if (!isObj(x) || typeof x.date !== 'string') return null;
  const idx = isObj(x.indices) ? x.indices : {};
  const vixRaw = isObj(x.vix) ? x.vix : null;
  const vixClose = vixRaw ? num(vixRaw.close) : null;
  const events: MarketEvent[] = [];
  for (const e of Array.isArray(x.events) ? x.events : []) {
    if (!isObj(e)) continue;
    const time = str(e.time);
    const title = str(e.title);
    const impact = e.impact === 'high' || e.impact === 'medium' || e.impact === 'low' ? e.impact : null;
    if (!time || !/^\d{2}:\d{2}$/.test(time) || !title || !impact) continue;
    const ev: MarketEvent = { time, title, impact };
    const actual = str(e.actual);
    const forecast = str(e.forecast);
    const previous = str(e.previous);
    if (actual) ev.actual = actual;
    if (forecast) ev.forecast = forecast;
    if (previous) ev.previous = previous;
    events.push(ev);
  }
  const sources: Record<string, string> = {};
  if (isObj(x.sources)) for (const [k, v] of Object.entries(x.sources)) if (typeof v === 'string') sources[k] = v;
  return {
    date: x.date,
    indices: { ES: parseIndex(idx.ES), NQ: parseIndex(idx.NQ) },
    vix: vixClose === null ? null : { close: vixClose, change: num(vixRaw?.change) },
    events,
    sources,
  };
}

export function parseMarketBars(x: unknown): MarketBars | null {
  if (!isObj(x) || typeof x.symbol !== 'string' || !Array.isArray(x.bars)) return null;
  const interval = x.interval === '1m' || x.interval === '5m' ? x.interval : null;
  if (!interval) return null;
  const bars: Bar[] = [];
  for (const b of x.bars) {
    if (!isObj(b)) continue;
    const t = num(b.t);
    const o = num(b.o);
    const h = num(b.h);
    const l = num(b.l);
    const c = num(b.c);
    if (t === null || o === null || h === null || l === null || c === null) continue;
    bars.push({ t, o, h: Math.max(h, o, c), l: Math.min(l, o, c), c, v: num(b.v) ?? 0 });
  }
  bars.sort((a, b) => a.t - b.t);
  const out: MarketBars = { symbol: x.symbol, interval, bars, tz: ET };
  if (x.pending === true) {
    out.pending = true;
    const retry = num(x.retryAfterSec);
    out.retryAfterSec = retry === null ? 120 : Math.min(600, Math.max(1, retry));
  }
  if (x.reason === 'market-closed') out.reason = 'market-closed';
  return out;
}

// ── Paths ──────────────────────────────────────────────────────────────
export const marketDayPath = (date: string) => `/market/day/${encodeURIComponent(date)}`;

export function marketBarsPath(r: BarsRequest): string {
  const q = new URLSearchParams({ symbol: r.symbol, date: r.date, assetType: r.assetType });
  if (r.underlying) q.set('underlying', r.underlying);
  if (r.from) q.set('from', r.from);
  if (r.to) q.set('to', r.to);
  return `/market/bars?${q.toString()}`;
}

export function barsRequestForTrade(
  t: Pick<Trade, 'symbol' | 'date' | 'assetType' | 'option'> & Partial<Pick<Trade, 'time' | 'exitTime'>>,
): BarsRequest {
  const req: BarsRequest = {
    symbol: t.symbol,
    date: t.date,
    assetType: t.assetType,
    ...(t.assetType === 'option' && t.option?.underlying ? { underlying: t.option.underlying } : {}),
  };
  // Only send the window when it lands on the requested ET day (a trader outside ET, or an exit past midnight,
  // can fall on another day; then the server just returns the day as-is).
  const { entryT, exitT } = tradeMarks({ date: t.date, time: t.time, exitTime: t.exitTime });
  const onDay = (s: number | null): s is number => s !== null && etDate(s) === t.date;
  if (onDay(entryT)) req.from = etTime(entryT);
  if (onDay(exitT)) req.to = etTime(exitT);
  else if (req.from) req.to = req.from;
  return req;
}

// ── Dates ──────────────────────────────────────────────────────────────
function ymdParts(date: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Whole local days between `date` and `today` (both 'YYYY-MM-DD'); positive = in the past. */
export function daysAgo(date: string, today: string): number | null {
  const a = ymdParts(date);
  const b = ymdParts(today);
  if (!a || !b) return null;
  return Math.round((Date.UTC(...b) - Date.UTC(...a)) / 86_400_000);
}

/** Epoch seconds of a local 'YYYY-MM-DD' + 'HH:MM' (the trader's clock, which is how trades are stored). */
export function localEpoch(date: string, time: string): number | null {
  const d = ymdParts(date);
  const t = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!d || !t) return null;
  return new Date(d[0], d[1] - 1, d[2], Number(t[1]), Number(t[2])).getTime() / 1000;
}

const etClock = new Intl.DateTimeFormat('en-US', { timeZone: ET, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Epoch seconds → 'HH:MM' on the New York clock. */
export function etTime(epochSec: number): string {
  return etClock.format(new Date(epochSec * 1000));
}

const etDay = new Intl.DateTimeFormat('en-CA', { timeZone: ET, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Epoch seconds → 'YYYY-MM-DD' on the New York calendar. */
export function etDate(epochSec: number): string {
  return etDay.format(new Date(epochSec * 1000));
}

/** '08:30' → '8:30' (plan text and pills read better without the leading zero). */
export const shortTime = (hhmm: string) => hhmm.replace(/^0(\d)/, '$1');

// ── Formatting ─────────────────────────────────────────────────────────
export function formatChangePct(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return '—';
  const abs = Math.abs(p).toFixed(2);
  if (Number(abs) === 0) return '0.00%';
  return `${p < 0 ? MINUS : '+'}${abs}%`;
}

export function trendClass(p: number | null): string {
  if (p === null || !Number.isFinite(p) || Math.abs(p) < 0.005) return 'text-flat';
  return p > 0 ? 'text-gain' : 'text-loss';
}

const IMPACT_SHORT: Record<Impact, string> = { high: 'high', medium: 'med', low: 'low' };

/**
 * One line for the pre-market plan: "8:30 CPI m/m (high) · 10:00 ISM Services PMI (med)".
 * Same-time duplicates collapse (CPI m/m + Core CPI m/m stay separate, identical rows don't). '' when none.
 */
export function eventsForPlan(events: MarketEvent[], max = 6): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const e of [...events].sort((a, b) => a.time.localeCompare(b.time))) {
    const key = `${e.time}|${e.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(`${shortTime(e.time)} ${e.title} (${IMPACT_SHORT[e.impact]})`);
  }
  if (parts.length > max) return `${parts.slice(0, max).join(' · ')} · +${parts.length - max} more`;
  return parts.join(' · ');
}

// ── Chart maths ────────────────────────────────────────────────────────
export interface TradeMarks {
  entryT: number | null;
  exitT: number | null;
}

/** Entry/exit instants for a trade; an exit clock earlier than entry means it crossed midnight. */
export function tradeMarks(t: Pick<Trade, 'date' | 'time' | 'exitTime'>): TradeMarks {
  const entryT = t.time ? localEpoch(t.date, t.time) : null;
  let exitT = t.exitTime ? localEpoch(t.date, t.exitTime) : null;
  if (entryT !== null && exitT !== null && exitT < entryT) exitT += 86_400;
  return { entryT, exitT };
}

/** Index of the bar containing epoch `t` (last bar starting at or before it), or null outside the bars. */
export function barIndexAt(bars: Bar[], t: number, intervalSec: number): number | null {
  if (!bars.length) return null;
  const first = bars[0]!;
  const last = bars[bars.length - 1]!;
  if (t < first.t || t >= last.t + intervalSec) return null;
  let lo = 0;
  let hi = bars.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (bars[mid]!.t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * The visible slice: the trade window ± padding (max(15 min, half the hold, 20 bars)), clamped to the day.
 * No entry time → the regular session (9:30–16:00 ET) if it has bars, else the whole day.
 */
export function visibleRange(bars: Bar[], marks: TradeMarks, intervalSec: number): [number, number] {
  if (!bars.length) return [0, 0];
  const n = bars.length;
  const { entryT, exitT } = marks;
  if (entryT === null) {
    const rth = bars.flatMap((b, i) => {
      const hm = etTime(b.t);
      return hm >= '09:30' && hm < '16:00' ? [i] : [];
    });
    return rth.length ? [rth[0]!, rth[rth.length - 1]! + 1] : [0, n];
  }
  const a = entryT;
  const b = exitT ?? entryT;
  const pad = Math.max(15 * 60, (b - a) / 2, 20 * intervalSec);
  const from = a - pad;
  const to = b + pad;
  let i0 = bars.findIndex((x) => x.t >= from);
  let i1 = bars.findIndex((x) => x.t > to);
  if (i0 < 0) i0 = Math.max(0, n - 40); // the window is after the last bar: show the tail
  if (i1 < 0) i1 = n;
  if (i1 - i0 < 10) {
    i0 = Math.max(0, Math.min(i0, n - 10));
    i1 = Math.min(n, i0 + Math.max(10, i1 - i0));
  }
  return [i0, i1];
}

/** ~`count` round price ticks covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (hi <= lo) return [lo];
  const raw = (hi - lo) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag);
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

/** Time-axis tick step (seconds) that leaves ≥ `minPx` between labels. */
export function timeTickStep(spanSec: number, widthPx: number, minPx = 64): number {
  const steps = [5, 10, 15, 30, 60, 120, 180, 240].map((m) => m * 60);
  const maxTicks = Math.max(2, Math.floor(widthPx / minPx));
  return steps.find((s) => spanSec / s <= maxTicks) ?? steps[steps.length - 1]!;
}

export type { Side };
