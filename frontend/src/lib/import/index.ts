// CSV import entry point: detect the broker from the header row, parse, then apply ids/multipliers/fees.
import type { Account, Settings, Trade, TradeSource } from '../types';
import { parseCsv } from '../csv';
import { fingerprint } from '../ids';
import { defaultFees, resolveMultiplier, rootSymbol } from '../pnl';
import { isGeneric, parseGeneric } from './generic';
import { isNinjaTrader, parseNinjaTrader } from './ninjatrader';
import { isRobinhood, parseRobinhood } from './robinhood';
import { isTradovateFills, isTradovatePerformance, parseTradovate } from './tradovate';
import { Cols, type ParseResult } from './util';
import { isWebull, parseWebull } from './webull';

export { matchFifo, type Fill, type FifoTrade } from './fifo';

export interface ImportContext {
  settings: Settings;
  accountId: string | null;
  nowIso: string;
  /** Optional: lets our own export's "account" (name) column map back to an account id. */
  accounts?: Account[];
}

export interface ImportResult {
  source: TradeSource;
  trades: Trade[];
  warnings: string[];
  skipped: number;
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

export function detectBroker(headers: string[]): TradeSource | null {
  const c = new Cols(headers);
  if (isGeneric(c)) return 'generic';
  if (isTradovatePerformance(c) || isTradovateFills(c)) return 'tradovate';
  if (isNinjaTrader(c)) return 'ninjatrader';
  if (isRobinhood(c)) return 'robinhood';
  if (isWebull(c)) return 'webull';
  return null;
}

const PARSERS: Record<Exclude<TradeSource, 'manual'>, (h: string[], rows: string[][]) => ParseResult> = {
  generic: parseGeneric,
  tradovate: parseTradovate,
  ninjatrader: parseNinjaTrader,
  robinhood: parseRobinhood,
  webull: parseWebull,
};

function sniffDelimiter(text: string): string {
  const firstLine = text.replace(/^﻿/, '').split(/\r?\n/).find((l) => l.trim()) ?? '';
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const counts: [string, number][] = [[',', count(',')], ['\t', count('\t')], [';', count(';')]];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 0 ? counts[0]![0] : ',';
}

/**
 * Parse a broker CSV into trades ready to POST to /api/trades/batch.
 * Throws ImportError when the format isn't recognized. Ids are deterministic, so re-importing a file is idempotent.
 */
export function importCsv(text: string, ctx: ImportContext): ImportResult {
  const rows = parseCsv(text, sniffDelimiter(text));
  let headerIdx = -1;
  let source: TradeSource | null = null;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    source = detectBroker(rows[i]!);
    if (source) {
      headerIdx = i;
      break;
    }
  }
  if (!source || source === 'manual' || headerIdx < 0) {
    throw new ImportError(
      'Unrecognized CSV. Supported: Tradovate (Performance or Orders), NinjaTrader (Trades grid), Webull orders, Robinhood activity, or this app’s own export.',
    );
  }
  const header = rows[headerIdx]!;
  const body = rows.slice(headerIdx + 1).filter((r) => r.some((f) => f.trim() !== ''));
  const parsed = PARSERS[source](header, body);

  const warnings = [...parsed.warnings];
  const unknownRoots = new Set<string>();
  const seen = new Map<string, number>();
  const accountByName = new Map((ctx.accounts ?? []).map((a) => [a.name.trim().toLowerCase(), a.id]));

  const trades: Trade[] = parsed.trades.map((r) => {
    let multiplier = r.multiplier;
    if (multiplier === undefined) {
      const res = resolveMultiplier(r.assetType, r.symbol);
      multiplier = res.multiplier;
      if (res.unknown) unknownRoots.add(rootSymbol(r.symbol));
    }
    const fees = r.fees ?? defaultFees(ctx.settings, r.assetType, r.symbol, r.qty);

    let id = r.id;
    if (!id) {
      const parts: (string | number)[] = [source!, r.symbol, r.date, r.time ?? '', r.side, r.qty, r.entry, r.exit];
      const base = fingerprint(parts);
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      // identical round trips in one file (same minute, same prices) stay distinct but deterministic
      id = n === 0 ? base : fingerprint([...parts, n]);
    }

    const accountId = (r.accountName && accountByName.get(r.accountName.trim().toLowerCase())) || ctx.accountId;
    const t: Trade = {
      id,
      accountId,
      date: r.date,
      symbol: r.symbol,
      assetType: r.assetType,
      side: r.side,
      qty: r.qty,
      entry: r.entry,
      exit: r.exit,
      fees,
      multiplier,
      source: source as TradeSource,
      createdAt: ctx.nowIso,
      updatedAt: ctx.nowIso,
    };
    if (r.time) t.time = r.time;
    if (r.exitTime) t.exitTime = r.exitTime;
    if (r.option) t.option = r.option;
    if (r.setup) t.setup = r.setup;
    if (r.mistakes?.length) t.mistakes = r.mistakes;
    if (r.mood) t.mood = r.mood;
    if (r.notes) t.notes = r.notes;
    if (r.stop !== undefined) t.stop = r.stop;
    return t;
  });

  for (const root of unknownRoots) {
    warnings.push(`${root}: unknown contract — point value set to 1. Edit the multiplier on these trades.`);
  }
  return { source, trades, warnings, skipped: parsed.skipped };
}
