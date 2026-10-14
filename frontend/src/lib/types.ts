// Canonical data shapes. The API stores these as-is (validated); the UI and lib/* compute everything else.
// Dates are 'YYYY-MM-DD' strings in the trader's local day; times are 'HH:MM' (24h, local). Never Date objects.

export type AssetType = 'futures' | 'option' | 'stock';
export type Side = 'long' | 'short';
export type TradeSource = 'manual' | 'tradovate' | 'ninjatrader' | 'webull' | 'robinhood' | 'generic';

export interface OptionLeg {
  underlying: string; // e.g. 'SPY'
  right: 'C' | 'P';
  strike: number;
  expiry: string; // 'YYYY-MM-DD'
}

export interface Trade {
  id: string;
  accountId: string | null;
  date: string; // entry date 'YYYY-MM-DD'
  time?: string; // entry time 'HH:MM'
  exitTime?: string;
  symbol: string; // as traded: 'MNQZ5', 'SPY 500C 12/19', 'AAPL'
  assetType: AssetType;
  side: Side;
  qty: number; // contracts / shares, > 0
  entry: number;
  exit: number;
  fees: number; // round-trip commissions + fees in $, >= 0
  multiplier: number; // resolved at save time (futures point value, 100 for options, 1 stock)
  option?: OptionLeg;
  setup?: string; // one setup chip
  mistakes?: string[]; // mistake chips
  mood?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  stop?: number; // optional planned stop price → R-multiple
  photoKeys?: string[]; // S3 keys, max 6
  source: TradeSource;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface DayNote {
  date: string; // 'YYYY-MM-DD'
  plan?: { bias?: 'long' | 'short' | 'neutral'; levels?: string; focus?: string };
  review?: { text?: string; followedPlan?: boolean | null; mood?: 1 | 2 | 3 | 4 | 5 };
  updatedAt: string;
}

export type AccountType = 'personal' | 'prop-eval' | 'prop-funded';
export type AccountStatus = 'active' | 'passed' | 'failed' | 'archived';

export interface Account {
  id: string;
  name: string; // 'Apex 50K #2'
  type: AccountType;
  startBalance: number;
  profitTarget?: number; // $ above startBalance (prop-eval)
  maxDrawdown?: number; // $ allowed below peak (trailing) or below start (static)
  drawdownType?: 'trailing' | 'static';
  dailyLossLimit?: number;
  status: AccountStatus;
  createdAt: string;
}

export interface Settings {
  defaultAccountId: string | null;
  feesPerContract: Record<string, number>; // keyed by futures root ('MNQ') + 'default'; per side × 2 already (round trip per contract)
  breakevenBand: number; // |net| <= band counts as breakeven
  setups: string[];
  mistakes: string[];
  recentSymbols: string[]; // most-recent first, max 8
}

export interface Bootstrap {
  settings: Settings;
  accounts: Account[];
  trades: Trade[];
  days: DayNote[];
}

export const DEFAULT_SETTINGS: Settings = {
  defaultAccountId: null,
  feesPerContract: { default: 0, MNQ: 1.24, MES: 1.24, NQ: 4.28, ES: 4.28 },
  breakevenBand: 0,
  setups: ['Breakout', 'Pullback', 'Reversal', 'Range fade', 'Opening drive'],
  mistakes: ['FOMO entry', 'Moved stop', 'Oversized', 'Early exit', 'Revenge trade', 'No plan'],
  recentSymbols: ['MNQ', 'MES'],
};
