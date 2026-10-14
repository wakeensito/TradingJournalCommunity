import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Trade } from '../types';

export function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url)), 'utf8');
}

let n = 0;
export function mk(p: Partial<Trade> = {}): Trade {
  n++;
  return {
    id: `t${n}`,
    accountId: null,
    date: '2025-12-03',
    symbol: 'MNQZ5',
    assetType: 'futures',
    side: 'long',
    qty: 1,
    entry: 100,
    exit: 100,
    fees: 0,
    multiplier: 1,
    source: 'manual',
    createdAt: '2025-12-03T00:00:00.000Z',
    updatedAt: '2025-12-03T00:00:00.000Z',
    ...p,
  };
}

/** A $-net trade (multiplier 1, qty 1, no fees) on a date/time. */
export function pnl(net: number, date = '2025-12-03', time?: string, extra: Partial<Trade> = {}): Trade {
  return mk({ date, entry: 100, exit: 100 + net, ...(time ? { time } : {}), ...extra });
}
