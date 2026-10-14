// Our own CSV export format (see lib/export.ts) — lossless round trip of the journal fields.
import type { AssetType, Trade } from '../types';
import { parseLooseDate, parseLooseTime } from '../dates';
import { Cols, parseNum, type ParseResult, type RawTrade } from './util';

export const GENERIC_HEADERS = [
  'id', 'date', 'time', 'exitTime', 'account', 'symbol', 'assetType', 'side', 'qty', 'entry', 'exit',
  'fees', 'multiplier', 'setup', 'mistakes', 'mood', 'notes', 'stop',
  'optionUnderlying', 'optionRight', 'optionStrike', 'optionExpiry',
] as const;

export function isGeneric(c: Cols): boolean {
  return c.has('assettype') && c.has('side') && c.has('entry') && c.has('exit') && c.has('symbol') && c.has('date');
}

const ASSET: Record<string, AssetType> = { futures: 'futures', future: 'futures', option: 'option', options: 'option', stock: 'stock', stocks: 'stock' };

export function parseGeneric(header: string[], rows: string[][]): ParseResult {
  const c = new Cols(header);
  const trades: RawTrade[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  rows.forEach((row, i) => {
    const date = parseLooseDate(c.get(row, 'date'));
    const symbol = c.get(row, 'symbol').toUpperCase();
    const assetType = ASSET[c.get(row, 'assettype').toLowerCase()];
    const sideText = c.get(row, 'side').toLowerCase();
    const side: Trade['side'] | null = sideText === 'long' || sideText === 'buy' ? 'long' : sideText === 'short' || sideText === 'sell' ? 'short' : null;
    const qty = parseNum(c.get(row, 'qty'));
    const entry = parseNum(c.get(row, 'entry'));
    const exit = parseNum(c.get(row, 'exit'));
    if (!date || !symbol || !assetType || !side || !qty || qty <= 0 || entry === null || exit === null) {
      skipped++;
      warnings.push(`Row ${i + 2}: missing or invalid date, symbol, asset type, side, qty or price — skipped.`);
      return;
    }
    const fees = parseNum(c.get(row, 'fees'));
    const t: RawTrade = { date, symbol, assetType, side, qty, entry, exit, fees: fees === null ? null : Math.abs(fees) };
    const id = c.get(row, 'id');
    if (/^[A-Za-z0-9_-]{1,64}$/.test(id)) t.id = id;
    const time = parseLooseTime(c.get(row, 'time'));
    if (time) t.time = time;
    const exitTime = parseLooseTime(c.get(row, 'exittime'));
    if (exitTime) t.exitTime = exitTime;
    const account = c.get(row, 'account');
    if (account) t.accountName = account;
    const mult = parseNum(c.get(row, 'multiplier'));
    if (mult !== null && mult > 0) t.multiplier = mult;
    const setup = c.get(row, 'setup');
    if (setup) t.setup = setup;
    const mistakes = c.get(row, 'mistakes').split('|').map((m) => m.trim()).filter(Boolean);
    if (mistakes.length) t.mistakes = mistakes;
    const mood = parseNum(c.get(row, 'mood'));
    if (mood !== null && Number.isInteger(mood) && mood >= 1 && mood <= 5) t.mood = mood as Trade['mood'];
    const notes = c.index('notes') >= 0 ? (row[c.index('notes')] ?? '') : '';
    if (notes.trim()) t.notes = notes;
    const stop = parseNum(c.get(row, 'stop'));
    if (stop !== null) t.stop = stop;
    // optional option-leg columns (absent in older exports)
    const und = c.get(row, 'optionunderlying').toUpperCase();
    const right = c.get(row, 'optionright').toUpperCase();
    const strike = parseNum(c.get(row, 'optionstrike'));
    const expiry = parseLooseDate(c.get(row, 'optionexpiry'));
    if (und && (right === 'C' || right === 'P') && strike !== null && expiry) {
      t.option = { underlying: und, right, strike, expiry };
    }
    trades.push(t);
  });
  return { trades, warnings, skipped };
}
