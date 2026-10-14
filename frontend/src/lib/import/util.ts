// Shared helpers for broker parsers.
import type { AssetType, OptionLeg, Trade } from '../types';
import { parseLooseDate, parseLooseTime, parseLooseTimeSeconds } from '../dates';

/** 'Avg Fill Price' → 'avgfillprice', 'B/S' → 'bs', '_tickSize' → 'ticksize'. */
export function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Column lookup by any of several normalized aliases. */
export class Cols {
  private idx = new Map<string, number>();
  constructor(headers: string[]) {
    headers.forEach((h, i) => {
      const k = normHeader(h);
      if (k && !this.idx.has(k)) this.idx.set(k, i);
    });
  }
  has(...names: string[]): boolean {
    return names.some((n) => this.idx.has(n));
  }
  index(...names: string[]): number {
    for (const n of names) {
      const i = this.idx.get(n);
      if (i !== undefined) return i;
    }
    return -1;
  }
  get(row: string[], ...names: string[]): string {
    const i = this.index(...names);
    return i < 0 ? '' : (row[i] ?? '').trim();
  }
}

/**
 * Parse a number from broker text: '$1,234.50', '(12.50)', '$(12.50)', '-$12.50', '@1.25', '3S', '21034.25'.
 * Returns null for empty / unparseable.
 */
export function parseNum(s: string | undefined): number | null {
  if (s === undefined) return null;
  let t = s.trim();
  if (!t) return null;
  let neg = false;
  if (/^\(.*\)$/.test(t) || /^\$\(.*\)$/.test(t)) {
    neg = true;
    t = t.replace(/[()]/g, '');
  }
  t = t.replace(/[$,@\s]/g, '').replace(/[A-Za-z]+$/, '');
  if (t.startsWith('-')) {
    neg = !neg;
    t = t.slice(1);
  } else if (t.startsWith('+')) t = t.slice(1);
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

export interface Stamp {
  date: string;
  time: string; // 'HH:MM' or ''
  sortKey: string; // 'HH:MM:SS' or ''
}

/** Split a broker timestamp into local date + time. Strips trailing zone abbreviations like 'EST'. */
export function parseStamp(s: string): Stamp | null {
  const cleaned = s.trim().replace(/\s+(?:[A-Z]{2,4}T|UTC|GMT|ET|CT)$/i, '');
  const date = parseLooseDate(cleaned);
  if (!date) return null;
  return { date, time: parseLooseTime(cleaned) ?? '', sortKey: parseLooseTimeSeconds(cleaned) };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Display symbol for an option leg: 'SPY 500C 12/19'. */
export function optionSymbol(o: OptionLeg): string {
  const [, mm, dd] = o.expiry.split('-');
  return `${o.underlying} ${trimNum(o.strike)}${o.right} ${mm}/${dd}`;
}

function trimNum(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

/** OCC option symbol 'SPY251219C00500000' (spaces allowed after root) → OptionLeg. */
export function parseOcc(sym: string): OptionLeg | null {
  const m = /^([A-Z][A-Z0-9.]{0,5})\s*(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/.exec(sym.trim().toUpperCase());
  if (!m) return null;
  const y = 2000 + Number(m[2]);
  const mo = Number(m[3]);
  const d = Number(m[4]);
  const expiry = parseLooseDate(`${y}-${pad2(mo)}-${pad2(d)}`);
  if (!expiry) return null;
  return { underlying: m[1]!, right: m[5] as 'C' | 'P', strike: Number(m[6]) / 1000, expiry };
}

/** A trade as parsed from a file, before ids, account, multiplier and fee defaults are applied. */
export interface RawTrade {
  date: string;
  time?: string;
  exitTime?: string;
  symbol: string;
  assetType: AssetType;
  side: Trade['side'];
  qty: number;
  entry: number;
  exit: number;
  fees: number | null; // null = not in the file → settings default
  multiplier?: number; // file-provided / inferred override
  option?: OptionLeg;
  // generic (our own export) carries journal fields too
  id?: string;
  accountName?: string;
  setup?: string;
  mistakes?: string[];
  mood?: Trade['mood'];
  notes?: string;
  stop?: number;
}

export interface ParseResult {
  trades: RawTrade[];
  warnings: string[];
  skipped: number;
}

export const round6 = (x: number) => Math.round(x * 1e6) / 1e6;
