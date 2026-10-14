import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../types';
import { defaultFees, grossPnl, netPnl, outcome, resolveMultiplier, rMultiple, rootSymbol, round2 } from '../pnl';
import { mk } from './helpers';

describe('rootSymbol', () => {
  it.each([
    ['MNQZ5', 'MNQ'],
    ['MNQZ25', 'MNQ'],
    ['MNQ 12-25', 'MNQ'],
    ['ESH6', 'ES'],
    ['/MESZ5', 'MES'],
    ['M2KZ5', 'M2K'],
    ['6EZ5', '6E'],
    ['mnqz5', 'MNQ'],
    ['  NQM26 ', 'NQ'],
    ['MNQ', 'MNQ'],
    ['M2K', 'M2K'],
    ['6E', '6E'],
    ['ES', 'ES'],
    ['MYMH6', 'MYM'],
    ['CLF26', 'CL'],
    ['MNQZ5.CME', 'MNQ'],
    ['ES DEC25', 'ES'],
    ['@ESZ5', 'ES'],
  ])('%s → %s', (input, root) => expect(rootSymbol(input)).toBe(root));

  it('leaves non-futures alone (uppercased, trimmed)', () => {
    expect(rootSymbol(' aapl ')).toBe('AAPL');
    expect(rootSymbol('SPY 500C 12/19')).toBe('SPY 500C 12/19');
    expect(rootSymbol('SPY251219C00500000')).toBe('SPY251219C00500000');
  });
});

describe('resolveMultiplier', () => {
  it.each([
    ['ESZ5', 50], ['MESZ5', 5], ['NQZ5', 20], ['MNQZ5', 2], ['YMZ5', 5], ['MYMZ5', 0.5], ['RTYZ5', 50],
    ['M2KZ5', 5], ['CLF6', 1000], ['MCLF6', 100], ['GCG6', 100], ['MGCG6', 10], ['SIH6', 5000], ['NGF6', 10000],
    ['6EZ5', 125000], ['ZBH6', 1000], ['ZNH6', 1000],
  ])('%s → %d', (sym, m) => expect(resolveMultiplier('futures', sym)).toEqual({ multiplier: m, unknown: false }));

  it('never substring-matches (v1 bug: includes("ES"))', () => {
    expect(resolveMultiplier('futures', 'MESZ5').multiplier).toBe(5);
    expect(resolveMultiplier('futures', 'MNQZ5').multiplier).toBe(2);
    expect(resolveMultiplier('futures', 'ESTX50')).toEqual({ multiplier: 1, unknown: true });
  });
  it('unknown futures → 1, flagged', () => expect(resolveMultiplier('futures', 'HGZ5')).toEqual({ multiplier: 1, unknown: true }));
  it('options 100, stocks 1', () => {
    expect(resolveMultiplier('option', 'SPY 500C 12/19')).toEqual({ multiplier: 100, unknown: false });
    expect(resolveMultiplier('stock', 'ES')).toEqual({ multiplier: 1, unknown: false });
  });
});

describe('defaultFees', () => {
  const s = DEFAULT_SETTINGS;
  it('uses the root rate × qty', () => {
    expect(defaultFees(s, 'futures', 'MNQZ5', 3)).toBe(3.72);
    expect(defaultFees(s, 'futures', 'ES 03-26', 2)).toBe(8.56);
  });
  it('falls back to default', () => {
    expect(defaultFees({ ...s, feesPerContract: { default: 2.5 } }, 'futures', 'CLF6', 2)).toBe(5);
    expect(defaultFees({ ...s, feesPerContract: {} }, 'futures', 'CLF6', 2)).toBe(0);
  });
  it('options/stocks use their asset-type key', () => {
    const fp = { ...s, feesPerContract: { ...s.feesPerContract, option: 0.65, stock: 0.005 } };
    expect(defaultFees(fp, 'option', 'SPY 500C 12/19', 3)).toBe(1.95);
    expect(defaultFees(fp, 'stock', 'AAPL', 100)).toBe(0.5);
    expect(defaultFees(s, 'option', 'SPY', 3)).toBe(0);
  });
  it('rounds to cents', () => {
    expect(defaultFees({ ...s, feesPerContract: { default: 0.333 } }, 'futures', 'XYZ', 3)).toBe(1);
  });
});

describe('gross / net', () => {
  it('long MNQ with fees', () => {
    const t = mk({ symbol: 'MNQZ5', qty: 2, entry: 21034.25, exit: 21040.75, multiplier: 2, fees: 2.48 });
    expect(grossPnl(t)).toBe(26);
    expect(netPnl(t)).toBe(23.52);
  });
  it('short ES', () => {
    const t = mk({ side: 'short', qty: 1, entry: 6080.5, exit: 6078.25, multiplier: 50, fees: 4.28 });
    expect(grossPnl(t)).toBe(112.5);
    expect(netPnl(t)).toBe(108.22);
  });
  it('short loss', () => {
    expect(netPnl(mk({ side: 'short', entry: 10, exit: 12, qty: 3, multiplier: 100, fees: 1 }))).toBe(-601);
  });
  it('no float drift', () => {
    expect(netPnl(mk({ entry: 0.1, exit: 0.3, qty: 1, multiplier: 100, fees: 0.1 }))).toBe(19.9);
    expect(grossPnl(mk({ entry: 1.1, exit: 1.15, qty: 3, multiplier: 100 }))).toBe(15);
    expect(round2(-0.004)).toBe(0);
    expect(Object.is(round2(-0.001), 0)).toBe(true);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(-1.005)).toBe(-1.01);
  });
});

describe('outcome with breakeven band', () => {
  const t = (net: number) => mk({ entry: 100, exit: 100 + net, fees: 0 });
  it('band 0: exact zero is flat', () => {
    expect(outcome(t(0), 0)).toBe('flat');
    expect(outcome(t(0.01), 0)).toBe('win');
    expect(outcome(t(-0.01), 0)).toBe('loss');
  });
  it('band 5: |net| <= 5 is flat (inclusive)', () => {
    expect(outcome(t(5), 5)).toBe('flat');
    expect(outcome(t(-5), 5)).toBe('flat');
    expect(outcome(t(5.01), 5)).toBe('win');
    expect(outcome(t(-5.01), 5)).toBe('loss');
  });
  it('fees can turn a scratch into a loss', () => {
    expect(outcome(mk({ entry: 100, exit: 100, fees: 1.24 }), 0)).toBe('loss');
    expect(outcome(mk({ entry: 100, exit: 100, fees: 1.24 }), 2)).toBe('flat');
  });
});

describe('rMultiple', () => {
  it('long with stop', () => {
    expect(rMultiple(mk({ entry: 100, exit: 106, stop: 98, qty: 2, multiplier: 2 }))).toBe(3);
  });
  it('short with stop, net of fees', () => {
    // risk = 2 × 1 × 50 = 100; net = (6080.5−6078.25)×50 − 4.28 = 108.22
    expect(rMultiple(mk({ side: 'short', entry: 6080.5, exit: 6078.25, stop: 6082.5, multiplier: 50, fees: 4.28 }))).toBe(1.08);
  });
  it('null without stop or with zero risk', () => {
    expect(rMultiple(mk({}))).toBeNull();
    expect(rMultiple(mk({ stop: 100, entry: 100 }))).toBeNull();
  });
});
