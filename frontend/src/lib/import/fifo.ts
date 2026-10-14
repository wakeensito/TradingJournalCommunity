// FIFO round-trip matcher for execution-level exports (Webull, Robinhood, Tradovate fills).
// One round trip = position goes from flat → back to flat. Scaling in/out is aggregated into qty-weighted
// average entry/exit prices. A fill that crosses through zero closes the trip and opens the opposite one (flip).
import type { AssetType, OptionLeg, Trade } from '../types';
import { round2 } from '../pnl';
import { round6 } from './util';

export interface Fill {
  symbol: string;
  date: string; // 'YYYY-MM-DD'
  time: string; // sortable within the date: 'HH:MM:SS' / 'HH:MM' / '' (unknown → file order)
  side: 'buy' | 'sell';
  qty: number;
  price: number;
  fees?: number;
  assetType: AssetType;
  option?: OptionLeg;
}

export type FifoTrade = Omit<Trade, 'id' | 'accountId' | 'source' | 'createdAt' | 'updatedAt' | 'multiplier' | 'fees'> & {
  fees: number;
};

interface Open {
  side: Trade['side'];
  pos: number; // open qty (> 0)
  entryQty: number;
  entryNotional: number;
  exitQty: number;
  exitNotional: number;
  fees: number;
  date: string;
  time: string;
  lastTime: string;
  first: Fill;
  seq: number; // position of the opening fill in chronological order
}

const EPS = 1e-9;
const hhmm = (t: string) => (/^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : undefined);

export function matchFifo(fills: Fill[]): { trades: FifoTrade[]; openPositions: number } {
  const ordered = fills
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.qty > 0 && Number.isFinite(f.price))
    .sort((a, b) => {
      if (a.f.date !== b.f.date) return a.f.date < b.f.date ? -1 : 1;
      if (a.f.time !== b.f.time && a.f.time && b.f.time) return a.f.time < b.f.time ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.f);

  const open = new Map<string, Open>();
  const closed: { t: FifoTrade; seq: number }[] = [];

  const close = (o: Open) => {
    const t: FifoTrade = {
      date: o.date,
      symbol: o.first.symbol,
      assetType: o.first.assetType,
      side: o.side,
      qty: round6(o.entryQty),
      entry: round6(o.entryNotional / o.entryQty),
      exit: round6(o.exitNotional / o.exitQty),
      fees: round2(o.fees),
    };
    const tm = hhmm(o.time);
    if (tm) t.time = tm;
    const ex = hhmm(o.lastTime);
    if (ex) t.exitTime = ex;
    if (o.first.option) t.option = o.first.option;
    closed.push({ t, seq: o.seq });
  };

  ordered.forEach((f, seq) => {
    const key = [f.assetType, f.symbol.toUpperCase(), f.option?.expiry ?? ''].join('|');
    const feePerUnit = (f.fees ?? 0) / f.qty;
    let remaining = f.qty;
    let o = open.get(key);
    const fillSide: Trade['side'] = f.side === 'buy' ? 'long' : 'short';

    if (o && o.side !== fillSide) {
      const closing = Math.min(remaining, o.pos);
      o.exitQty += closing;
      o.exitNotional += closing * f.price;
      o.fees += feePerUnit * closing;
      o.pos -= closing;
      o.lastTime = f.time;
      remaining -= closing;
      if (o.pos <= EPS) {
        close(o);
        open.delete(key);
        o = undefined;
      }
    }
    if (remaining > EPS) {
      if (!o) {
        o = {
          side: fillSide,
          pos: 0,
          entryQty: 0,
          entryNotional: 0,
          exitQty: 0,
          exitNotional: 0,
          fees: 0,
          date: f.date,
          time: f.time,
          lastTime: f.time,
          first: f,
          seq,
        };
        open.set(key, o);
      }
      o.pos += remaining;
      o.entryQty += remaining;
      o.entryNotional += remaining * f.price;
      o.fees += feePerUnit * remaining;
    }
  });
  // Emit in entry order (trips are closed in exit order).
  closed.sort((a, b) => a.seq - b.seq);
  return { trades: closed.map((x) => x.t), openPositions: open.size };
}
