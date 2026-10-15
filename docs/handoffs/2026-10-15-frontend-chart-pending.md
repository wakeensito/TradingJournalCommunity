# Chart "pending" state for fresh trades + late-night quick-log date

- **Date:** 2026-10-15
- **Author:** @wakeensito (with Claude Code)
- **Team:** frontend (also touches the market Lambda)
- **Status:** done (PR open, not merged)
- **PR / issue:** see the PR for branch `fix/chart-pending-and-late-night-log`
- **Follows:** [2026-10-14-frontend-tagged-mistakes-label](2026-10-14-frontend-tagged-mistakes-label.md)

## What changed

- **Bug:** a trade logged at 00:12 ET (MNQ, 00:10) showed "Chart unavailable for this trade" for good. Yahoo's intraday bars
  lag 5–15 min, so the market Lambda returned 404 for the new day, and the browser cached that failure until a reload.
- `GET /api/market/bars` takes optional `from`/`to` (the trade window as ET `HH:MM`). On a *recent* day (today, or until
  00:30 ET the next day), no bars yet or bars ending before `to` now return **200 `pending: true, retryAfterSec: 120`**. A settled
  day with no bars (weekend/holiday) returns **200 `reason: "market-closed"`** instead of 404. Recent-day bars are cached for 60 s,
  and empty results are never cached. A past day fetched just after midnight is no longer cached forever with a missing tail.
- `TradeChart`/`useMarket`: failures and pending results are never served from memory. Pending shows the candles that exist,
  plus "Market data for this time isn’t in yet — usually 10–15 min" with a spinner. It auto-retries every `retryAfterSec`, and after
  20 min a Retry button replaces the spinner. A closed day shows "Market was closed that day". A real error shows "Chart unavailable"
  with a working Retry.
- Quick log (`src/lib/logDate.ts`):
  - A time typed later than now on today's date flips the date to yesterday, with the hint "Set to yesterday — that time hasn’t happened yet today".
  - Between 00:00 and 05:00, with nothing logged today but trades yesterday, the date defaults to yesterday.
  - Both cases show a "Yesterday" chip that switches back to today.
  - There are no new required fields.

## How to run / verify it

```bash
uv run pytest backend/tests/market          # pending / market-closed / recent-day TTL cases in test_market_bars.py
uv run ruff check . && uv run ruff format --check . && sam validate --lint
cd frontend
npx tsc --noEmit && npm test                # logDate.test.ts + market.test.ts (pending parsing, window params)
npm run build
npx playwright test -c playwright.mock.config.ts   # "chart: bars not in yet…" + "quick log: a time that hasn’t happened yet…"
```

## Decisions & why

- **"Pending" is a 200, not an error.** Lagging data is normal right after a trade. The UI must not show a terminal failure for it.
- **The server decides coverage** using `to` (ET `HH:MM`). The client sends the window only when it lands on the requested ET day.
  Otherwise it omits it, and the server only flags pending when there are no bars at all.
- The Saturday / Sunday-before-18:00-ET check stops "today, weekend" from spinning as pending. Mid-week holidays still show pending
  until the 20-minute give-up. That was accepted to keep things simple, since there is no holiday calendar.
- The impossible-time fix reacts to **time** edits only. If the trader then picks a date by hand, that choice is respected.
- When the date defaults to yesterday, the time is cleared, because "now" on yesterday would be wrong. Tapping the chip restores today and now.

## Gotchas

- `useMarket`'s `load()` keeps the previous value while reloading, so a pending chart keeps its partial candles during a retry instead of flashing the skeleton.
- The day strip keeps its 60 s failure memory (several strips mount at once). Only bars use `errorTtlMs: 0`.
- Mocked Playwright overrides `/api/market/bars` per test with a later `page.route` and calls `route.fallback()` to reach the shared mock.

## Next steps

1. Deploy (`scripts/deploy.sh`) so the Lambda change is live. The old frontend still works with it: it treats pending/empty as "unavailable".
2. Optional: a US market-holiday list would turn holiday "pending" into "Market was closed that day".

## Open questions / blockers

- None.
