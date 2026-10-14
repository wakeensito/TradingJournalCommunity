// Full export (no lock-in). The CSV re-imports through lib/import/generic.ts.
import type { Account, Bootstrap, Trade } from './types';
import { toCsv } from './csv';
import { GENERIC_HEADERS } from './import/generic';
import { sortTrades } from './stats';

export function exportCsv(trades: Trade[], accounts: Account[]): string {
  const names = new Map(accounts.map((a) => [a.id, a.name]));
  const rows: (string | number | null | undefined)[][] = [[...GENERIC_HEADERS]];
  for (const t of [...sortTrades(trades)].reverse()) {
    rows.push([
      t.id,
      t.date,
      t.time,
      t.exitTime,
      t.accountId ? (names.get(t.accountId) ?? '') : '',
      t.symbol,
      t.assetType,
      t.side,
      t.qty,
      t.entry,
      t.exit,
      t.fees,
      t.multiplier,
      t.setup,
      (t.mistakes ?? []).join('|'),
      t.mood,
      t.notes,
      t.stop,
      t.option?.underlying,
      t.option?.right,
      t.option?.strike,
      t.option?.expiry,
    ]);
  }
  return toCsv(rows);
}

export function exportJson(data: Bootstrap): string {
  return JSON.stringify(data, null, 2);
}
