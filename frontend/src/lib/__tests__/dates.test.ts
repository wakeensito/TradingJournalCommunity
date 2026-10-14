import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addDays, isSameMonth, monthMatrix, nowTimeLocal, parseLooseDate, parseLooseTime, startOfWeek, todayLocal, weekdayShort,
} from '../dates';

// Run under a US timezone west of UTC so naive `new Date('YYYY-MM-DD')` (UTC) would land on the previous day.
const prevTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'America/Los_Angeles';
});
afterAll(() => {
  process.env.TZ = prevTz;
});

describe('parseLooseDate', () => {
  it.each([
    ['2025-12-03', '2025-12-03'],
    ['12/03/2025', '2025-12-03'],
    ['12/3/2025', '2025-12-03'],
    ['1/5/26', '2026-01-05'],
    ['12/03/2025 09:41:22', '2025-12-03'],
    ['12/03/2025 09:41:22 PM', '2025-12-03'],
    ['12/3/2025 9:41:22 AM', '2025-12-03'],
    ['2025-12-03 09:41:22', '2025-12-03'],
    ['2025-12-03T09:41:22', '2025-12-03'],
    ['2025/12/03', '2025-12-03'],
    ['  2025-01-01  ', '2025-01-01'],
    ['2024-02-29', '2024-02-29'],
  ])('%s → %s', (s, d) => expect(parseLooseDate(s)).toBe(d));

  it.each(['', 'abc', '13/01/2025', '2025-02-30', '2025-13-01', '02/29/2025', '0/1/2025', '12/03'])('rejects %j', (s) =>
    expect(parseLooseDate(s)).toBeNull(),
  );

  it('ISO instants convert to the local day (no naive UTC slicing)', () => {
    // 03:30Z on Dec 4 is 19:30 on Dec 3 in Los Angeles
    expect(parseLooseDate('2025-12-04T03:30:00Z')).toBe('2025-12-03');
    expect(parseLooseTime('2025-12-04T03:30:00Z')).toBe('19:30');
    expect(parseLooseDate('2025-12-04T03:30:00.000+00:00')).toBe('2025-12-03');
    expect(parseLooseDate('2025-12-03T14:41:22-05:00')).toBe('2025-12-03');
    expect(parseLooseTime('2025-12-03T14:41:22-05:00')).toBe('11:41');
  });

  it('plain dates never shift a day', () => {
    expect(parseLooseDate('2025-01-01')).toBe('2025-01-01');
    expect(weekdayShort('2025-12-01')).toBe('Mon');
  });
});

describe('parseLooseTime', () => {
  it.each([
    ['09:41', '09:41'],
    ['9:41', '09:41'],
    ['09:41:22', '09:41'],
    ['9:41 AM', '09:41'],
    ['12:05 AM', '00:05'],
    ['12:05 PM', '12:05'],
    ['1:05:10 PM', '13:05'],
    ['11:59:59 p.m.', '23:59'],
    ['12/03/2025 09:41:22', '09:41'],
    ['12/3/2025 1:05:10 PM', '13:05'],
    ['2025-12-03 09:41:22', '09:41'],
    ['2025-12-03T16:00', '16:00'],
    ['12/03/2025 09:35:02 EST', '09:35'],
  ])('%s → %s', (s, t) => expect(parseLooseTime(s)).toBe(t));

  it.each(['', '25:00', '9:61', '13:00 PM', '2025-12-03', 'noon'])('rejects %j', (s) => expect(parseLooseTime(s)).toBeNull());
});

describe('calendar helpers', () => {
  it('todayLocal / nowTimeLocal shapes', () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(nowTimeLocal()).toMatch(/^\d{2}:\d{2}$/);
  });
  it('weekdayShort', () => {
    expect(['2025-12-01', '2025-12-02', '2025-12-06', '2025-12-07'].map(weekdayShort)).toEqual(['Mon', 'Tue', 'Sat', 'Sun']);
  });
  it('addDays across month/year and DST', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2025-03-01', -1)).toBe('2025-02-28');
    expect(addDays('2025-03-08', 1)).toBe('2025-03-09'); // DST starts Mar 9 in the US
    expect(addDays('2025-03-09', 1)).toBe('2025-03-10');
    expect(addDays('2025-11-02', 1)).toBe('2025-11-03');
  });
  it('startOfWeek is Monday', () => {
    expect(startOfWeek('2025-12-03')).toBe('2025-12-01');
    expect(startOfWeek('2025-12-07')).toBe('2025-12-01');
    expect(startOfWeek('2025-12-01')).toBe('2025-12-01');
    expect(startOfWeek('2026-01-01')).toBe('2025-12-29');
  });
  it('monthMatrix is 6×7 Monday-first incl. adjacent months', () => {
    const m = monthMatrix(2025, 11); // December 2025 starts on a Monday
    expect(m).toHaveLength(6);
    m.forEach((r) => expect(r).toHaveLength(7));
    expect(m[0]![0]).toBe('2025-12-01');
    expect(m[4]![2]).toBe('2025-12-31');
    expect(m[5]![6]).toBe('2026-01-11');
    const feb = monthMatrix(2026, 1); // Feb 2026 starts Sunday
    expect(feb[0]![0]).toBe('2026-01-26');
    expect(feb[0]![6]).toBe('2026-02-01');
    expect(weekdayShort(feb[3]![0]!)).toBe('Mon');
  });
  it('isSameMonth', () => {
    expect(isSameMonth('2025-12-31', 2025, 11)).toBe(true);
    expect(isSameMonth('2026-01-01', 2025, 11)).toBe(false);
    expect(isSameMonth('2026-01-01', 2025, 12)).toBe(true); // month overflow normalizes
  });
});
