// Quick-log date defaults that don't trap late-night logging.
// Pure (the clock is passed in) so the rules are unit-tested in __tests__/logDate.test.ts.

import { addDays, toDateStr } from './dates';

const pad2 = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** Before this local hour, a trader with nothing logged today is probably still logging last night's session. */
export const LATE_NIGHT_UNTIL_HOUR = 5;

/**
 * The default quick-log date. Between 00:00 and 05:00 local, with no trades today yet but trades yesterday,
 * it's yesterday (`yesterday: true`, so the UI shows a "Yesterday" chip that switches back to today).
 */
export function defaultLogDate(now: Date, tradeDates: Iterable<string>): { date: string; yesterday: boolean } {
  const today = toDateStr(now);
  if (now.getHours() >= LATE_NIGHT_UNTIL_HOUR) return { date: today, yesterday: false };
  const yesterday = addDays(today, -1);
  let hasToday = false;
  let hasYesterday = false;
  for (const d of tradeDates) {
    if (d === today) hasToday = true;
    else if (d === yesterday) hasYesterday = true;
  }
  return !hasToday && hasYesterday ? { date: yesterday, yesterday: true } : { date: today, yesterday: false };
}

/**
 * A time that hasn't happened yet today is impossible: the trade must have been yesterday.
 * Returns yesterday's date when `date` is today and `time` ('HH:MM') is later than now, else null.
 */
export function impossibleTimeFix(date: string, time: string, now: Date): string | null {
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const today = toDateStr(now);
  if (date !== today || time <= hhmm(now)) return null;
  return addDays(today, -1);
}

export const FUTURE_TIME_HINT = 'Set to yesterday — that time hasn’t happened yet today';
