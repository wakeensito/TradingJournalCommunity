// NinjaTrader 8: Trade Performance → "Trades" grid exported to CSV. One round trip per row.
import { Cols, parseNum, parseStamp, type ParseResult, type RawTrade } from './util';

export function isNinjaTrader(c: Cols): boolean {
  return c.has('marketpos') && c.has('entryprice') && c.has('exitprice') && c.has('instrument');
}

export function parseNinjaTrader(header: string[], rows: string[][]): ParseResult {
  const c = new Cols(header);
  const trades: RawTrade[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  const hasFees = c.has('commission', 'fees');
  rows.forEach((row, i) => {
    const instrument = c.get(row, 'instrument');
    const pos = c.get(row, 'marketpos').toLowerCase();
    const qty = parseNum(c.get(row, 'qty', 'quantity'));
    const entry = parseNum(c.get(row, 'entryprice'));
    const exit = parseNum(c.get(row, 'exitprice'));
    const opened = parseStamp(c.get(row, 'entrytime'));
    const closed = parseStamp(c.get(row, 'exittime'));
    const side = pos.startsWith('long') ? 'long' : pos.startsWith('short') ? 'short' : null;
    if (!instrument || !side || !qty || qty <= 0 || entry === null || exit === null || !opened) {
      skipped++;
      warnings.push(`Row ${i + 2}: missing or invalid instrument, position, qty, price or entry time — skipped.`);
      return;
    }
    let fees: number | null = null;
    if (hasFees) {
      fees = Math.abs(parseNum(c.get(row, 'commission')) ?? 0);
      if (c.has('fees')) fees += Math.abs(parseNum(c.get(row, 'fees')) ?? 0);
    }
    const t: RawTrade = {
      date: opened.date,
      symbol: instrument.toUpperCase().replace(/\s+/g, ' '),
      assetType: 'futures',
      side,
      qty,
      entry,
      exit,
      fees,
    };
    if (opened.time) t.time = opened.time;
    if (closed?.time) t.exitTime = closed.time;
    trades.push(t);
  });
  return { trades, warnings, skipped };
}
