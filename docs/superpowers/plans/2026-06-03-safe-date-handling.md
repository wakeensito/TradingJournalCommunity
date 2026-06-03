# Safe Date Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every date operation on user/import-supplied trade & journal data crash-proof by routing it through a single safe-date utility, and stop the CSV/journal importer from ever persisting unparseable date strings.

**Architecture:** Introduce one pure module `src/lib/date.ts` that wraps `new Date(...)` and never throws — it returns `null`/a fallback for invalid input. All components and services that format, sort, or key by a stored `date` string use these helpers instead of calling `new Date(...).toISOString()`/`.getTime()`/`.toLocaleDateString()` directly. The importer (`TradeEntry.parseTimestamp`) is hardened to normalize to ISO `YYYY-MM-DD` or fall back to today, so bad data never reaches Firestore. Because the util is a pure function, we add `vitest` (the natural test runner for a Vite project) to TDD it.

**Tech Stack:** React 18 + TypeScript, Vite (SWC), Firebase, **vitest** (added in Task 1).

---

## Background / Why

`Trade.date` and `JournalEntry.date` are free-form **strings**, populated both from manual entry and from CSV / Discord-journal imports. Several call sites do `new Date(stored).toISOString()`; when `stored` is unparseable (`"Mar"`, `""`, `"13/45/2024"`), `new Date(...)` yields an **Invalid Date** and `.toISOString()` throws `RangeError: Invalid time value`. Inside a `useMemo`, this crashes the entire render. `Dashboard.tsx` `monthlyPerformance` was already patched with an inline guard; this plan generalizes the fix and removes the duplication.

**Throw-capable sites (must fix):**
- `src/components/Dashboard.tsx:279` — `parsed.toISOString()` (already guarded inline; migrate to util)
- `src/components/TradeEntry.tsx:541` — `new Date(Number(timestampStr)).toISOString()` inside `parseTimestamp`
- `src/services/tradeStorage.ts:128` — `obj.toISOString()` gated on `instanceof Date`, but an *Invalid* Date is still `instanceof Date` and throws

**Bad-data source (must harden):**
- `src/components/TradeEntry.tsx:547` — fallback `return { date: timestampStr.split(' ')[0] }` emits whatever raw token it got

**Non-throwing but wrong (render `"Invalid Date"` / sort by `NaN`) — migrate for correctness:**
- `src/components/Dashboard.tsx:472,484`, `src/components/TradesList.tsx:283`, `src/components/AccountManager.tsx:560`, journal display formatters in `JournalAnalysis.tsx`, `JournalAnalysisCard.tsx`, `SavedEntries.tsx`, and sort comparators in `Dashboard.tsx:130,175`, `TradesList.tsx:109`, `behavioralAnalysis.ts:367-368,468`, `journalStorage.ts:61-62`, `tradeStorage.ts:65-66`.

Out of scope: `new Date()` with no args (always valid — clocks), `new Date(year, month, day)` numeric constructors in `CalendarView`/`Gameplan` (always valid), and `LandingPage` demo data.

---

## File Structure

- **Create** `src/lib/date.ts` — pure safe-date helpers (no React, no Firebase imports).
- **Create** `src/lib/date.test.ts` — vitest unit tests for the helpers.
- **Create** `vitest.config.ts` — minimal vitest config (or extend `vite.config.ts`).
- **Modify** `package.json` — add `vitest` devDep + `test` script.
- **Modify** the call sites listed above to import from `@/lib/date`.

---

### Task 1: Add vitest and a safe-date module with failing tests

**Files:**
- Modify: `package.json` (scripts + devDependencies)
- Create: `vitest.config.ts`
- Create: `src/lib/date.ts`
- Test: `src/lib/date.test.ts`

- [ ] **Step 1: Install vitest**

Run:
```bash
npm i -D vitest
```
Expected: `vitest` appears under `devDependencies` in `package.json`.

- [ ] **Step 2: Add the `test` script**

In `package.json` `scripts`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Write the failing test**

Create `src/lib/date.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseDate, toMonthKey, formatDate, dateSortValue } from './date';

describe('parseDate', () => {
  it('parses valid ISO date', () => {
    expect(parseDate('2024-03-05')?.getUTCFullYear()).toBe(2024);
  });
  it('returns null for unparseable strings', () => {
    for (const bad of ['Mar', '', '13/45/2024', undefined, null]) {
      expect(parseDate(bad as unknown as string)).toBeNull();
    }
  });
});

describe('toMonthKey', () => {
  it('returns YYYY-MM for valid dates', () => {
    expect(toMonthKey('2024-03-05')).toBe('2024-03');
  });
  it('returns null for invalid dates (never throws)', () => {
    expect(toMonthKey('Mar')).toBeNull();
    expect(toMonthKey('')).toBeNull();
  });
});

describe('formatDate', () => {
  it('formats valid dates', () => {
    expect(formatDate('2024-03-05', { month: 'short', day: 'numeric' })).toContain('Mar');
  });
  it('returns the fallback for invalid dates', () => {
    expect(formatDate('Mar', { month: 'short' })).toBe('—');
    expect(formatDate('nope', { month: 'short' }, 'N/A')).toBe('N/A');
  });
});

describe('dateSortValue', () => {
  it('returns epoch ms for valid dates', () => {
    expect(dateSortValue('2024-03-05')).toBeGreaterThan(0);
  });
  it('returns 0 for invalid dates so sorts stay stable', () => {
    expect(dateSortValue('Mar')).toBe(0);
    expect(dateSortValue(undefined as unknown as string)).toBe(0);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run:
```bash
npm test -- src/lib/date.test.ts
```
Expected: FAIL — `Failed to resolve import "./date"` / functions not defined.

- [ ] **Step 6: Implement `src/lib/date.ts`**

```ts
/**
 * Safe date helpers. Trade/journal `date` fields are free-form strings that
 * may come from CSV or Discord-journal imports and can be unparseable.
 * These wrappers NEVER throw — callers get null/a fallback instead of a
 * RangeError ("Invalid time value").
 */

/** Parse a stored date string. Returns null if it can't be parsed. */
export function parseDate(value: string | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** "YYYY-MM" month key for grouping, or null if the date is invalid. */
export function toMonthKey(value: string | null | undefined): string | null {
  const d = parseDate(value);
  return d ? d.toISOString().substring(0, 7) : null;
}

/** Locale-format a date, returning `fallback` (default "—") if invalid. */
export function formatDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  fallback = '—',
  locale = 'en-US',
): string {
  const d = parseDate(value);
  return d ? d.toLocaleDateString(locale, options) : fallback;
}

/** Epoch ms for sort comparators; invalid dates sort as 0 (oldest). */
export function dateSortValue(value: string | null | undefined): number {
  const d = parseDate(value);
  return d ? d.getTime() : 0;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run:
```bash
npm test -- src/lib/date.test.ts
```
Expected: PASS — all 4 describe blocks green.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/date.ts src/lib/date.test.ts
git commit -m "feat: add safe date utility with vitest coverage"
```

---

### Task 2: Harden the importer so bad dates are never stored

**Files:**
- Modify: `src/components/TradeEntry.tsx:519-548` (`parseTimestamp`)
- Test: `src/lib/date.test.ts` (extend) — extract `parseTimestamp` is internal, so test the util it will rely on

- [ ] **Step 1: Add a normalizing helper test to `src/lib/date.test.ts`**

Append:
```ts
import { toISODateOrToday } from './date';

describe('toISODateOrToday', () => {
  it('keeps a valid YYYY-MM-DD', () => {
    expect(toISODateOrToday('2024-03-05')).toBe('2024-03-05');
  });
  it('normalizes a parseable date to YYYY-MM-DD', () => {
    expect(toISODateOrToday('03/05/2024')).toBe('2024-03-05');
  });
  it('falls back to today (valid ISO) for garbage', () => {
    const out = toISODateOrToday('Mar');
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parseDate(out)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
npm test -- src/lib/date.test.ts
```
Expected: FAIL — `toISODateOrToday` not exported.

- [ ] **Step 3: Implement `toISODateOrToday` in `src/lib/date.ts`**

```ts
/** Normalize any date-ish string to `YYYY-MM-DD`; falls back to today if unparseable. */
export function toISODateOrToday(value: string | null | undefined): string {
  const d = parseDate(value) ?? new Date();
  return d.toISOString().split('T')[0];
}
```

- [ ] **Step 4: Run to verify it passes**

Run:
```bash
npm test -- src/lib/date.test.ts
```
Expected: PASS.

- [ ] **Step 5: Use it in `parseTimestamp` fallback + numeric branch**

In `src/components/TradeEntry.tsx`, add the import near the top with the other imports:
```ts
import { toISODateOrToday } from '@/lib/date';
```

Replace the numeric branch (currently lines 538-543):
```ts
      // Handle numeric timestamp
      if (!isNaN(Number(timestampStr))) {
        const d = new Date(Number(timestampStr));
        if (!isNaN(d.getTime())) {
          return {
            date: d.toISOString().split('T')[0],
            time: d.toTimeString().split(' ')[0],
          };
        }
      }
```

Replace the fallback (currently line 547):
```ts
      // Fallback: normalize to ISO, or today if unparseable
      return { date: toISODateOrToday(timestampStr.split(' ')[0]) };
```

- [ ] **Step 6: Verify the importer in the running app**

Run `npm run dev` (if not running), open http://localhost:3000, import/paste a row with a malformed timestamp (e.g. `"Mar foo, 09:30"`), and confirm the saved trade gets today's date instead of `"Mar"` and no console error appears.

- [ ] **Step 7: Commit**

```bash
git add src/lib/date.ts src/lib/date.test.ts src/components/TradeEntry.tsx
git commit -m "fix: importer normalizes unparseable timestamps instead of storing them"
```

---

### Task 3: Route Dashboard date usage through the util

**Files:**
- Modify: `src/components/Dashboard.tsx:130,175,277-279,472,484`

- [ ] **Step 1: Add the import**

At the top of `src/components/Dashboard.tsx`:
```ts
import { toMonthKey, formatDate, dateSortValue } from '@/lib/date';
```

- [ ] **Step 2: Replace the `monthlyPerformance` guard (lines 277-279)**

```ts
    trades.filter(trade => trade.status === 'closed').forEach(trade => {
      const month = toMonthKey(trade.date);
      if (!month) return; // skip trades with an unparseable date
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + (trade.pnl || 0));
    });
```

- [ ] **Step 3: Replace the sort comparators (lines 130 and 175)**

Line 130:
```ts
      .sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date));
```
Line 175:
```ts
      .sort((a, b) => dateSortValue(a.date) - dateSortValue(b.date));
```

- [ ] **Step 4: Replace the chart tick/label formatters (lines 472 and 484)**

Line 472:
```ts
                    tickFormatter={(value) => formatDate(value, { month: 'short', day: 'numeric' })}
```
Line 484:
```ts
                    labelFormatter={(value) => formatDate(value, { month: 'long', day: 'numeric', year: 'numeric' })}
```

- [ ] **Step 5: Verify in the running app**

Reload http://localhost:3000 with the dev server running; the Dashboard renders with no `RangeError` even if a trade has a bad date. Confirm via the browser console (no errors) and that the monthly/cumulative charts display.

- [ ] **Step 6: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "refactor: Dashboard uses safe date util for keys, sorts, and formatting"
```

---

### Task 4: Fix the serializer Invalid-Date crash in tradeStorage

**Files:**
- Modify: `src/services/tradeStorage.ts:126-129` (`removeUndefined` Date branch) and sort at `65-66`

- [ ] **Step 1: Add the import**

At the top of `src/services/tradeStorage.ts`:
```ts
import { dateSortValue } from '../lib/date';
```

- [ ] **Step 2: Guard the Date serialization (lines 126-129)**

```ts
    // Handle Date objects (guard against Invalid Date, which still throws on toISOString)
    if (obj instanceof Date) {
      return isNaN(obj.getTime()) ? null : obj.toISOString();
    }
```

- [ ] **Step 3: Replace the manual sort (lines 65-66)**

```ts
  loadedTrades.sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date));
```
(Delete the now-unused `dateA`/`dateB` lines.)

- [ ] **Step 4: Verify**

Run:
```bash
npm test
```
Expected: PASS (no regressions). Then with the dev server running, sign in and confirm trades load/save without console errors.

- [ ] **Step 5: Commit**

```bash
git add src/services/tradeStorage.ts
git commit -m "fix: guard Invalid Date in Firestore serializer and use safe sort"
```

---

### Task 5: Migrate remaining display & sort sites

**Files:**
- Modify: `src/components/TradesList.tsx:109,283`
- Modify: `src/components/AccountManager.tsx:560`
- Modify: `src/components/JournalAnalysis.tsx:337,340,588,1113,1153`
- Modify: `src/components/JournalAnalysisCard.tsx:125,128`
- Modify: `src/components/SavedEntries.tsx:117,131`
- Modify: `src/services/behavioralAnalysis.ts:367-368,468`
- Modify: `src/services/journalStorage.ts:61-62`

- [ ] **Step 1: TradesList** — add `import { formatDate, dateSortValue } from '@/lib/date';`

Line 109 sort:
```ts
          return dateSortValue(b.date) - dateSortValue(a.date);
```
Line 283 `formatDate` helper body — replace `new Date(dateString).toLocaleDateString('en-US', {...})` with:
```ts
    return formatDate(dateString, { /* keep the same options object */ });
```

- [ ] **Step 2: AccountManager** — add `import { formatDate } from '@/lib/date';`

Line 560:
```tsx
                      Started {formatDate(account.startDate, {}, 'Unknown')}
```

- [ ] **Step 3: JournalAnalysis** — add `import { formatDate, dateSortValue } from '@/lib/date';`

Replace each `new Date(entry.date).toLocaleDateString('en-US', OPTS)` (lines 340, 588, 1153) with `formatDate(entry.date, OPTS)`, keeping each existing options object. Replace the `new Date(a.date).getTime() - new Date(b.date).getTime()` comparators (lines 337, 1113) with `dateSortValue(a.date) - dateSortValue(b.date)` (preserving direction). For the `new Date(a)`/`new Date(b)` string-key comparators at 315-317 and 1106-1108, use `dateSortValue(a) - dateSortValue(b)`.

- [ ] **Step 4: JournalAnalysisCard** — add `import { formatDate, dateSortValue } from '@/lib/date';`

Line 125 comparator → `dateSortValue(a.date) - dateSortValue(b.date)`.
Line 128 → `date: formatDate(entry.date, { month: 'short', day: 'numeric' })`.

- [ ] **Step 5: SavedEntries** — add `import { formatDate, dateSortValue } from '@/lib/date';`

Line 117 comparator → `dateSortValue(b.date) - dateSortValue(a.date)`.
Line 131 → `formatDate(entry.date, { /* keep options */ })`.

- [ ] **Step 6: behavioralAnalysis** — add `import { dateSortValue, parseDate } from '../lib/date';`

Line 367 filter `new Date(e.date) <= new Date(date)` → `(parseDate(e.date)?.getTime() ?? 0) <= (parseDate(date)?.getTime() ?? 0)`.
Lines 368 and 468 comparators → `dateSortValue(b.date) - dateSortValue(a.date)`.

- [ ] **Step 7: journalStorage** — add `import { dateSortValue } from '../lib/date';`

Lines 61-62 → replace the two `dateA`/`dateB` lines and their comparator with `.sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date))` (it already tolerated missing dates with `? ... : 0`).

- [ ] **Step 8: Verify the whole app builds and renders**

Run:
```bash
npm run build && npm test
```
Expected: build succeeds, all tests pass. Then load each tab (Dashboard, Trades, Accounts, Journal Analysis, Gameplan) in the dev server with at least one trade/entry present and confirm no console errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/TradesList.tsx src/components/AccountManager.tsx src/components/JournalAnalysis.tsx src/components/JournalAnalysisCard.tsx src/components/SavedEntries.tsx src/services/behavioralAnalysis.ts src/services/journalStorage.ts
git commit -m "refactor: route remaining date display/sort sites through safe util"
```

---

## Self-Review Notes

- **Spec coverage:** Every throw-capable site (Dashboard, TradeEntry numeric branch, tradeStorage serializer) is fixed in Tasks 2–4; the bad-data source (parseTimestamp fallback) in Task 2; non-throwing-but-wrong sites in Tasks 3 & 5. `journalParser.extractDate` already falls back to today — intentionally left as-is.
- **Type consistency:** Helper names are stable across tasks — `parseDate`, `toMonthKey`, `formatDate`, `dateSortValue`, `toISODateOrToday`. All take `string | null | undefined` and never throw.
- **Out of scope (intentional):** zero-arg `new Date()`, numeric `new Date(y, m, d)` constructors in CalendarView/Gameplan, and LandingPage demo data — none operate on untrusted strings.
