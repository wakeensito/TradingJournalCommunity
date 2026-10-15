import { describe, expect, it, beforeEach } from 'vitest';
import {
  type Bar,
  barIndexAt,
  barsRequestForTrade,
  daysAgo,
  etDate,
  etTime,
  eventsForPlan,
  formatChangePct,
  localEpoch,
  marketBarsPath,
  niceTicks,
  parseMarketBars,
  parseMarketDay,
  timeTickStep,
  tradeMarks,
  visibleRange,
} from '../market';
import { _clearMarketCache, barsTooOld, fetchMarketDay } from '../useMarket';

const DAY = {
  date: '2026-10-13',
  indices: { ES: { close: 6738.18, changePct: 0.42 }, NQ: { close: 24725, changePct: -1.1 } },
  vix: { close: 18.2, change: 1.2 },
  events: [
    { time: '10:00', title: 'ISM Services PMI', impact: 'medium' },
    { time: '08:30', title: 'CPI m/m', impact: 'high', forecast: '0.3%', previous: '0.4%' },
    { time: '08:30', title: 'CPI m/m', impact: 'high' },
    { time: 'soon', title: 'Bad', impact: 'high' },
  ],
  sources: { indices: 'yahoo', vix: 'yahoo', events: 'forexfactory' },
};

describe('eventsForPlan', () => {
  it('formats a short plan line, sorted, deduped, leading zero dropped', () => {
    const d = parseMarketDay(DAY)!;
    expect(eventsForPlan(d.events)).toBe('8:30 CPI m/m (high) · 10:00 ISM Services PMI (med)');
  });
  it('is empty with no events and caps long days', () => {
    expect(eventsForPlan([])).toBe('');
    const many = Array.from({ length: 8 }, (_, i) => ({ time: `1${i}:00`, title: `E${i}`, impact: 'medium' as const }));
    expect(eventsForPlan(many, 3)).toBe('10:00 E0 (med) · 11:00 E1 (med) · 12:00 E2 (med) · +5 more');
  });
});

describe('parsers', () => {
  it('parses a day and drops malformed events', () => {
    const d = parseMarketDay(DAY)!;
    expect(d.events).toHaveLength(3);
    expect(d.indices.ES).toEqual({ close: 6738.18, changePct: 0.42 });
    expect(parseMarketDay({ ...DAY, indices: { ES: null, NQ: { close: 'x' } }, vix: null })!.indices).toEqual({
      ES: null,
      NQ: null,
    });
    expect(parseMarketDay('nope')).toBeNull();
  });
  it('parses bars, sorts them, repairs h/l', () => {
    const b = parseMarketBars({
      symbol: 'MNQ=F',
      interval: '1m',
      tz: 'America/New_York',
      bars: [
        { t: 120, o: 2, h: 1, l: 3, c: 2.5, v: 1 },
        { t: 60, o: 1, h: 2, l: 0.5, c: 1.5, v: 1 },
        { t: 'x' },
      ],
    })!;
    expect(b.bars.map((x) => x.t)).toEqual([60, 120]);
    expect(b.bars[1]).toMatchObject({ h: 2.5, l: 2 });
    expect(parseMarketBars({ symbol: 'X', interval: '15m', bars: [] })).toBeNull();
  });
});

describe('formatting', () => {
  it('signs percent changes with a real minus', () => {
    expect(formatChangePct(0.42)).toBe('+0.42%');
    expect(formatChangePct(-1.1)).toBe('−1.10%');
    expect(formatChangePct(0.001)).toBe('0.00%');
    expect(formatChangePct(null)).toBe('—');
  });
  it('formats epoch seconds on the New York clock (EDT and EST)', () => {
    expect(etTime(Date.UTC(2026, 9, 13, 12, 30) / 1000)).toBe('08:30'); // EDT, UTC−4
    expect(etTime(Date.UTC(2026, 10, 2, 13, 30) / 1000)).toBe('08:30'); // EST, UTC−5
    expect(etTime(Date.UTC(2026, 9, 14, 3, 59) / 1000)).toBe('23:59');
  });
});

describe('requests', () => {
  it('builds bars requests: options chart the underlying', () => {
    const opt = barsRequestForTrade({
      symbol: 'SPY 500C 12/19',
      date: '2026-10-12',
      assetType: 'option',
      option: { underlying: 'SPY', right: 'C', strike: 500, expiry: '2026-12-19' },
    });
    expect(marketBarsPath(opt)).toBe('/market/bars?symbol=SPY+500C+12%2F19&date=2026-10-12&assetType=option&underlying=SPY');
    expect(barsRequestForTrade({ symbol: 'MNQZ5', date: '2026-10-12', assetType: 'futures' })).not.toHaveProperty(
      'underlying',
    );
  });
  it('knows the 60-day limit', () => {
    expect(daysAgo('2026-08-14', '2026-10-13')).toBe(60);
    expect(barsTooOld('2026-08-14', '2026-10-13')).toBe(true);
    expect(barsTooOld('2026-08-15', '2026-10-13')).toBe(false);
    expect(barsTooOld('garbage', '2026-10-13')).toBe(true);
  });
});

describe('chart maths', () => {
  const start = localEpoch('2026-10-12', '09:00')!;
  const bars: Bar[] = Array.from({ length: 240 }, (_, i) => ({ t: start + i * 60, o: 1, h: 2, l: 0, c: 1, v: 0 }));

  it('finds the bar containing an instant', () => {
    expect(barIndexAt(bars, start + 61, 60)).toBe(1);
    expect(barIndexAt(bars, start - 1, 60)).toBeNull();
    expect(barIndexAt(bars, start + 240 * 60, 60)).toBeNull();
  });
  it('handles exits after midnight', () => {
    const m = tradeMarks({ date: '2026-10-12', time: '23:50', exitTime: '00:10' });
    expect(m.exitT! - m.entryT!).toBe(20 * 60);
  });
  it('zooms to the trade window with padding', () => {
    const marks = tradeMarks({ date: '2026-10-12', time: '10:00', exitTime: '10:10' });
    const [i0, i1] = visibleRange(bars, marks, 60);
    expect(i0).toBe(40); // 60 bars after 9:00, minus 20-bar pad
    expect(i1).toBe(91); // 10:10 + 20 bars, exclusive
  });
  it('clamps to the day and keeps a minimum width', () => {
    const late = visibleRange(bars, tradeMarks({ date: '2026-10-12', time: '15:00' }), 60);
    expect(late[1]).toBe(240);
    expect(late[1] - late[0]).toBeGreaterThanOrEqual(10);
  });
  it('nice ticks and time steps', () => {
    expect(niceTicks(21003.1, 21011.9, 4)).toEqual([21005, 21007.5, 21010]);
    expect(niceTicks(1.07121, 1.07189, 3)).toEqual([1.07125, 1.0715, 1.07175]);
    expect(timeTickStep(60 * 60, 320)).toBe(15 * 60);
    expect(timeTickStep(16 * 3600, 320)).toBe(240 * 60);
  });
});

describe('fetchMarketDay', () => {
  beforeEach(() => _clearMarketCache());
  it('shares one request and caches past days', async () => {
    let calls = 0;
    const get = async (p: string) => {
      calls++;
      expect(p).toBe('/market/day/2026-10-01');
      return { ...DAY, date: '2026-10-01' };
    };
    const [a, b] = await Promise.all([fetchMarketDay(get, '2026-10-01'), fetchMarketDay(get, '2026-10-01')]);
    expect(a?.date).toBe('2026-10-01');
    expect(b).toEqual(a);
    await fetchMarketDay(get, '2026-10-01');
    expect(calls).toBe(1);
  });
  it('resolves null on failure (never throws into the plan button)', async () => {
    const get = async () => {
      throw Object.assign(new Error('nope'), { status: 502 });
    };
    expect(await fetchMarketDay(get, '2026-10-02')).toBeNull();
  });
});

describe('pending bars (Yahoo lags 5–15 min)', () => {
  it('parses pending, clamps retryAfterSec, and the market-closed reason', () => {
    const base = { symbol: 'MNQ=F', interval: '1m', tz: 'America/New_York', bars: [] };
    expect(parseMarketBars({ ...base, pending: true, retryAfterSec: 120 })).toMatchObject({ pending: true, retryAfterSec: 120 });
    expect(parseMarketBars({ ...base, pending: true })!.retryAfterSec).toBe(120);
    expect(parseMarketBars({ ...base, pending: true, retryAfterSec: 99999 })!.retryAfterSec).toBe(600);
    expect(parseMarketBars({ ...base, reason: 'market-closed' })).toMatchObject({ reason: 'market-closed' });
    expect(parseMarketBars(base)).not.toHaveProperty('pending');
  });
  it('sends the trade window as ET HH:MM so the server can tell bars are behind', () => {
    // localEpoch uses the runner's clock; derive the expected ET labels the same way the code does.
    const req = barsRequestForTrade({ symbol: 'MNQZ5', date: '2026-10-13', assetType: 'futures', time: '10:00', exitTime: '10:20' });
    const e = localEpoch('2026-10-13', '10:00')!;
    const x = localEpoch('2026-10-13', '10:20')!;
    if (etDate(e) === '2026-10-13') expect(req.from).toBe(etTime(e));
    if (etDate(x) === '2026-10-13') expect(req.to).toBe(etTime(x));
    expect(etDate(Date.UTC(2026, 9, 15, 3, 59) / 1000)).toBe('2026-10-14'); // 23:59 EDT
    expect(barsRequestForTrade({ symbol: 'MNQZ5', date: '2026-10-13', assetType: 'futures' })).not.toHaveProperty('to');
    expect(marketBarsPath({ symbol: 'MNQZ5', date: '2026-10-15', assetType: 'futures', from: '00:10', to: '00:10' })).toBe(
      '/market/bars?symbol=MNQZ5&date=2026-10-15&assetType=futures&from=00%3A10&to=00%3A10',
    );
  });
});
