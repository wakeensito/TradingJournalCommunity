import { describe, expect, it } from 'vitest';
import { defaultLogDate, impossibleTimeFix } from '../logDate';

// Local wall-clock instants (the rules are about the trader's own clock).
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);

describe('defaultLogDate', () => {
  it('is today during the day, whatever was logged', () => {
    expect(defaultLogDate(at(2026, 10, 15, 9, 30), ['2026-10-14'])).toEqual({ date: '2026-10-15', yesterday: false });
    expect(defaultLogDate(at(2026, 10, 15, 5, 0), ['2026-10-14'])).toEqual({ date: '2026-10-15', yesterday: false });
  });
  it('is yesterday after midnight when only yesterday has trades', () => {
    expect(defaultLogDate(at(2026, 10, 15, 0, 12), ['2026-10-13', '2026-10-14'])).toEqual({ date: '2026-10-14', yesterday: true });
    expect(defaultLogDate(at(2026, 10, 15, 4, 59), ['2026-10-14'])).toEqual({ date: '2026-10-14', yesterday: true });
  });
  it('stays today once something is logged today, or when yesterday was empty', () => {
    expect(defaultLogDate(at(2026, 10, 15, 0, 12), ['2026-10-14', '2026-10-15'])).toEqual({ date: '2026-10-15', yesterday: false });
    expect(defaultLogDate(at(2026, 10, 15, 0, 12), ['2026-10-10'])).toEqual({ date: '2026-10-15', yesterday: false });
    expect(defaultLogDate(at(2026, 10, 15, 0, 12), [])).toEqual({ date: '2026-10-15', yesterday: false });
  });
  it('crosses month and year boundaries', () => {
    expect(defaultLogDate(at(2027, 1, 1, 1, 0), ['2026-12-31']).date).toBe('2026-12-31');
  });
});

describe('impossibleTimeFix', () => {
  const now = at(2026, 10, 15, 0, 12);
  it('moves a not-yet-happened time today to yesterday', () => {
    expect(impossibleTimeFix('2026-10-15', '23:50', now)).toBe('2026-10-14');
    expect(impossibleTimeFix('2026-10-15', '00:13', now)).toBe('2026-10-14');
  });
  it('leaves past/now times, other dates and blank times alone', () => {
    expect(impossibleTimeFix('2026-10-15', '00:12', now)).toBeNull();
    expect(impossibleTimeFix('2026-10-15', '00:10', now)).toBeNull();
    expect(impossibleTimeFix('2026-10-14', '23:50', now)).toBeNull();
    expect(impossibleTimeFix('2026-10-15', '', now)).toBeNull();
  });
  it('wraps to Dec 31 on New Year’s night', () => {
    expect(impossibleTimeFix('2027-01-01', '23:00', at(2027, 1, 1, 0, 30))).toBe('2026-12-31');
  });
});
