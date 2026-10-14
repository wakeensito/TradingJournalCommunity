// Stats from trades. One implementation, used by every screen. All money is net of fees unless named gross.
import type { Trade } from './types';
import { grossPnl, netPnl, outcome, rMultiple, rootSymbol, round2 } from './pnl';
import { weekdayIndexMon, weekdayShort } from './dates';

export interface Stats {
  count: number;
  wins: number;
  losses: number;
  flats: number;
  net: number;
  gross: number;
  fees: number;
  winRate: number | null; // wins / (wins + losses), 0..1
  profitFactor: number | null; // sum(net of wins) / |sum(net of losses)|; null when there are no losses
  avgWin: number | null;
  avgLoss: number | null; // positive magnitude
  payoff: number | null; // avgWin / avgLoss
  expectancy: number | null; // net / count
  dayWinRate: number | null;
  tradingDays: number;
  maxDrawdown: number; // positive $, largest peak-to-trough of cumulative net (peak starts at 0)
  bestDay: { date: string; net: number } | null;
  worstDay: { date: string; net: number } | null;
  currentStreak: { kind: 'win' | 'loss' | 'none'; length: number };
  longestWinStreak: number;
  longestLossStreak: number;
  avgR: number | null;
}

const timeKey = (t: Trade) => t.time ?? '';

/** Chronological (oldest first) by date then time; stable for ties. */
function chrono(trades: Trade[]): Trade[] {
  return trades
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      if (a.t.date !== b.t.date) return a.t.date < b.t.date ? -1 : 1;
      const ta = timeKey(a.t);
      const tb = timeKey(b.t);
      if (ta !== tb) return ta < tb ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.t);
}

/** Newest first by date then time. */
export function sortTrades(trades: Trade[]): Trade[] {
  return chrono(trades).reverse();
}

export function computeStats(trades: Trade[], band: number): Stats {
  const ordered = chrono(trades);
  let wins = 0;
  let losses = 0;
  let flats = 0;
  let net = 0;
  let gross = 0;
  let fees = 0;
  let winSum = 0;
  let lossSum = 0;
  let cum = 0;
  let peak = 0;
  let maxDd = 0;
  let curKind: 'win' | 'loss' | 'none' = 'none';
  let curLen = 0;
  let longestWin = 0;
  let longestLoss = 0;
  let rSum = 0;
  let rCount = 0;

  for (const t of ordered) {
    const n = netPnl(t);
    net += n;
    gross += grossPnl(t);
    fees += t.fees || 0;
    const o = outcome(t, band);
    if (o === 'win') {
      wins++;
      winSum += n;
    } else if (o === 'loss') {
      losses++;
      lossSum += n;
    } else flats++;

    // Streaks: breakevens neither extend nor break a streak.
    if (o !== 'flat') {
      if (o === curKind) curLen++;
      else {
        curKind = o;
        curLen = 1;
      }
      if (o === 'win') longestWin = Math.max(longestWin, curLen);
      else longestLoss = Math.max(longestLoss, curLen);
    }

    cum = round2(cum + n);
    if (cum > peak) peak = cum;
    maxDd = Math.max(maxDd, round2(peak - cum));

    const r = rMultiple(t);
    if (r !== null) {
      rSum += r;
      rCount++;
    }
  }

  const days = dailySeries(trades);
  const b = Math.abs(band || 0);
  let winDays = 0;
  let lossDays = 0;
  let bestDay: Stats['bestDay'] = null;
  let worstDay: Stats['worstDay'] = null;
  for (const d of days) {
    if (d.net > b) winDays++;
    else if (d.net < -b) lossDays++;
    if (!bestDay || d.net > bestDay.net) bestDay = { date: d.date, net: d.net };
    if (!worstDay || d.net < worstDay.net) worstDay = { date: d.date, net: d.net };
  }

  const avgWin = wins ? round2(winSum / wins) : null;
  const avgLoss = losses ? round2(Math.abs(lossSum) / losses) : null;
  const count = ordered.length;
  return {
    count,
    wins,
    losses,
    flats,
    net: round2(net),
    gross: round2(gross),
    fees: round2(fees),
    winRate: wins + losses ? wins / (wins + losses) : null,
    profitFactor: losses && lossSum !== 0 ? round2(winSum / Math.abs(lossSum)) : null,
    avgWin,
    avgLoss,
    payoff: avgWin !== null && avgLoss ? round2(avgWin / avgLoss) : null,
    expectancy: count ? round2(net / count) : null,
    dayWinRate: winDays + lossDays ? winDays / (winDays + lossDays) : null,
    tradingDays: days.length,
    maxDrawdown: maxDd,
    bestDay,
    worstDay,
    currentStreak: { kind: curKind, length: curLen },
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
    avgR: rCount ? round2(rSum / rCount) : null,
  };
}

export interface DayPoint {
  date: string;
  net: number;
  cum: number;
  count: number;
  trades: Trade[];
}

/** One point per trading day, oldest first; `cum` is the running net; day trades are time-ascending. */
export function dailySeries(trades: Trade[]): DayPoint[] {
  const byDay = new Map<string, Trade[]>();
  for (const t of chrono(trades)) {
    const list = byDay.get(t.date);
    if (list) list.push(t);
    else byDay.set(t.date, [t]);
  }
  let cum = 0;
  const out: DayPoint[] = [];
  for (const [date, list] of byDay) {
    const net = round2(list.reduce((s, t) => s + netPnl(t), 0));
    cum = round2(cum + net);
    out.push({ date, net, cum, count: list.length, trades: list });
  }
  return out;
}

/** Map of date → trades; keys inserted newest day first; trades within a day sorted by time ascending. */
export function groupByDay(trades: Trade[]): Map<string, Trade[]> {
  const series = dailySeries(trades);
  const map = new Map<string, Trade[]>();
  for (let i = series.length - 1; i >= 0; i--) {
    const d = series[i]!;
    map.set(d.date, d.trades);
  }
  return map;
}

export type BreakdownKey = 'setup' | 'symbol' | 'weekday' | 'hour' | 'mistake';

export interface BreakdownRow {
  key: string;
  label: string;
  count: number;
  net: number;
  winRate: number | null;
}

function bucketsFor(t: Trade, key: BreakdownKey): { key: string; label: string }[] {
  switch (key) {
    case 'setup': {
      const s = t.setup?.trim();
      return [s ? { key: s, label: s } : { key: '', label: 'No setup' }];
    }
    case 'symbol': {
      let s: string;
      if (t.assetType === 'futures') s = rootSymbol(t.symbol);
      else if (t.assetType === 'option') s = (t.option?.underlying ?? t.symbol.trim().split(/\s+/)[0] ?? '').toUpperCase();
      else s = t.symbol.trim().toUpperCase();
      return [{ key: s, label: s }];
    }
    case 'weekday':
      return [{ key: String(weekdayIndexMon(t.date)), label: weekdayShort(t.date) }];
    case 'hour': {
      const m = /^(\d{1,2}):/.exec(t.time ?? '');
      if (!m) return [{ key: '', label: 'No time' }];
      const h = Number(m[1]);
      return [{ key: String(h).padStart(2, '0'), label: `${h}:00` }];
    }
    case 'mistake':
      // Each mistake on a trade gets the trade's full P&L ("cost of" that mistake). No mistakes → not counted.
      return [...new Set((t.mistakes ?? []).map((m) => m.trim()).filter(Boolean))].map((m) => ({ key: m, label: m }));
  }
}

/** Group P&L by a dimension; rows sorted by net descending. */
export function breakdown(trades: Trade[], key: BreakdownKey, band: number): BreakdownRow[] {
  const acc = new Map<string, { label: string; count: number; net: number; wins: number; losses: number }>();
  for (const t of trades) {
    const n = netPnl(t);
    const o = outcome(t, band);
    for (const b of bucketsFor(t, key)) {
      let row = acc.get(b.key);
      if (!row) {
        row = { label: b.label, count: 0, net: 0, wins: 0, losses: 0 };
        acc.set(b.key, row);
      }
      row.count++;
      row.net += n;
      if (o === 'win') row.wins++;
      else if (o === 'loss') row.losses++;
    }
  }
  return [...acc.entries()]
    .map(([k, r]) => ({
      key: k,
      label: r.label,
      count: r.count,
      net: round2(r.net),
      winRate: r.wins + r.losses ? r.wins / (r.wins + r.losses) : null,
    }))
    .sort((a, b) => b.net - a.net || b.count - a.count || a.label.localeCompare(b.label));
}
