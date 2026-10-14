import { describe, expect, it } from 'vitest';
import { matchFifo, type Fill } from '../import/fifo';

const f = (side: 'buy' | 'sell', qty: number, price: number, time: string, extra: Partial<Fill> = {}): Fill => ({
  symbol: 'MNQZ5', date: '2025-12-04', time, side, qty, price, assetType: 'futures', ...extra,
});

describe('matchFifo', () => {
  it('simple long round trip', () => {
    const r = matchFifo([f('buy', 1, 100, '09:30:00'), f('sell', 1, 105, '09:31:00')]);
    expect(r.openPositions).toBe(0);
    expect(r.trades).toEqual([
      { date: '2025-12-04', time: '09:30', exitTime: '09:31', symbol: 'MNQZ5', assetType: 'futures', side: 'long', qty: 1, entry: 100, exit: 105, fees: 0 },
    ]);
  });

  it('short (sell first)', () => {
    const r = matchFifo([f('sell', 2, 105, '09:30:00'), f('buy', 2, 101, '09:45:00')]);
    expect(r.trades[0]).toMatchObject({ side: 'short', qty: 2, entry: 105, exit: 101 });
  });

  it('scale in, partial closes → one round trip with weighted averages and summed fees', () => {
    const r = matchFifo([
      f('buy', 2, 100, '09:30:00', { fees: 1 }),
      f('buy', 1, 103, '09:31:00', { fees: 0.5 }),
      f('sell', 1, 110, '09:35:00', { fees: 0.5 }),
      f('sell', 2, 112.5, '09:40:00', { fees: 1 }),
    ]);
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0]).toMatchObject({ side: 'long', qty: 3, entry: 101, exit: 111.666667, fees: 3, time: '09:30', exitTime: '09:40' });
  });

  it('flip: a fill through zero closes and opens the opposite side; fees split pro rata', () => {
    const r = matchFifo([f('sell', 1, 120, '10:05:00'), f('buy', 3, 115, '10:07:30', { fees: 3 }), f('sell', 2, 118, '10:12:00')]);
    expect(r.trades).toEqual([
      expect.objectContaining({ side: 'short', qty: 1, entry: 120, exit: 115, fees: 1, time: '10:05', exitTime: '10:07' }),
      expect.objectContaining({ side: 'long', qty: 2, entry: 115, exit: 118, fees: 2, time: '10:07', exitTime: '10:12' }),
    ]);
    expect(r.openPositions).toBe(0);
  });

  it('sorts by date/time, keeps symbols separate, reports open positions', () => {
    const r = matchFifo([
      f('sell', 1, 50, '10:00:00', { symbol: 'AAPL', assetType: 'stock' }),
      f('buy', 1, 48, '09:00:00', { symbol: 'AAPL', assetType: 'stock' }),
      f('buy', 1, 100, '09:30:00'),
      f('buy', 5, 10, '09:30:00', { symbol: 'TSLA', assetType: 'stock' }),
      f('sell', 3, 11, '09:40:00', { symbol: 'TSLA', assetType: 'stock' }),
    ]);
    expect(r.trades).toEqual([expect.objectContaining({ symbol: 'AAPL', side: 'long', entry: 48, exit: 50 })]);
    expect(r.openPositions).toBe(2);
  });

  it('empty times keep input order', () => {
    const r = matchFifo([f('buy', 1, 1, ''), f('sell', 1, 2, ''), f('sell', 1, 3, ''), f('buy', 1, 2.5, '')]);
    expect(r.trades.map((t) => [t.side, t.entry, t.exit])).toEqual([['long', 1, 2], ['short', 3, 2.5]]);
    expect(r.trades[0]!.time).toBeUndefined();
  });

  it('round trip across days uses the entry date', () => {
    const r = matchFifo([f('buy', 1, 1, '15:59:00', { date: '2025-12-03' }), f('sell', 1, 2, '09:30:00', { date: '2025-12-04' })]);
    expect(r.trades[0]!.date).toBe('2025-12-03');
  });
});
