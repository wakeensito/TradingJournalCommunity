// Local-day date helpers. Dates are 'YYYY-MM-DD' strings in the trader's local day; times are 'HH:MM'.
// Everything is built from parts with the local Date constructor — never `new Date('YYYY-MM-DD')` (that is UTC).

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Format a Date's local calendar day as 'YYYY-MM-DD'. */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Parse a strict 'YYYY-MM-DD' into a local-midnight Date (throws on bad input). */
export function fromDateStr(date: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Invalid date: ${date}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function isValidYmd(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return false;
  const dim = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this month
  return d <= dim;
}

export function todayLocal(): string {
  return toDateStr(new Date());
}

export function nowTimeLocal(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function ymd(y: number, m: number, d: number): string | null {
  return isValidYmd(y, m, d) ? `${y}-${pad2(m)}-${pad2(d)}` : null;
}

function expandYear(y: string): number {
  const n = Number(y);
  return y.length === 2 ? 2000 + n : n;
}

// An explicit UTC instant: ISO timestamp with 'Z' or a numeric offset.
const ISO_INSTANT_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})$/i;

function instantToLocal(s: string): Date | null {
  const m = ISO_INSTANT_RE.exec(s.trim());
  if (!m) return null;
  // Validate the wall-clock parts before handing to Date (which silently rolls over bad days).
  if (!isValidYmd(Number(m[1]), Number(m[2]), Number(m[3]))) return null;
  if (Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6] ?? 0) > 59) return null;
  const d = new Date(s.trim().replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Loose date parser for broker exports. Returns 'YYYY-MM-DD' or null.
 * Accepts 'YYYY-MM-DD', 'YYYY/MM/DD', 'MM/DD/YYYY', 'M/D/YY', any of these followed by a time,
 * and ISO instants with 'Z'/offset (converted to the local day).
 */
export function parseLooseDate(s: string): string | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (!t) return null;
  const inst = instantToLocal(t);
  if (inst) return toDateStr(inst);
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[T\s])/.exec(t);
  if (m) return ymd(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})(?:$|[T\s,])/.exec(t);
  if (m) return ymd(expandYear(m[3]!), Number(m[1]), Number(m[2]));
  return null;
}

/**
 * Loose time parser. Returns 'HH:MM' (24h) or null. Finds the time inside full timestamps too:
 * '09:41:22', '9:41 AM', '12/03/2025 09:41:22 PM', '2025-12-03T14:41:22Z' (converted to local time).
 */
export function parseLooseTime(s: string): string | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (!t) return null;
  const inst = instantToLocal(t);
  if (inst) return `${pad2(inst.getHours())}:${pad2(inst.getMinutes())}`;
  const m = /(?:^|[T\s])(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*([AaPp]\.?[Mm]\.?)?(?=$|[\s,+-]|[A-Za-z])/.exec(t);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || Number(m[3] ?? 0) > 59) return null;
  const ampm = m[4]?.replace(/\./g, '').toUpperCase();
  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (ampm === 'AM') h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
  } else if (h > 23) return null;
  return `${pad2(h)}:${pad2(min)}`;
}

/** Seconds-resolution sortable time 'HH:MM:SS' (or '' when absent) — used to order fills within a day. */
export function parseLooseTimeSeconds(s: string): string {
  if (typeof s !== 'string') return '';
  const t = s.trim();
  const inst = instantToLocal(t);
  if (inst) return `${pad2(inst.getHours())}:${pad2(inst.getMinutes())}:${pad2(inst.getSeconds())}`;
  const hm = parseLooseTime(t);
  if (!hm) return '';
  const sec = /(?:^|[T\s])\d{1,2}:\d{2}:(\d{2})/.exec(t);
  return `${hm}:${sec?.[1] ?? '00'}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function weekdayShort(date: string): string {
  return WEEKDAYS[fromDateStr(date).getDay()] ?? '';
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndexMon(date: string): number {
  return (fromDateStr(date).getDay() + 6) % 7;
}

export function addDays(date: string, n: number): string {
  const d = fromDateStr(date);
  return toDateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: string): string {
  return addDays(date, -weekdayIndexMon(date));
}

/** 6 rows × 7 days (Mon→Sun) covering the month, including leading/trailing days of adjacent months. */
export function monthMatrix(year: number, month0: number): string[][] {
  const first = toDateStr(new Date(year, month0, 1));
  let cur = startOfWeek(first);
  const rows: string[][] = [];
  for (let r = 0; r < 6; r++) {
    const row: string[] = [];
    for (let c = 0; c < 7; c++) {
      row.push(cur);
      cur = addDays(cur, 1);
    }
    rows.push(row);
  }
  return rows;
}

export function isSameMonth(date: string, year: number, month0: number): boolean {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
  if (!m) return false;
  // Normalize month overflow (e.g. month0 = 12) the same way Date does.
  const ref = new Date(year, month0, 1);
  return Number(m[1]) === ref.getFullYear() && Number(m[2]) - 1 === ref.getMonth();
}
