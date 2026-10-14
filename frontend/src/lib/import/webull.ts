// Webull order history (stocks and options). Only Filled orders; executions are FIFO-matched per symbol.
import { matchFifo, type Fill } from './fifo';
import { Cols, optionSymbol, parseNum, parseOcc, parseStamp, type ParseResult } from './util';

export function isWebull(c: Cols): boolean {
  return c.has('symbol') && c.has('side') && c.has('status') && c.has('filledtime', 'placedtime') && c.has('avgprice', 'price');
}

export function parseWebull(header: string[], rows: string[][]): ParseResult {
  const c = new Cols(header);
  const warnings: string[] = [];
  let skipped = 0;
  const fills: Fill[] = [];
  rows.forEach((row, i) => {
    const status = c.get(row, 'status').toLowerCase();
    if (status !== 'filled') return; // cancelled / pending / failed orders are not executions
    const sideText = c.get(row, 'side').toLowerCase();
    const side = sideText.startsWith('buy') ? 'buy' : sideText.startsWith('sell') || sideText.startsWith('short') ? 'sell' : null;
    const qty = parseNum(c.get(row, 'filled', 'filledqty')) ?? parseNum(c.get(row, 'totalqty'));
    const price = parseNum(c.get(row, 'avgprice')) ?? parseNum(c.get(row, 'price'));
    const stamp = parseStamp(c.get(row, 'filledtime') || c.get(row, 'placedtime'));
    const raw = c.get(row, 'symbol').toUpperCase();
    if (!side || !qty || qty <= 0 || price === null || !stamp || !raw) {
      skipped++;
      warnings.push(`Row ${i + 2}: incomplete filled order — skipped.`);
      return;
    }
    const option = parseOcc(raw);
    const f: Fill = option
      ? { symbol: optionSymbol(option), date: stamp.date, time: stamp.sortKey, side, qty, price, assetType: 'option', option }
      : { symbol: raw, date: stamp.date, time: stamp.sortKey, side, qty, price, assetType: 'stock' };
    fills.push(f);
  });
  const { trades, openPositions } = matchFifo(fills);
  if (openPositions) warnings.push(`${openPositions} position(s) still open at the end of the file were not imported.`);
  return { trades: trades.map((t) => ({ ...t, fees: null })), warnings, skipped };
}
