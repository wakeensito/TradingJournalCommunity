// Fetch hooks for market context with a module-level in-memory cache (shared by every mounted strip/chart).
// The fetcher is injected so this module never imports auth: pass a GET that resolves a path relative to the
// API base and throws on non-2xx (e.g. `(p) => api.get(p)` once lib/api.ts exposes one — see docs/market-context.md).

import { useCallback, useEffect, useState } from 'react';
import {
  type ApiGet,
  type BarsRequest,
  type MarketBars,
  type MarketDay,
  MAX_INTRADAY_DAYS,
  daysAgo,
  marketBarsPath,
  marketDayPath,
  parseMarketBars,
  parseMarketDay,
} from './market';

export interface MarketState<T> {
  data: T | null;
  loading: boolean;
  /** Set when the request failed; `status` is the HTTP status when the fetcher exposes one (ApiError does). */
  error: { message: string; status: number | null } | null;
  /** Fetch again now, keeping the current data on screen while it loads. */
  reload: () => void;
}

interface Entry {
  at: number;
  ttlMs: number;
  errorTtlMs: number;
  value?: unknown;
  error?: MarketState<unknown>['error'];
  promise?: Promise<void>;
}

const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const ERROR_TTL_MS = 60_000; // don't hammer a failing source from every mounted component (day strips)
const MAX_ENTRIES = 300;

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

function fresh(e: Entry | undefined, now: number): e is Entry {
  return !!e && (e.promise !== undefined || now - e.at < (e.error ? e.errorTtlMs : e.ttlMs));
}

function errorOf(e: unknown): NonNullable<MarketState<unknown>['error']> {
  const status =
    typeof e === 'object' && e !== null && 'status' in e && typeof (e as { status: unknown }).status === 'number'
      ? (e as { status: number }).status
      : null;
  return { message: e instanceof Error ? e.message : 'Request failed', status };
}

interface LoadOpts {
  /** How long a failure is remembered (0 = retry on the next mount). */
  errorTtlMs?: number;
  /** Per-value TTL override (e.g. 0 for a `pending` bars result, so it's never served from memory). */
  ttlFor?: (value: unknown) => number;
  /** Refetch even if the entry is fresh (an in-flight request is still shared). */
  force?: boolean;
}

function load(key: string, run: () => Promise<unknown>, parse: (x: unknown) => unknown, ttlMs: number, o: LoadOpts = {}) {
  const now = Date.now();
  const prev = cache.get(key);
  if (prev?.promise || (!o.force && fresh(prev, now))) return;
  if (!prev && cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  const errorTtlMs = o.errorTtlMs ?? ERROR_TTL_MS;
  // Keep the last good value visible while reloading (a pending chart keeps its partial candles).
  const entry: Entry = { at: now, ttlMs, errorTtlMs, value: prev?.value };
  entry.promise = run()
    .then((raw) => {
      const value = parse(raw);
      if (value === null) throw new Error('Unexpected market response');
      cache.set(key, { at: Date.now(), ttlMs: o.ttlFor ? o.ttlFor(value) : ttlMs, errorTtlMs, value });
    })
    .catch((e: unknown) => {
      cache.set(key, { at: Date.now(), ttlMs, errorTtlMs, error: errorOf(e) });
    })
    .finally(() => notify(key));
  cache.set(key, entry);
}

function snapshot<T>(key: string | null): Omit<MarketState<T>, 'reload'> {
  if (!key) return { data: null, loading: false, error: null };
  const e = cache.get(key);
  if (!e) return { data: null, loading: true, error: null };
  return { data: (e.value as T) ?? null, loading: e.promise !== undefined, error: e.error ?? null };
}

function useCached<T>(
  key: string | null,
  run: () => Promise<unknown>,
  parse: (x: unknown) => T | null,
  ttlMs: number,
  opts: Omit<LoadOpts, 'force'> = {},
): MarketState<T> {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!key) return;
    const fn = () => bump((n) => n + 1);
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(fn);
    load(key, run, parse, ttlMs, opts);
    fn(); // pick up a cache entry created (or already settled) during this render
    return () => {
      set.delete(fn);
    };
    // `run`/`parse` are derived from `key`; re-running on their identity would refetch every render.
  }, [key, ttlMs]);
  const reload = useCallback(() => {
    if (key) load(key, run, parse, ttlMs, { ...opts, force: true });
    // Same reasoning as above: everything else is derived from `key`.
  }, [key, ttlMs]);
  return { ...snapshot<T>(key), reload };
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Past days never change; today/upcoming refresh every 5 minutes (the server caches 30). */
function dayTtl(date: string): number {
  const age = daysAgo(date, todayStr());
  return age !== null && age >= 1 ? Number.POSITIVE_INFINITY : 5 * 60_000;
}

export function useMarketDay(apiGet: ApiGet, date: string | null): MarketState<MarketDay> {
  const valid = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  return useCached(
    valid ? `day:${valid}` : null,
    () => apiGet(marketDayPath(valid!)),
    parseMarketDay,
    valid ? dayTtl(valid) : 0,
  );
}

/** True when Yahoo can't serve intraday bars for this day, so the chart can skip the request entirely. */
export function barsTooOld(date: string, today = todayStr()): boolean {
  const age = daysAgo(date, today);
  return age === null || age >= MAX_INTRADAY_DAYS;
}

export function useMarketBars(apiGet: ApiGet, req: BarsRequest | null): MarketState<MarketBars> {
  const ok = req && req.symbol.trim() && !barsTooOld(req.date) ? req : null;
  const path = ok ? marketBarsPath(ok) : null;
  // Today (or yesterday, whose late bars may still land just after midnight) refreshes; history is fixed.
  const age = ok ? daysAgo(ok.date, todayStr()) : null;
  const ttl = age !== null && age <= 1 ? 60_000 : Number.POSITIVE_INFINITY;
  // Failures and pending results are never served from memory: the next open (or Retry) asks again.
  return useCached(path ? `bars:${path}` : null, () => apiGet(path!), parseMarketBars, ttl, {
    errorTtlMs: 0,
    ttlFor: (v) => ((v as MarketBars).pending ? 0 : ttl),
  });
}

/** Imperative fetch for one-tap actions (e.g. "Add today's events" in the pre-market plan). Shares the cache. */
export async function fetchMarketDay(apiGet: ApiGet, date: string): Promise<MarketDay | null> {
  const key = `day:${date}`;
  load(key, () => apiGet(marketDayPath(date)), parseMarketDay, dayTtl(date));
  await cache.get(key)?.promise;
  return (cache.get(key)?.value as MarketDay | undefined) ?? null;
}

/** Tests only. */
export function _clearMarketCache() {
  cache.clear();
}
