import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Account, type Settings, type Trade } from '../types';
import { detectBroker, importCsv, ImportError } from '../import';
import { exportCsv, exportJson } from '../export';
import { computeStats } from '../stats';
import { netPnl } from '../pnl';
import { fixture } from './helpers';

const ctx = { settings: DEFAULT_SETTINGS, accountId: 'acct1', nowIso: '2026-10-13T12:00:00.000Z' };
const nets = (ts: Trade[]) => ts.map(netPnl);

describe('detectBroker', () => {
  it.each([
    ['symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration', 'tradovate'],
    ['orderId,Account,B/S,Contract,Product,avgPrice,filledQty,Fill Time,Status', 'tradovate'],
    ['Fill ID,Order ID,Timestamp,B/S,Quantity,Price,Contract,Product,commission', 'tradovate'],
    ['Trade number,Instrument,Account,Strategy,Market pos.,Qty,Entry price,Exit price,Entry time,Exit time,Profit,Commission', 'ninjatrader'],
    ['Name,Symbol,Side,Status,Filled,Total Qty,Price,Avg Price,Time-in-Force,Placed Time,Filled Time', 'webull'],
    ['Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount', 'robinhood'],
    ['id,date,time,exitTime,account,symbol,assetType,side,qty,entry,exit,fees,multiplier,setup,mistakes,mood,notes,stop', 'generic'],
    ['foo,bar,baz', null],
  ])('%s', (h, src) => expect(detectBroker(h.split(','))).toBe(src));

  it('throws ImportError on unknown files', () => {
    expect(() => importCsv('foo,bar\n1,2', ctx)).toThrow(ImportError);
    expect(() => importCsv('', ctx)).toThrow(ImportError);
  });
});

describe('Tradovate Performance', () => {
  const r = importCsv(fixture('tradovate-performance.csv'), ctx);
  it('parses round trips incl. a short and an unknown contract', () => {
    expect(r.source).toBe('tradovate');
    expect(r.skipped).toBe(1);
    expect(r.trades.map((t) => [t.symbol, t.side, t.qty, t.entry, t.exit, t.fees, t.multiplier, t.date, t.time, t.exitTime])).toEqual([
      ['MNQZ5', 'long', 2, 21034.25, 21040.75, 2.48, 2, '2025-12-03', '09:41', '09:44'],
      ['MNQZ5', 'short', 1, 21060.5, 21050, 1.24, 2, '2025-12-03', '10:02', '10:15'],
      ['MESZ5', 'long', 3, 6045.25, 6043, 3.72, 5, '2025-12-03', '11:30', '11:35'],
      ['HGZ5', 'long', 1, 4.9, 4.915, 0, 25000, '2025-12-03', '13:02', '13:20'],
      ['ESH6', 'long', 1, 6080.5, 6078.25, 4.28, 50, '2025-12-04', '09:31', '09:33'],
    ]);
    expect(nets(r.trades)).toEqual([23.52, 19.76, -37.47, 375, -116.78]);
  });
  it('stamps account, source, timestamps, deterministic ids', () => {
    for (const t of r.trades) {
      expect(t).toMatchObject({ accountId: 'acct1', source: 'tradovate', createdAt: ctx.nowIso, updatedAt: ctx.nowIso });
      expect(t.id).toMatch(/^imp_/);
    }
    expect(new Set(r.trades.map((t) => t.id)).size).toBe(r.trades.length);
  });
  it('warns about the skipped row and the inferred point value', () => {
    expect(r.warnings.some((w) => /Row 7/.test(w))).toBe(true);
    expect(r.warnings.some((w) => /HG.*25000/.test(w))).toBe(true);
  });
  it('is idempotent: re-import yields identical ids', () => {
    const again = importCsv(fixture('tradovate-performance.csv'), { ...ctx, nowIso: '2027-01-01T00:00:00.000Z' });
    expect(again.trades.map((t) => t.id)).toEqual(r.trades.map((t) => t.id));
  });
  it('tab-delimited copy/paste works too', () => {
    const tsv = fixture('tradovate-performance.csv')
      .split('\n')
      .map((l) => l.replace('"6,045.25"', '6045.25').split(',').join('\t'))
      .join('\n');
    expect(importCsv(tsv, ctx).trades.map((t) => t.id)).toEqual(r.trades.map((t) => t.id));
  });
  it('identical duplicate rows get distinct but stable ids', () => {
    const lines = fixture('tradovate-performance.csv').trim().split('\n');
    const text = [lines[0], lines[1], lines[1]].join('\n');
    const a = importCsv(text, ctx).trades.map((t) => t.id);
    expect(a[0]).not.toBe(a[1]);
    expect(importCsv(text, ctx).trades.map((t) => t.id)).toEqual(a);
  });
  it('unknown contract without pnl → multiplier 1 + warning', () => {
    const text = 'symbol,qty,buyPrice,sellPrice,boughtTimestamp,soldTimestamp\nZZZZ5,1,10,11,12/03/2025 09:00:00,12/03/2025 09:05:00';
    const x = importCsv(text, ctx);
    expect(x.trades[0]!.multiplier).toBe(1);
    expect(x.warnings.some((w) => /ZZZ.*unknown/.test(w))).toBe(true);
  });
});

describe('Tradovate Orders (fills → FIFO)', () => {
  const r = importCsv(fixture('tradovate-orders.csv'), ctx);
  it('scale-in/partial exits and a flip', () => {
    expect(r.source).toBe('tradovate');
    expect(r.skipped).toBe(0);
    expect(r.trades.map((t) => [t.side, t.qty, t.entry, t.exit, t.fees, t.time, t.exitTime])).toEqual([
      ['long', 3, 21001, 21012, 3.72, '09:30', '09:40'],
      ['short', 1, 21020, 21015, 1.24, '10:05', '10:07'],
      ['long', 1, 21015, 21018.25, 1.24, '10:07', '10:12'],
    ]);
    expect(nets(r.trades)).toEqual([62.28, 8.76, 5.26]);
  });
});

describe('NinjaTrader', () => {
  const r = importCsv(fixture('ninjatrader-trades.csv'), ctx);
  it('uses commission from the file', () => {
    expect(r.source).toBe('ninjatrader');
    expect(r.trades.map((t) => [t.symbol, t.side, t.qty, t.entry, t.exit, t.fees, t.multiplier, t.date, t.time, t.exitTime])).toEqual([
      ['MNQ 12-25', 'long', 2, 21034.25, 21041.5, 2.48, 2, '2025-12-03', '09:41', '09:47'],
      ['ES 03-26', 'short', 1, 6080.5, 6082.75, 4.28, 50, '2025-12-03', '13:05', '13:15'],
      ['MES 12-25', 'short', 3, 6045, 6040.25, 3.72, 5, '2025-12-04', '10:00', '10:12'],
      ['M2K 12-25', 'long', 1, 2400, 2400, 0.5, 5, '2025-12-04', '12:00', '12:01'],
    ]);
    expect(nets(r.trades)).toEqual([26.52, -116.78, 67.53, -0.5]);
  });
  it('stats over the import', () => {
    const s = computeStats(r.trades, 1);
    expect(s).toMatchObject({ wins: 2, losses: 1, flats: 1, net: -23.23, fees: 10.98, gross: -12.25, profitFactor: 0.81, maxDrawdown: 116.78 });
  });
});

describe('Webull', () => {
  const r = importCsv(fixture('webull-orders.csv'), ctx);
  it('filled orders only; OCC options; FIFO; short; open position warning', () => {
    expect(r.source).toBe('webull');
    expect(r.trades.map((t) => [t.symbol, t.assetType, t.side, t.qty, t.entry, t.exit, t.fees, t.multiplier, t.time])).toEqual([
      ['SPY 500C 12/19', 'option', 'long', 2, 1.25, 1.7, 0, 100, '09:35'],
      ['AAPL', 'stock', 'long', 10, 190.5, 189, 0, 1, '09:40'],
      ['TSLA', 'stock', 'short', 5, 250, 245.1, 0, 1, '09:58'],
    ]);
    expect(r.trades[0]!.option).toEqual({ underlying: 'SPY', right: 'C', strike: 500, expiry: '2025-12-19' });
    expect(nets(r.trades)).toEqual([90, -15, 24.5]);
    expect(r.warnings.some((w) => /1 position/.test(w))).toBe(true);
  });
  it('option fees from settings when configured', () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, feesPerContract: { ...DEFAULT_SETTINGS.feesPerContract, option: 0.65 } };
    expect(importCsv(fixture('webull-orders.csv'), { ...ctx, settings }).trades[0]!.fees).toBe(1.3);
  });
});

describe('Robinhood', () => {
  const r = importCsv(fixture('robinhood-activity.csv'), ctx);
  it('options (BTO/STC, STO/BTC) + stocks; fees from Amount; ignores ACH/CDIV/footer', () => {
    expect(r.source).toBe('robinhood');
    expect(r.skipped).toBe(0);
    expect(r.trades.map((t) => [t.date, t.symbol, t.assetType, t.side, t.qty, t.entry, t.exit, t.fees, t.multiplier])).toEqual([
      ['2025-12-03', 'AMD', 'stock', 'long', 5, 120, 121.4, 0.03, 1],
      ['2025-12-04', 'SPY 480P 12/19', 'option', 'long', 2, 1.5, 2.1, 0.12, 100],
      ['2025-12-05', 'SPY 510C 12/19', 'option', 'short', 1, 3, 1, 0.1, 100],
    ]);
    expect(nets(r.trades)).toEqual([6.97, 119.88, 199.9]);
    expect(r.trades[1]!.option).toEqual({ underlying: 'SPY', right: 'P', strike: 480, expiry: '2025-12-19' });
    expect(r.trades[0]!.time).toBeUndefined();
  });
});

describe('generic (own export) + round trip', () => {
  it('parses the fixture, keeping ids and journal fields', () => {
    const accounts: Account[] = [{ id: 'acc-apex', name: 'Apex 50K #2', type: 'prop-eval', startBalance: 50000, status: 'active', createdAt: '' }];
    const r = importCsv(fixture('generic-export.csv'), { ...ctx, accounts });
    expect(r.source).toBe('generic');
    expect(r.skipped).toBe(1);
    expect(r.trades[0]).toMatchObject({
      id: '01jd3k9x7a0000000001',
      accountId: 'acc-apex',
      setup: 'Breakout',
      mistakes: ['FOMO entry', 'Early exit'],
      mood: 4,
      notes: 'Clean break of ON high, "textbook"\nsecond line',
      stop: 21030,
      fees: 2.48,
      multiplier: 2,
      source: 'generic',
    });
    expect(r.trades[1]).toMatchObject({ accountId: 'acct1', side: 'short', fees: 0 });
    expect(nets(r.trades)).toEqual([23.52, 15]);
  });

  it('export → import is lossless for journal fields', () => {
    const src = importCsv(fixture('ninjatrader-trades.csv'), ctx).trades.map((t, i) => ({
      ...t,
      accountId: i % 2 ? 'a2' : 'a1',
      setup: i === 0 ? 'Opening drive' : undefined,
      mistakes: i === 1 ? ['Moved stop', 'Oversized'] : undefined,
      notes: i === 2 ? 'Faded the open, "ugly"\nbut, fine' : undefined,
      mood: i === 3 ? (2 as const) : undefined,
      stop: i === 0 ? 21030 : undefined,
    }));
    const accounts: Account[] = [
      { id: 'a1', name: 'Apex 50K', type: 'prop-eval', startBalance: 50000, status: 'active', createdAt: '' },
      { id: 'a2', name: 'Personal', type: 'personal', startBalance: 5000, status: 'active', createdAt: '' },
    ];
    const csv = exportCsv(src, accounts);
    const back = importCsv(csv, { ...ctx, accountId: null, accounts });
    expect(back.source).toBe('generic');
    expect(back.warnings).toEqual([]);
    const strip = (t: Trade) => {
      const { source: _s, createdAt: _c, updatedAt: _u, ...rest } = t;
      return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    };
    const byId = new Map(back.trades.map((t) => [t.id, t]));
    for (const t of src) expect(strip(byId.get(t.id)!)).toEqual(strip(t));
    expect(computeStats(back.trades, 0).net).toBe(computeStats(src, 0).net);
  });

  it('option legs round-trip through export → import', () => {
    const src = importCsv(fixture('robinhood-activity.csv'), ctx).trades;
    expect(src.some((t) => t.option)).toBe(true);
    const back = importCsv(exportCsv(src, []), ctx);
    const byId = new Map(back.trades.map((t) => [t.id, t]));
    for (const t of src) {
      const b = byId.get(t.id)!;
      expect(b.option).toEqual(t.option);
      expect([b.symbol, b.assetType, b.side, b.qty, b.entry, b.exit, b.fees, b.multiplier]).toEqual([t.symbol, t.assetType, t.side, t.qty, t.entry, t.exit, t.fees, t.multiplier]);
    }
    expect(back.trades.find((t) => t.assetType === 'option')!.option).toEqual({ underlying: 'SPY', right: 'P', strike: 480, expiry: '2025-12-19' });
  });

  it('files without option columns still import (backward compatible)', () => {
    const r = importCsv(fixture('generic-export.csv'), ctx);
    expect(r.trades).toHaveLength(2);
    expect(r.trades.every((t) => t.option === undefined)).toBe(true);
  });

  it('exportJson is the bootstrap verbatim', () => {
    const data = { settings: DEFAULT_SETTINGS, accounts: [], trades: [], days: [] };
    expect(JSON.parse(exportJson(data))).toEqual(data);
  });
});
