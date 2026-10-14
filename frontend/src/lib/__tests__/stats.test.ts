import { describe, expect, it } from 'vitest';
import { breakdown, computeStats, dailySeries, groupByDay, sortTrades } from '../stats';
import { mk, pnl } from './helpers';

describe('computeStats', () => {
  it('empty', () => {
    const s = computeStats([], 0);
    expect(s).toMatchObject({ count: 0, net: 0, winRate: null, profitFactor: null, expectancy: null, maxDrawdown: 0, bestDay: null, tradingDays: 0, currentStreak: { kind: 'none', length: 0 } });
  });

  it('profit factor is gross wins / |gross losses|, not payoff ratio', () => {
    // 3 wins of 100, 1 loss of 150 → PF = 300/150 = 2; payoff = 100/150 = 0.67
    const s = computeStats([pnl(100), pnl(100), pnl(100), pnl(-150)], 0);
    expect(s.profitFactor).toBe(2);
    expect(s.payoff).toBe(0.67);
    expect(s.avgWin).toBe(100);
    expect(s.avgLoss).toBe(150);
    expect(s.winRate).toBe(0.75);
    expect(s.expectancy).toBe(37.5);
    expect(s.net).toBe(150);
  });

  it('PF null with no losses; breakevens excluded from win rate', () => {
    const s = computeStats([pnl(50), pnl(0), pnl(3)], 5);
    expect(s.profitFactor).toBeNull();
    expect(s.wins).toBe(1);
    expect(s.flats).toBe(2);
    expect(s.winRate).toBe(1);
    expect(s.avgLoss).toBeNull();
    expect(s.payoff).toBeNull();
  });

  it('gross, fees and net with multipliers', () => {
    const s = computeStats(
      [
        mk({ qty: 2, entry: 21034.25, exit: 21040.75, multiplier: 2, fees: 2.48 }),
        mk({ side: 'short', entry: 6080.5, exit: 6082.75, multiplier: 50, fees: 4.28 }),
      ],
      0,
    );
    expect(s.gross).toBe(-86.5);
    expect(s.fees).toBe(6.76);
    expect(s.net).toBe(-93.26);
  });

  it('max drawdown is peak-to-trough of cumulative net in date+time order', () => {
    // given out of order on purpose; chronological cum: 100, 300, 150, 50, 250, 0 → peak 300, trough 0 → 300
    const trades = [
      pnl(-250, '2025-12-05', '10:00'),
      pnl(100, '2025-12-01', '09:30'),
      pnl(-150, '2025-12-02', '09:00'),
      pnl(200, '2025-12-01', '10:00'),
      pnl(-100, '2025-12-02', '11:00'),
      pnl(200, '2025-12-04', '09:00'),
    ];
    expect(computeStats(trades, 0).maxDrawdown).toBe(300);
  });

  it('drawdown counts from 0 when the first trades lose', () => {
    expect(computeStats([pnl(-40, '2025-12-01'), pnl(-60, '2025-12-02'), pnl(30, '2025-12-03')], 0).maxDrawdown).toBe(100);
  });

  it('streaks: breakevens neither extend nor break', () => {
    const s = computeStats(
      [
        pnl(10, '2025-12-01', '09:00'),
        pnl(10, '2025-12-01', '09:10'),
        pnl(0, '2025-12-01', '09:20'),
        pnl(10, '2025-12-01', '09:30'),
        pnl(-10, '2025-12-01', '09:40'),
        pnl(-10, '2025-12-02', '09:00'),
      ],
      0,
    );
    expect(s.longestWinStreak).toBe(3);
    expect(s.longestLossStreak).toBe(2);
    expect(s.currentStreak).toEqual({ kind: 'loss', length: 2 });
  });

  it('day win rate, best/worst day, trading days', () => {
    const s = computeStats(
      [
        pnl(100, '2025-12-01'), pnl(-30, '2025-12-01'), // +70
        pnl(-80, '2025-12-02'), // −80
        pnl(2, '2025-12-03'), // flat day with band 5
        pnl(40, '2025-12-04'),
      ],
      5,
    );
    expect(s.tradingDays).toBe(4);
    expect(s.dayWinRate).toBeCloseTo(2 / 3);
    expect(s.bestDay).toEqual({ date: '2025-12-01', net: 70 });
    expect(s.worstDay).toEqual({ date: '2025-12-02', net: -80 });
  });

  it('avgR over trades with stops only', () => {
    const s = computeStats([mk({ entry: 100, exit: 104, stop: 98 }), mk({ entry: 100, exit: 99, stop: 98 }), pnl(50)], 0);
    expect(s.avgR).toBe(0.75);
  });
});

describe('dailySeries / groupByDay / sortTrades', () => {
  const trades = [
    pnl(10, '2025-12-02', '10:00', { id: 'b2' }),
    pnl(-5, '2025-12-01', '09:30', { id: 'a1' }),
    pnl(20, '2025-12-02', '09:00', { id: 'b1' }),
    pnl(7, '2025-12-01', '15:00', { id: 'a2' }),
  ];
  it('dailySeries ascending with cum', () => {
    const d = dailySeries(trades);
    expect(d.map((x) => [x.date, x.net, x.cum, x.count])).toEqual([
      ['2025-12-01', 2, 2, 2],
      ['2025-12-02', 30, 32, 2],
    ]);
    expect(d[1]!.trades.map((t) => t.id)).toEqual(['b1', 'b2']);
  });
  it('groupByDay newest day first, trades time-ascending', () => {
    const g = groupByDay(trades);
    expect([...g.keys()]).toEqual(['2025-12-02', '2025-12-01']);
    expect(g.get('2025-12-01')!.map((t) => t.id)).toEqual(['a1', 'a2']);
  });
  it('sortTrades newest first', () => {
    expect(sortTrades(trades).map((t) => t.id)).toEqual(['b2', 'b1', 'a2', 'a1']);
  });
});

describe('breakdown', () => {
  const trades = [
    pnl(100, '2025-12-01', '09:35', { setup: 'Breakout', symbol: 'MNQZ5' }), // Mon
    pnl(-50, '2025-12-01', '10:05', { setup: 'Breakout', symbol: 'MNQ 12-25', mistakes: ['FOMO entry', 'Oversized'] }),
    pnl(-30, '2025-12-02', '09:10', { symbol: 'ESZ5', mistakes: ['FOMO entry'] }), // Tue
    pnl(20, '2025-12-02', undefined, { setup: 'Pullback', symbol: 'SPY 500C 12/19', assetType: 'option', option: { underlying: 'SPY', right: 'C', strike: 500, expiry: '2025-12-19' } }),
  ];
  it('by setup, net desc, missing → No setup', () => {
    expect(breakdown(trades, 'setup', 0)).toEqual([
      { key: 'Breakout', label: 'Breakout', count: 2, net: 50, winRate: 0.5 },
      { key: 'Pullback', label: 'Pullback', count: 1, net: 20, winRate: 1 },
      { key: '', label: 'No setup', count: 1, net: -30, winRate: 0 },
    ]);
  });
  it('by symbol uses futures root and option underlying', () => {
    expect(breakdown(trades, 'symbol', 0).map((r) => [r.label, r.count, r.net])).toEqual([
      ['MNQ', 2, 50],
      ['SPY', 1, 20],
      ['ES', 1, -30],
    ]);
  });
  it('by weekday', () => {
    expect(breakdown(trades, 'weekday', 0).map((r) => [r.label, r.net])).toEqual([
      ['Mon', 50],
      ['Tue', -10],
    ]);
  });
  it('by hour', () => {
    expect(breakdown(trades, 'hour', 0).map((r) => [r.key, r.label, r.net])).toEqual([
      ['09', '9:00', 70],
      ['', 'No time', 20],
      ['10', '10:00', -50],
    ]);
  });
  it('by mistake: once per mistake, untagged trades excluded', () => {
    expect(breakdown(trades, 'mistake', 0)).toEqual([
      { key: 'Oversized', label: 'Oversized', count: 1, net: -50, winRate: 0 },
      { key: 'FOMO entry', label: 'FOMO entry', count: 2, net: -80, winRate: 0 },
    ]);
  });
});
