// Robinhood account activity CSV. Buy/Sell (stocks) and BTO/STC/STO/BTC (options) become fills → FIFO.
// The file is newest-first and has dates only, so rows are replayed bottom-up.
import type { OptionLeg } from '../types';
import { parseLooseDate } from '../dates';
import { round2 } from '../pnl';
import { matchFifo, type Fill } from './fifo';
import { Cols, optionSymbol, parseNum, type ParseResult } from './util';

export function isRobinhood(c: Cols): boolean {
  return c.has('transcode') && c.has('activitydate') && c.has('instrument');
}

const BUY = new Set(['BUY', 'BTO', 'BTC']);
const SELL = new Set(['SELL', 'STC', 'STO']);
const OPTION_CODES = new Set(['BTO', 'BTC', 'STO', 'STC']);

/** 'SPY 12/19/2025 Call $500.00' → OptionLeg. */
export function parseRobinhoodOption(description: string, instrument: string): OptionLeg | null {
  const m = /^\s*([A-Z][A-Z0-9.]*)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(Call|Put)\s+\$?([\d,]+(?:\.\d+)?)/i.exec(description);
  if (!m) return null;
  const expiry = parseLooseDate(m[2]!);
  const strike = parseNum(m[4]);
  if (!expiry || strike === null) return null;
  return {
    underlying: (instrument || m[1]!).toUpperCase(),
    right: m[3]!.toLowerCase() === 'call' ? 'C' : 'P',
    strike,
    expiry,
  };
}

export function parseRobinhood(header: string[], rows: string[][]): ParseResult {
  const c = new Cols(header);
  const warnings: string[] = [];
  let skipped = 0;
  const hasAmount = c.has('amount');
  const fills: Fill[] = [];
  // newest-first file → oldest-first replay
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]!;
    const code = c.get(row, 'transcode').toUpperCase();
    if (!BUY.has(code) && !SELL.has(code)) continue; // dividends, transfers, fees, footer text…
    const date = parseLooseDate(c.get(row, 'activitydate'));
    const qty = parseNum(c.get(row, 'quantity'));
    const price = parseNum(c.get(row, 'price'));
    const instrument = c.get(row, 'instrument').toUpperCase();
    if (!date || !qty || qty <= 0 || price === null || !instrument) {
      skipped++;
      warnings.push(`Row ${i + 2}: incomplete ${code} row — skipped.`);
      continue;
    }
    const isOption = OPTION_CODES.has(code);
    let option: OptionLeg | null = null;
    if (isOption) {
      option = parseRobinhoodOption(c.get(row, 'description'), instrument);
      if (!option) {
        skipped++;
        warnings.push(`Row ${i + 2}: could not read the option contract from the description — skipped.`);
        continue;
      }
    }
    const side = BUY.has(code) ? 'buy' : 'sell';
    const f: Fill = option
      ? { symbol: optionSymbol(option), date, time: '', side, qty, price, assetType: 'option', option }
      : { symbol: instrument, date, time: '', side, qty, price, assetType: 'stock' };
    if (hasAmount) {
      // Amount is net cash: notional minus (sell) / plus (buy) regulatory & contract fees.
      const amount = parseNum(c.get(row, 'amount'));
      if (amount !== null) {
        const notional = qty * price * (isOption ? 100 : 1);
        const fee = side === 'buy' ? -amount - notional : notional - amount;
        f.fees = Math.max(0, round2(fee));
      }
    }
    fills.push(f);
  }
  const { trades, openPositions } = matchFifo(fills);
  if (openPositions) warnings.push(`${openPositions} position(s) still open at the end of the file were not imported.`);
  return { trades: trades.map((t) => ({ ...t, fees: hasAmount ? t.fees : null })), warnings, skipped };
}
