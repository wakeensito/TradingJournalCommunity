import { useMemo, useState } from 'react';
import type { Account, AssetType, Settings, Side, Trade } from '../lib/types';
import { defaultFees, netPnl, resolveMultiplier, rMultiple } from '../lib/pnl';
import { nowTimeLocal, todayLocal } from '../lib/dates';
import { newId } from '../lib/ids';
import { parseDecimal } from '../ui/controls';
import { inferAssetType } from '../app/domain';

const LAST_ACCOUNT_KEY = 'tj.lastAccount';

export function lastAccountId(accounts: Account[], settings: Settings): string | null {
  let id: string | null = null;
  try {
    id = localStorage.getItem(LAST_ACCOUNT_KEY);
  } catch {
    /* ignore */
  }
  const live = (x: string | null) => !!x && accounts.some((a) => a.id === x && a.status !== 'archived');
  if (live(id)) return id;
  if (live(settings.defaultAccountId)) return settings.defaultAccountId;
  return null;
}

export function rememberAccount(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_ACCOUNT_KEY, id);
  } catch {
    /* ignore */
  }
}

export interface DraftState {
  id: string;
  symbol: string;
  side: Side;
  qty: string;
  entry: string;
  exit: string;
  assetType: AssetType;
  assetTouched: boolean;
  fees: string;
  feesTouched: boolean;
  setup: string | null;
  mistakes: string[];
  mood: 1 | 2 | 3 | 4 | 5 | null;
  stop: string;
  notes: string;
  date: string;
  time: string;
  exitTime: string;
  accountId: string | null;
  photoKeys: string[];
  pending: File[];
}

const numStr = (n: number | undefined) => (n === undefined || n === null || !Number.isFinite(n) ? '' : String(n));

export function draftFromTrade(t: Trade): DraftState {
  return {
    id: t.id,
    symbol: t.symbol,
    side: t.side,
    qty: numStr(t.qty),
    entry: numStr(t.entry),
    exit: numStr(t.exit),
    assetType: t.assetType,
    assetTouched: true,
    fees: numStr(t.fees),
    feesTouched: true,
    setup: t.setup ?? null,
    mistakes: t.mistakes ?? [],
    mood: t.mood ?? null,
    stop: numStr(t.stop),
    notes: t.notes ?? '',
    date: t.date,
    time: t.time ?? '',
    exitTime: t.exitTime ?? '',
    accountId: t.accountId,
    photoKeys: t.photoKeys ?? [],
    pending: [],
  };
}

export function blankDraft(opts: { symbol?: string; side?: Side; accountId: string | null; assetType?: AssetType }): DraftState {
  return {
    id: newId(),
    symbol: opts.symbol ?? '',
    side: opts.side ?? 'long',
    qty: '1',
    entry: '',
    exit: '',
    assetType: opts.assetType ?? 'futures',
    assetTouched: false,
    fees: '',
    feesTouched: false,
    setup: null,
    mistakes: [],
    mood: null,
    stop: '',
    notes: '',
    date: todayLocal(),
    time: nowTimeLocal(),
    exitTime: '',
    accountId: opts.accountId,
    photoKeys: [],
    pending: [],
  };
}

export interface DraftErrors {
  symbol?: string;
  qty?: string;
  entry?: string;
  exit?: string;
  fees?: string;
  stop?: string;
  date?: string;
}

export function useTradeDraft(initial: () => DraftState, settings: Settings, trades: Trade[]) {
  const [d, setD] = useState<DraftState>(initial);
  const set = <K extends keyof DraftState>(k: K, v: DraftState[K]) => setD((s) => ({ ...s, [k]: v }));

  const assetType: AssetType = d.assetTouched ? d.assetType : inferAssetType(d.symbol, trades);
  const qty = parseDecimal(d.qty);
  const entry = parseDecimal(d.entry);
  const exit = parseDecimal(d.exit);
  const stop = parseDecimal(d.stop);
  const mult = resolveMultiplier(assetType, d.symbol || 'X');
  const autoFees = defaultFees(settings, assetType, d.symbol, qty ?? 0);
  const fees = d.feesTouched ? (parseDecimal(d.fees) ?? 0) : autoFees;

  const errors: DraftErrors = useMemo(() => {
    const e: DraftErrors = {};
    if (!d.symbol.trim()) e.symbol = 'Symbol is required.';
    if (qty === null || qty <= 0) e.qty = 'Quantity must be more than 0.';
    if (entry === null) e.entry = 'Entry price is required.';
    else if (entry < 0) e.entry = 'Price can’t be negative.';
    if (exit === null) e.exit = 'Exit price is required.';
    else if (exit < 0) e.exit = 'Price can’t be negative.';
    if (d.feesTouched && (parseDecimal(d.fees) ?? 0) < 0) e.fees = 'Fees can’t be negative.';
    if (d.stop.trim() && stop === null) e.stop = 'Not a number.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) e.date = 'Pick a date.';
    return e;
  }, [d, qty, entry, exit, stop]);

  const valid = Object.keys(errors).length === 0;

  const preview = useMemo(() => {
    if (qty === null || qty <= 0 || entry === null || exit === null) return null;
    const base = { entry, exit, qty, multiplier: mult.multiplier, side: d.side, fees };
    const net = netPnl(base);
    const r =
      stop !== null
        ? rMultiple({ ...base, stop, id: '', accountId: null, date: d.date, symbol: d.symbol, assetType, source: 'manual', createdAt: '', updatedAt: '' })
        : null;
    return { net, r };
  }, [qty, entry, exit, mult.multiplier, d.side, fees, stop, d.date, d.symbol, assetType]);

  function build(existing?: Trade): Trade {
    const now = new Date().toISOString();
    const t: Trade = {
      ...(existing ?? {}),
      id: d.id,
      accountId: d.accountId,
      date: d.date,
      symbol: d.symbol.trim().toUpperCase(),
      assetType,
      side: d.side,
      qty: qty ?? 0,
      entry: entry ?? 0,
      exit: exit ?? 0,
      fees: Math.max(0, fees),
      multiplier: mult.multiplier,
      source: existing?.source ?? 'manual',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const opt = <K extends keyof Trade>(k: K, v: Trade[K] | undefined | null | '') => {
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) delete t[k];
      else t[k] = v as Trade[K];
    };
    opt('time', d.time || undefined);
    opt('exitTime', d.exitTime || undefined);
    opt('setup', d.setup ?? undefined);
    opt('mistakes', d.mistakes);
    opt('mood', d.mood ?? undefined);
    opt('notes', d.notes.trim() || undefined);
    opt('stop', stop ?? undefined);
    opt('photoKeys', d.photoKeys);
    return t;
  }

  return { d, setD, set, assetType, mult, fees, autoFees, errors, valid, preview, build };
}

export type TradeDraft = ReturnType<typeof useTradeDraft>;
