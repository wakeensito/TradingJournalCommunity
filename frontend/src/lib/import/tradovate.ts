// Tradovate: "Performance" export (one round trip per row) and "Orders"/"Fills" exports (executions → FIFO).
import { resolveMultiplier, rootSymbol } from '../pnl';
import { matchFifo, type Fill } from './fifo';
import { Cols, parseNum, parseStamp, round6, type ParseResult, type RawTrade } from './util';

export function isTradovatePerformance(c: Cols): boolean {
  return c.has('boughttimestamp') && c.has('soldtimestamp') && c.has('buyprice') && c.has('sellprice');
}

export function isTradovateFills(c: Cols): boolean {
  return (
    c.has('bs') &&
    c.has('contract', 'product') &&
    c.has('avgfillprice', 'avgprice', 'fillprice', 'price') &&
    c.has('filledqty', 'fillqty', 'quantity', 'qty')
  );
}

export function parseTradovate(header: string[], rows: string[][]): ParseResult {
  const c = new Cols(header);
  return isTradovatePerformance(c) ? parsePerformance(c, rows) : parseFills(c, rows);
}

function parsePerformance(c: Cols, rows: string[][]): ParseResult {
  const trades: RawTrade[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  const hasFees = c.has('commission', 'fees', 'fee');
  rows.forEach((row, i) => {
    const symbol = c.get(row, 'symbol', 'contract');
    const qty = parseNum(c.get(row, 'qty', 'quantity'));
    const buy = parseNum(c.get(row, 'buyprice'));
    const sell = parseNum(c.get(row, 'sellprice'));
    const bought = parseStamp(c.get(row, 'boughttimestamp'));
    const sold = parseStamp(c.get(row, 'soldtimestamp'));
    if (!symbol || !qty || qty <= 0 || buy === null || sell === null || !bought || !sold) {
      skipped++;
      warnings.push(`Row ${i + 2}: missing or invalid symbol, qty, price or timestamp — skipped.`);
      return;
    }
    const boughtKey = `${bought.date} ${bought.sortKey}`;
    const soldKey = `${sold.date} ${sold.sortKey}`;
    const long = boughtKey <= soldKey;
    const [open, close] = long ? [bought, sold] : [sold, bought];
    const t: RawTrade = {
      date: open.date,
      symbol: symbol.toUpperCase(),
      assetType: 'futures',
      side: long ? 'long' : 'short',
      qty,
      entry: long ? buy : sell,
      exit: long ? sell : buy,
      fees: hasFees ? Math.abs(parseNum(c.get(row, 'commission', 'fees', 'fee')) ?? 0) : null,
    };
    if (open.time) t.time = open.time;
    if (close.time) t.exitTime = close.time;

    // Unknown contract: infer the point value from Tradovate's own (gross) pnl column.
    const pnl = parseNum(c.get(row, 'pnl'));
    if (resolveMultiplier('futures', t.symbol).unknown && pnl !== null && sell !== buy) {
      const inferred = round6(Math.abs(pnl / ((sell - buy) * qty)));
      if (inferred > 0 && Number.isFinite(inferred)) {
        t.multiplier = inferred;
        warnings.push(`${rootSymbol(t.symbol)}: point value ${inferred} inferred from the file's pnl column.`);
      }
    }
    trades.push(t);
  });
  return { trades, warnings, skipped };
}

function parseFills(c: Cols, rows: string[][]): ParseResult {
  const warnings: string[] = [];
  let skipped = 0;
  const hasFees = c.has('commission', 'fees', 'fee');
  const fills: Fill[] = [];
  rows.forEach((row, i) => {
    const status = c.get(row, 'status').toLowerCase();
    if (status && !status.includes('fill')) return; // canceled / rejected / working orders aren't trades
    const bs = c.get(row, 'bs', 'side', 'buysell').toLowerCase();
    const side = bs.startsWith('b') ? 'buy' : bs.startsWith('s') ? 'sell' : null;
    const qty = parseNum(c.get(row, 'filledqty', 'fillqty', 'quantity', 'qty'));
    const price = parseNum(c.get(row, 'avgfillprice', 'avgprice', 'fillprice', 'price'));
    const stamp = parseStamp(c.get(row, 'filltime', 'timestamp', 'time') || c.get(row, 'date'));
    const symbol = c.get(row, 'contract', 'product', 'symbol').toUpperCase();
    if (!side || !qty || qty <= 0 || price === null || !stamp || !symbol) {
      if (qty === 0) return; // unfilled order rows
      skipped++;
      warnings.push(`Row ${i + 2}: incomplete fill — skipped.`);
      return;
    }
    const f: Fill = { symbol, date: stamp.date, time: stamp.sortKey, side, qty, price, assetType: 'futures' };
    if (hasFees) f.fees = Math.abs(parseNum(c.get(row, 'commission', 'fees', 'fee')) ?? 0);
    fills.push(f);
  });
  const { trades, openPositions } = matchFifo(fills);
  if (openPositions) warnings.push(`${openPositions} position(s) still open at the end of the file were not imported.`);
  return {
    trades: trades.map((t) => ({ ...t, fees: hasFees ? t.fees : null })),
    warnings,
    skipped,
  };
}
