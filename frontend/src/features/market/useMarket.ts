// Fetch hooks for market context with a module-level in-memory cache (shared by every mounted strip/chart).
// The fetcher is injected so this module never imports auth: pass a GET that resolves a path relative to the
// API base and throws on non-2xx (e.g. `(p) => api.get(p)` once lib/api.ts exposes one — see docs/market-context.md).

import { useEffect, useState } from 'react';
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
}

interface Entry {
  at: number;
  ttlMs: number;
  value?: unknown;
  error?: MarketState<unknown>['error'];
  promise?: Promise<void>;
}

const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const ERROR_TTL_MS = 60_000; // don't hammer a failing source from every mounted component
const MAX_ENTRIES = 300;

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

function fresh(e: Entry | undefined, now: number): e is Entry {
  return !!e && (e.promise !== undefined || now - e.at < (e.error ? ERROR_TTL_MS : e.ttlMs));
}

function errorOf(e: unknown): NonNullable<MarketState<unknown>['error']> {
  const status =
    typeof e === 'object' && e !== null && 'status' in e && typeof (e as { status: unknown }).status === 'number'
      ? (e as { status: number }).status
      : null;
  return { message: e instanceof Error ? e.message : 'Request failed', status };
}

function load(key: string, run: () => Promise<unknown>, parse: (x: unknown) => unknown, ttlMs: number) {
  const now = Date.now();
  if (fresh(cache.get(key), now)) return;
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  const entry: Entry = { at: now, ttlMs };
  entry.promise = run()
    .then((raw) => {
      const value = parse(raw);
      if (value === null) throw new Error('Unexpected market response');
      cache.set(key, { at: Date.now(), ttlMs, value });
    })
    .catch((e: unknown) => {
      cache.set(key, { at: Date.now(), ttlMs, error: errorOf(e) });
    })
    .finally(() => notify(key));
  cache.set(key, entry);
}

function snapshot<T>(key: string | null): MarketState<T> {
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
): MarketState<T> {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!key) return;
    const fn = () => bump((n) => n + 1);
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(fn);
    load(key, run, parse, ttlMs);
    fn(); // pick up a cache entry created (or already settled) during this render
    return () => {
      set.delete(fn);
    };
    // `run`/`parse` are derived from `key`; re-running on their identity would refetch every render.
  }, [key, ttlMs]);
  return snapshot<T>(key);
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
  const ttl = ok && daysAgo(ok.date, todayStr()) === 0 ? 2 * 60_000 : Number.POSITIVE_INFINITY;
  return useCached(path ? `bars:${path}` : null, () => apiGet(path!), parseMarketBars, ttl);
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
