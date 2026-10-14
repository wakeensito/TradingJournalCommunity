// P&L truth. Every money number the app shows comes from here. See the spec section "P&L truth".
import type { AssetType, Settings, Trade } from './types';

/** Futures point value ($ per 1.0 price move per contract), keyed by exact root symbol. */
export const FUTURES_MULTIPLIERS: Readonly<Record<string, number>> = {
  ES: 50,
  MES: 5,
  NQ: 20,
  MNQ: 2,
  YM: 5,
  MYM: 0.5,
  RTY: 50,
  M2K: 5,
  CL: 1000,
  MCL: 100,
  GC: 100,
  MGC: 10,
  SI: 5000,
  NG: 10000,
  '6E': 125000,
  ZB: 1000,
  ZN: 1000,
};

const MONTH_CODES = 'FGHJKMNQUVXZ';
// root (1-4 chars) + month letter + 1-2 digit year, anchored: 'MNQZ5', 'MNQZ25', '6EZ5', 'M2KH26'
const CONTRACT_RE = new RegExp(`^([A-Z0-9]{1,4})[${MONTH_CODES}](\\d{1,2})$`);
// trailing expiry forms after a space: '12-25', '12/25', 'DEC25', 'DEC 25', 'MAR26'
const SPACED_EXPIRY_RE = /^(\d{1,2}[-/]\d{2,4}|[A-Z]{3}\s?\d{2,4})$/;

/** Round to cents without float drift (sign-symmetric, never returns -0). */
export function round2(x: number): number {
  if (!Number.isFinite(x)) return 0;
  const r = (Math.sign(x) * Math.round(Math.abs(x) * 100 + 1e-7)) / 100;
  return r === 0 ? 0 : r;
}

/**
 * Futures root symbol: strips leading '/' or '@', exchange suffixes ('.CME', ':XCME'), and the month+year code.
 * 'MNQZ5'→'MNQ', 'MNQ 12-25'→'MNQ', '/MESZ5'→'MES', '6EZ5'→'6E'. Anything else is returned uppercased and trimmed.
 */
export function rootSymbol(symbol: string): string {
  const raw = symbol.trim().toUpperCase();
  let s = raw.replace(/^[/@]+/, '');
  s = s.replace(/[.:][A-Z]{2,6}$/, ''); // exchange suffix
  const parts = s.split(/\s+/);
  const first = parts[0] ?? '';
  if (parts.length > 1) {
    const rest = parts.slice(1).join(' ');
    if (!SPACED_EXPIRY_RE.test(rest)) return raw; // e.g. 'SPY 500C 12/19' is not a futures contract
    s = first;
  }
  if (FUTURES_MULTIPLIERS[s] !== undefined) return s;
  const m = CONTRACT_RE.exec(s);
  if (m && m[1]) return m[1];
  return s || raw;
}

export function resolveMultiplier(assetType: AssetType, symbol: string): { multiplier: number; unknown: boolean } {
  if (assetType === 'option') return { multiplier: 100, unknown: false };
  if (assetType === 'stock') return { multiplier: 1, unknown: false };
  const m = FUTURES_MULTIPLIERS[rootSymbol(symbol)];
  return m === undefined ? { multiplier: 1, unknown: true } : { multiplier: m, unknown: false };
}

/** Round-trip fees for `qty` contracts/shares from settings. */
export function defaultFees(settings: Settings, assetType: AssetType, symbol: string, qty: number): number {
  const table = settings.feesPerContract ?? {};
  const q = Number.isFinite(qty) && qty > 0 ? qty : 0;
  let per: number;
  if (assetType === 'futures') per = table[rootSymbol(symbol)] ?? table.default ?? 0;
  else per = table[assetType] ?? 0;
  return round2((Number.isFinite(per) ? per : 0) * q);
}

type PnlInput = Pick<Trade, 'entry' | 'exit' | 'qty' | 'multiplier' | 'side'>;

function rawGross(t: PnlInput): number {
  const dir = t.side === 'short' ? -1 : 1;
  return (t.exit - t.entry) * t.qty * t.multiplier * dir;
}

export function grossPnl(t: PnlInput): number {
  return round2(rawGross(t));
}

export function netPnl(t: PnlInput & Pick<Trade, 'fees'>): number {
  return round2(rawGross(t) - (t.fees || 0));
}

/** |net| <= band is a breakeven ('flat'). */
export function outcome(t: PnlInput & Pick<Trade, 'fees'>, band: number): 'win' | 'loss' | 'flat' {
  const n = netPnl(t);
  const b = Math.abs(band || 0);
  if (n > b) return 'win';
  if (n < -b) return 'loss';
  return 'flat';
}

/** Net P&L in units of planned risk. Risk = |entry − stop| × qty × multiplier (fees not included). */
export function rMultiple(t: Trade): number | null {
  if (t.stop === undefined || t.stop === null || !Number.isFinite(t.stop)) return null;
  const risk = Math.abs(t.entry - t.stop) * t.qty * t.multiplier;
  if (!(risk > 1e-9)) return null;
  return round2(netPnl(t) / risk);
}
