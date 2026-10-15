# v2 — Simple trading journal on AWS (design spec)

Date: 2026-10-13 · Status: approved direction (owner asked for a one-shot build)

## Intent

**Who:** one discretionary day trader (futures: MNQ/MES/NQ/ES; options via Webull/Robinhood), plus maybe one friend.
Not a quant. Logs right after a trade or at the bell, on a phone or a laptop.

**What they must do:** log a trade in under ~10 seconds, see a truthful P&L, close the day with one line, and
occasionally review patterns. Journaling is a chore people skip, so every extra field is a reason to skip.

**Feel:** a calm trading terminal at the close: dark navy, precise numbers, green/red tape. It's quiet and dense where
it matters, and it never nags.

**Success:**
- Quick-log takes at most 5 required inputs.
- CSV import from Tradovate, NinjaTrader, Webull and Robinhood works.
- Stats are correct (fees, multipliers, real profit factor).
- It works on phone and desktop with one sign-in per device.
- No buttons off-screen at 360px width.
- Deployed on AWS and verified end to end.

## What changed from v1 (and why)

v1 (React + Firebase, Figma Make scaffold) had these problems:
- The save model rewrote the whole trade array two or three times per edit.
- One oversized trade (base64 photos in a 1 MB document) blocked every save.
- Merging left duplicates behind, so P&L was double-counted.
- Logging out leaked state to the next sign-in.
- "Profit factor" was really the payoff ratio.
- Symbol-substring multipliers (`includes('ES')`).
- No fees at all.
- The Gemini key shipped in the bundle.
- An 1,860-line trade form led with quant fields.

v2 is a rebuild. UI ideas are ported; the logic is rewritten and tested.

Tradezella research says casual traders rely on four things: import, the P&L calendar, headline stats and daily notes.
Its top complaints are sync breakage, AI auto-tag corrupting stats, partial export and price. So:
- **Core** = quick log, CSV import, calendar, headline stats, day notes, full export.
- **Additive** = prop accounts, deeper stats, AI coach. Each one is present but collapsed or opt-in, never in the way.

## Architecture

```
Browser (React 18 + Vite + TS strict + Tailwind v4)  ── one origin ──►  CloudFront
                                                                       ├─ /*      → S3 web bucket (SPA, OAC)
                                                                       └─ /api/*  → HTTP API (JWT authorizer: Cognito)
                                                                                      └─ ApiFunction (Python 3.13, Powertools)
                                                                                           ├─ DynamoDB table (single-table)
                                                                                           ├─ S3 photo bucket (presigned PUT/GET)
                                                                                           └─ Bedrock Converse (DeepSeek V3.2) — AI coach
```

- **Auth:** a Cognito User Pool with admin-created users only (no public signup) and an in-app sign-in form.
  - The SPA calls `cognito-idp` directly with `fetch`: `InitiateAuth` USER_PASSWORD_AUTH, the `NEW_PASSWORD_REQUIRED` challenge,
    `ForgotPassword` / `ConfirmForgotPassword`, and `REFRESH_TOKEN_AUTH`.
  - The refresh token is valid for 365 days and stored in localStorage, so each device signs in once.
  - The API uses an HTTP API JWT authorizer (issuer = pool, audience = app client id) and the **access token**.
  - The user id is the `sub` claim.
- **Runtime config:** the deploy writes `/config.json` to the web bucket:
  `{ "region", "userPoolId", "clientId", "apiBase": "/api" }`. The SPA fetches it at boot.
  - Dev: `frontend/public/config.json` is gitignored. `npm run dev` proxies `/api` to the deployed CloudFront URL.
- **Same origin**, so there is no CORS. The CloudFront behavior `/api/*` forwards to HTTP API with no caching, forwards the Authorization header, and allows all methods.
- **Stack** `tradejournal`, us-east-1, default AWS profile. CI deploys via OIDC (`infra/cicd-role.yaml`).
  No account IDs in the repo.

## Data model (DynamoDB single table `pk`/`sk`)

| pk | sk | item |
|---|---|---|
| `USER#<sub>` | `TRADE#<date>#<id>` | Trade |
| `USER#<sub>` | `ACCOUNT#<id>` | Account |
| `USER#<sub>` | `DAY#<YYYY-MM-DD>` | DayNote |
| `USER#<sub>` | `SETTINGS` | Settings |

Trade ids are client-generated (ULID-like, or a deterministic import fingerprint), so writes are idempotent.
Changing a trade's date moves its sort key. The API handles that by finding the old item (via the `id` → sk lookup
attribute `tid` on a GSI `byId`: pk=`pk`, sk=`tid`) and doing delete+put in one transaction.

Canonical TypeScript types live in `frontend/src/lib/types.ts`. The API stores them as-is (validated) plus `pk`/`sk`/`tid`.

## API (all JSON, all under `/api`, all require auth except `/api/health`)

| Method | Path | Body → Response |
|---|---|---|
| GET | `/api/health` | → `{ok:true}` |
| GET | `/api/bootstrap` | → `{settings, accounts[], trades[], days[]}` (all of the user's data; paginate internally) |
| PUT | `/api/trades/{id}` | Trade → Trade (upsert; moves the sk if the date changed) |
| DELETE | `/api/trades/{id}` | → `{deleted:true}` (also deletes its photos) |
| POST | `/api/trades/batch` | `{trades: Trade[]}` (≤ 500) → `{written:n}` (import; idempotent by id) |
| POST | `/api/trades/combine` | `{sourceIds: string[], merged: Trade}` → Trade (one transaction: put merged + delete sources) |
| PUT | `/api/days/{date}` | DayNote → DayNote |
| PUT | `/api/accounts/{id}` | Account → Account |
| DELETE | `/api/accounts/{id}` | → `{deleted:true}` (trades keep their accountId; the UI shows them as "Unassigned") |
| PUT | `/api/settings` | Settings → Settings |
| POST | `/api/photos/upload-url` | `{tradeId, contentType}` → `{key, url}` (presigned PUT, 5 min, jpeg/png/webp only, ≤ 8 MB) |
| POST | `/api/photos/view-urls` | `{keys: string[]}` → `{urls: {key: url}}` (presigned GET, 1 h; keys must start with the user's prefix) |
| POST | `/api/ai/coach` | `{from, to, question?}` → `{text}` (server loads trades+days in range, ≤ 400 trades summarized) |

**Admin routes** (`AdminFunction`, `backend/functions/admin/app.py`): a separate Lambda, so only its role holds Cognito admin
rights. Every route returns 403 unless the access token's `cognito:groups` includes `admin` AND, checked live in Cognito, the
caller is still an enabled member of `admin` (the claim alone is stale for up to an hour). Seed the first admin with
`scripts/make-admin.sh <email>`. `AdminUser` = `{username, email, status, enabled, createdAt, lastModified, isAdmin, isSelf}`.

| Method | Path | Body → Response |
|---|---|---|
| GET | `/api/admin/users` | → `AdminUser[]` (sorted by email) |
| POST | `/api/admin/users` | `{email, admin?}` → `{user, temporaryPassword}` (201; Cognito emails the invite, the UI shows the password once) |
| POST | `/api/admin/users/{username}/disable` · `/enable` | → `{user}` (disable also signs them out everywhere) |
| POST | `/api/admin/users/{username}/reset-password` | → `{user, temporaryPassword}` (FORCE_CHANGE_PASSWORD + global sign-out) |
| POST | `/api/admin/users/{username}/resend` | → `{user, temporaryPassword}` (invited users only; else 409) |
| POST | `/api/admin/users/{username}/admin` | `{admin: bool}` → `{user}` |
| DELETE | `/api/admin/users/{username}?purge=true` | → `{deleted, purged: {items, photos}}` (purge deletes their `USER#<sub>` items and `users/<sub>/` photos first) |

Guardrails (409): an admin can't disable, delete, demote or admin-reset themselves, and the last admin can't be removed or demoted.
Demote and disable re-count enabled admins after the change and roll back if none remain; delete re-checks right before
the (irreversible) delete.
Group changes reach a user's token on its next refresh (≤ 60 min).

Validation: unknown fields are dropped; there are size limits (notes ≤ 5,000 chars, ≤ 6 photos/trade, strings ≤ 200).
Errors look like `{error: "message"}` with a 4xx status.
Photo keys are `users/<sub>/trades/<tradeId>/<uuid>.<ext>`.

## P&L truth (`frontend/src/lib/pnl.ts`; tested)

- **Multiplier by exact root symbol:**
  - Strip the month/year code, e.g. `MNQZ5` and `MNQ 12-25` both resolve to `MNQ`.
  - Table: ES 50, MES 5, NQ 20, MNQ 2, YM 5, MYM 0.5, RTY 50, M2K 5, CL 1000, MCL 100, GC 100, MGC 10, SI 5000, NG 10000,
    6E 125000, ZB 1000, ZN 1000.
  - Options use 100 and stocks use 1. Unknown futures fall back to 1 and are flagged (`multiplierUnknown`).
- `gross = (exit − entry) × qty × multiplier × (long ? 1 : −1)` and `net = gross − fees`.
- `fees` is auto-filled from `settings.feesPerContract[root] ?? settings.feesPerContract.default`, multiplied by qty
  (round trip). The user can override it.
- **Outcome:** `|net| ≤ settings.breakevenBand` counts as breakeven. Breakevens are excluded from the win-rate denominator.
- **Stats:**
  - Net P&L.
  - Win %, as wins / (wins + losses).
  - Profit factor, as gross wins / |gross losses| (∞ is shown as "—" when there are no losses).
  - Avg win and avg loss.
  - Day win %.
  - Expectancy.
  - Max drawdown ($, from equity peak).
  - Streaks.
  - Best and worst day.
  - Breakdowns by setup, symbol, weekday, hour, and mistake (each mistake shows the "cost of" that mistake).

## Screens (mobile-first; bottom tab bar under 768px, left rail at 768px and up)

1. **Today:**
   - A big net P&L number and the session tape (signature).
   - Today's trades, newest first.
   - A "Close the day" card holding one line of text, followed-plan Y/N, and mood 1–5.
   - A collapsed pre-market plan.
2. **Calendar:**
   - A month grid with daily net P&L. Each cell shows the day's tape, a note dot, and weekly totals.
   - Tapping a day opens the day sheet (trades plus notes).
3. **Trades:**
   - A list grouped by day with filters (account, symbol, setup, win/loss, date range).
   - Tapping a trade opens the detail sheet: edit, tags, notes, screenshots, delete.
   - Multi-select lets you combine trades.
   - The header holds Import (CSV) and Export (CSV/JSON).
4. **Insights:**
   - The headline stat row, the equity curve, daily P&L bars, and breakdown tables.
   - "Deeper stats" is collapsed by default and holds expectancy, drawdown, streaks, R distribution and payoff ratio.
   - The AI coach card has a "Review my week" button and a free-text question.
5. **Settings:**
   - Accounts, including prop eval/funded with a target, max drawdown (trailing/static), daily loss limit, and progress bars.
   - Fees per contract.
   - Breakeven band.
   - Setup and mistake chip lists.
   - Sign out.

**Quick Log sheet** (global "+" button and the `N` key):
- Required fields: symbol (recent chips), Long/Short, qty (stepper), entry, exit.
- The live net P&L preview includes fees.
- One optional row holds the setup chip, mistake chips, and "+ note / screenshot" (collapsed; paste from clipboard works).
- Date/time default to now and the account defaults to the last one used.
- Enter saves. The sheet stays open with "Logged ✓, log another?" so batches are fast.

## Additive modules

- **Prop accounts:**
  - The progress bar shows profit toward the target.
  - The drawdown bar shows trailing drawdown from the peak balance.
  - "Days traded" is tracked.
  - Status changes (passed, failed) are manual, with a suggestion when a threshold is crossed.
- **AI coach:**
  - Runs server-side only; no key exists in the browser.
  - The model is DeepSeek V3.2 on Bedrock (the cheapest that works).
  - It is on-demand, never auto-tags, and never writes data.
- **Deeper stats:** collapsed by default.
- **Market context** (added 2026-10-13; provider code adapted from ClearVest; see `docs/market-context.md`):
  - What it shows, with zero input from the trader:
    - A per-day strip with ES/NQ % change, VIX, and USD high/medium-impact events (Forex Factory first, then FMP via the
      `clearvest-fmp` SSM key).
    - A trade chart of Yahoo 1m/5m bars with entry/exit markers, for trades from the last 60 days.
    - A one-tap "Add today's events" button in the pre-market plan.
  - How it's built:
    - A separate `MarketFunction`.
    - A shared DynamoDB cache (`pk=MARKET`).
    - Every source fails quietly.
  - It never calls ClearVest's API at runtime.

## Non-goals (v2)

- Broker API sync.
- Chart replay or backtesting.
- Social or mentor features.
- A native mobile app (we ship a responsive PWA instead).
- Discord-journal parser, behavioral keyword tags, and the landing page (all removed).

## Testing & verification

- **Unit tests:**
  - `vitest` covers pnl, stats, parsers (fixture CSVs per broker), FIFO matching and fingerprinting.
  - `pytest` with moto covers every API route, ownership isolation, and validation limits.
  - `ruff` and `tsc --noEmit` also run.
- **E2E:**
  - Playwright runs against the deployed URL at 375×812 and 1440×900.
  - Flows: sign in, quick log, edit, calendar, import a fixture CSV, close the day, and export.
  - Every clickable element is checked to be on-screen. Screenshots are reviewed for alignment.
- **Design:** `/interface-design:critique` pass after the build, and fixes are applied.
