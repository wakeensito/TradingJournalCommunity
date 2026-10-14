// App-level glue on top of lib/*: labels, inference, merge, prop-account progress. No P&L math lives here.

import type { Account, AssetType, Settings, Trade } from '../lib/types';
import { FUTURES_MULTIPLIERS, netPnl, resolveMultiplier, rootSymbol, round2 } from '../lib/pnl';
import { fromDateStr } from '../lib/dates';

// ---------- labels ----------

export function dayLabel(date: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }): string {
  try {
    return fromDateStr(date).toLocaleDateString('en-US', opts);
  } catch {
    return date;
  }
}

export function longDayLabel(date: string): string {
  return dayLabel(date, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function monthLabel(year: number, month0: number): string {
  return new Date(year, month0, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function time12(t?: string): string {
  if (!t) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  return `${m[1]!.padStart(2, '0')}:${m[2]}`;
}

// ---------- inference ----------

const OPTION_RE = /\b\d+(\.\d+)?\s?[CP]\b|\b[CP]\s?\d+(\.\d+)?\b|\b(CALL|PUT)\b/i;

/** Guess the asset type for a typed symbol: previous trades → futures table → option pattern → stock. */
export function inferAssetType(symbol: string, trades: Trade[]): AssetType {
  const s = symbol.trim().toUpperCase();
  if (!s) return 'futures';
  const root = rootSymbol(s);
  for (let i = trades.length - 1; i >= 0; i--) {
    const t = trades[i]!;
    if (t.symbol.toUpperCase() === s || (t.assetType === 'futures' && rootSymbol(t.symbol) === root)) return t.assetType;
  }
  if (FUTURES_MULTIPLIERS[root] !== undefined) return 'futures';
  if (OPTION_RE.test(s) && /\s/.test(s)) return 'option';
  return 'stock';
}

export function assetLabel(a: AssetType): string {
  return a === 'futures' ? 'Futures' : a === 'option' ? 'Option' : 'Stock';
}

export function multiplierFor(assetType: AssetType, symbol: string) {
  return resolveMultiplier(assetType, symbol);
}

// ---------- combine ----------

/** Merge same-symbol, same-side trades: qty-weighted entry/exit, summed fees. Net is preserved exactly. */
export function mergeTrades(src: Trade[], id: string, nowIso: string): Trade {
  const sorted = [...src].sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
  const first = sorted[0]!;
  const qty = sorted.reduce((s, t) => s + t.qty, 0);
  const wavg = (k: 'entry' | 'exit') => sorted.reduce((s, t) => s + t[k] * t.qty, 0) / qty;
  const uniq = <T,>(xs: (T | undefined)[]) => [...new Set(xs.filter((x): x is T => x !== undefined && x !== ''))];
  const mistakes = uniq(sorted.flatMap((t) => t.mistakes ?? []));
  const notes = uniq(sorted.map((t) => t.notes?.trim())).join('\n\n');
  const photos = uniq(sorted.flatMap((t) => t.photoKeys ?? [])).slice(0, 6);
  const exitTimes = uniq(sorted.map((t) => t.exitTime)).sort();
  const merged: Trade = {
    ...first,
    id,
    qty: round6(qty),
    entry: round6(wavg('entry')),
    exit: round6(wavg('exit')),
    fees: round2(sorted.reduce((s, t) => s + (t.fees || 0), 0)),
    setup: first.setup ?? sorted.find((t) => t.setup)?.setup,
    mistakes: mistakes.length ? mistakes : undefined,
    notes: notes || undefined,
    photoKeys: photos.length ? photos : undefined,
    exitTime: exitTimes[exitTimes.length - 1],
    createdAt: first.createdAt,
    updatedAt: nowIso,
  };
  if (merged.mistakes === undefined) delete merged.mistakes;
  if (merged.notes === undefined) delete merged.notes;
  if (merged.photoKeys === undefined) delete merged.photoKeys;
  if (merged.exitTime === undefined) delete merged.exitTime;
  if (merged.setup === undefined) delete merged.setup;
  return merged;
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

export function canCombine(ts: Trade[]): string | null {
  if (ts.length < 2) return 'Pick at least two trades.';
  const a = ts[0]!;
  if (ts.some((t) => t.side !== a.side)) return 'Only trades on the same side can be combined.';
  if (ts.some((t) => t.assetType !== a.assetType || rootSymbol(t.symbol) !== rootSymbol(a.symbol))) {
    return 'Only trades in the same symbol can be combined.';
  }
  if (ts.some((t) => t.multiplier !== a.multiplier)) return 'These trades use different multipliers.';
  return null;
}

// ---------- accounts ----------

export interface AccountProgress {
  net: number;
  balance: number;
  peak: number;
  daysTraded: number;
  todayNet: number;
  target: { value: number; pct: number } | null;
  drawdown: { used: number; limit: number; pct: number; floor: number } | null;
  dailyLoss: { used: number; limit: number; pct: number } | null;
  suggestion: 'passed' | 'failed' | null;
}

export function accountProgress(a: Account, trades: Trade[], today: string): AccountProgress {
  const mine = trades
    .filter((t) => t.accountId === a.id)
    .sort((x, y) => (x.date + (x.time ?? '')).localeCompare(y.date + (y.time ?? '')));
  let bal = a.startBalance;
  let peak = a.startBalance;
  const days = new Set<string>();
  let todayNet = 0;
  for (const t of mine) {
    const n = netPnl(t);
    bal += n;
    peak = Math.max(peak, bal);
    days.add(t.date);
    if (t.date === today) todayNet += n;
  }
  const net = round2(bal - a.startBalance);
  const target = a.profitTarget && a.profitTarget > 0 ? { value: a.profitTarget, pct: clamp01(net / a.profitTarget) } : null;
  let drawdown: AccountProgress['drawdown'] = null;
  if (a.maxDrawdown && a.maxDrawdown > 0) {
    const ref = a.drawdownType === 'static' ? a.startBalance : peak;
    const used = Math.max(0, ref - bal);
    drawdown = { used: round2(used), limit: a.maxDrawdown, pct: clamp01(used / a.maxDrawdown), floor: round2(ref - a.maxDrawdown) };
  }
  const dailyLoss =
    a.dailyLossLimit && a.dailyLossLimit > 0
      ? { used: round2(Math.max(0, -todayNet)), limit: a.dailyLossLimit, pct: clamp01(Math.max(0, -todayNet) / a.dailyLossLimit) }
      : null;
  let suggestion: AccountProgress['suggestion'] = null;
  if (a.status === 'active') {
    if (drawdown && drawdown.pct >= 1) suggestion = 'failed';
    else if (a.type === 'prop-eval' && target && net >= target.value) suggestion = 'passed';
  }
  return { net, balance: round2(bal), peak: round2(peak), daysTraded: days.size, todayNet: round2(todayNet), target, drawdown, dailyLoss, suggestion };
}

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

export function accountName(accounts: Account[], id: string | null): string {
  if (!id) return 'Unassigned';
  return accounts.find((a) => a.id === id)?.name ?? 'Unassigned';
}

export function accountTypeLabel(t: Account['type']): string {
  return t === 'personal' ? 'Personal' : t === 'prop-eval' ? 'Prop · eval' : 'Prop · funded';
}

// ---------- settings helpers ----------

export function pushRecentSymbol(s: Settings, symbol: string): Settings | null {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return null;
  const next = [sym, ...s.recentSymbols.filter((x) => x.toUpperCase() !== sym)].slice(0, 8);
  if (next.join('|') === s.recentSymbols.join('|')) return null;
  return { ...s, recentSymbols: next };
}

export function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
