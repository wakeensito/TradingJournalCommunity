# Market context (additive module)

Gives the trader market context with zero input. Every source fails quietly: one broken provider nulls or empties only its own section, never the whole response.

| Piece | What it shows |
|---|---|
| `MarketContextStrip` | One line per day: `ES +0.42% · NQ −1.10% · VIX 18.2 ▲`, plus USD high/medium-impact event pills (times in ET, high impact in the warn colour). |
| `TradeChart` | Candlesticks for the trade's day, zoomed to the trade window with padding. Shows entry and exit arrows, entry/exit/stop price lines, a time axis in ET, and a touch-scrub crosshair. |
| `eventsForPlan(events)` | Builds `"8:30 CPI m/m (high) · 10:00 ISM Services PMI (med)"` for the pre-market plan. |

Code:
- Backend: `backend/functions/market/` (its own Lambda, `MarketFunction`).
- Tests: `backend/tests/market/`.
- UI: `frontend/src/features/market/`.

It never calls ClearVest at runtime. The provider code is copied and adapted from ClearVest.

## API (behind the HTTP API Cognito JWT authorizer)

`sub` is required, but the data is shared across users (market data is not user data).

### `GET /api/market/day/{date}`

Response:

```json
{ "date": "2026-10-13",
  "indices": { "ES": {"close": 6738.18, "changePct": 0.42} | null, "NQ": {...} | null },
  "vix": {"close": 18.2, "change": 1.2} | null,
  "events": [{"time": "08:30", "title": "CPI m/m", "impact": "high", "forecast": "0.3%", "previous": "0.4%"}],
  "sources": {"indices": "yahoo|partial|error|none", "vix": "yahoo|fred|error|none",
              "events": "forexfactory|fmp|unavailable|error"} }
```

- A `null` index or VIX with a non-error source means the market was closed that day (weekend or holiday).
- `changePct` is in percent. VIX `change` is in points.
- Dates outside `2000-01-01` to today + 31 days return `400`.

### `GET /api/market/bars?symbol=&date=&assetType=futures|option|stock&underlying=&from=&to=`

Response:

```json
{ "symbol": "MNQ=F", "interval": "1m"|"5m", "bars": [{"t", "o", "h", "l", "c", "v"}], "tz": "America/New_York" }
```

- `t` is epoch seconds.
- `from`/`to` (optional) are the trade window as ET `HH:MM` on `date` (`to` wins; `from` is used when there's no exit). Bad values → `400`.
- **Yahoo lags 5–15 minutes.** While the day is *recent* (today, or until 00:30 ET the next day), no bars yet — or bars
  whose last candle ends before `to` — return `200` with `"pending": true, "retryAfterSec": 120` (bars may be partial).
  The client retries; it is never an error. Today on a Saturday (or Sunday before 18:00 ET) is `market-closed` instead.
- A settled day with no bars at all (weekend, holiday) returns `200 {"bars": [], "reason": "market-closed"}`.
- Bars cover the whole ET calendar day (00:00–24:00 ET, `prepost=True`), so they include pre/post-market and the futures overnight session.
- Interval rules:
  - `1m` if the date is less than 7 days old.
  - `5m` if it is less than 60 days old.
  - Otherwise `404 {"error":"Intraday bars older than 60 days aren't available"}`.
- Other responses:
  - Future date: `400`.
  - Bad symbol or assetType: `400`.
  - Unmapped futures root: `404`.
  - Yahoo failing for every candidate: `502`.
- Symbol mapping:
  - **Futures:** the month code is stripped (`MNQZ5`, `MNQZ25`, `MNQ 12-25`, `/MNQZ5` and `MNQ1!` all become `MNQ`), then mapped to Yahoo continuous contracts. The micro contract is tried first, then the full-size one (same price):
    - MES → MES=F, then ES=F.
    - MNQ → MNQ=F, then NQ=F.
    - MYM → MYM=F, then YM=F.
    - M2K → M2K=F, then RTY=F.
    - MCL → MCL=F, then CL=F.
    - MGC → MGC=F, then GC=F.
    - Single contracts: ES, NQ, YM, RTY, CL, GC, SI, NG, 6E, ZB, ZN.
  - **Options** chart the underlying (`underlying` param, else the first token of the symbol). SPX/SPXW map to `^SPX`, NDX to `^NDX`, RUT to `^RUT`.
  - **Stocks** are used as-is (`BRK.B` becomes `BRK-B`).

## Data sources and limits

| Section | Primary | Fallback | Notes |
|---|---|---|---|
| ES / NQ daily | Yahoo `ES=F`, `NQ=F` via yfinance 1.7.0 (ClearVest's pin), 4 s timeout | none | Yahoo is **unofficial**: no SLA, occasional rate limits or format changes. Futures settles are Yahoo's continuous front month. |
| VIX | Yahoo `^VIX` | FRED `VIXCLS` (keyless `fredgraph.csv`) | FRED publishes the next day, so it only helps past days. |
| Events | Forex Factory weekly JSON (`nfs.faireconomy.media/ff_calendar_{thisweek,nextweek}.json`), keyless | FMP `/stable/economic-calendar` | See the event details below. |
| Intraday bars | Yahoo 1m/5m with `prepost` | full-size contract when the micro returns nothing | Yahoo's own limits: 1m only for about the last 7–30 days, 5m for the last 60. |

Event details:
- Only USD events with high or medium impact are kept.
- **Forex Factory covers this week and next week only** (Sunday to Saturday weeks). It also throttles hard, so each feed is cached in DynamoDB for 1 hour.
- **FMP** handles other dates, or steps in when FF fails. It uses the **ClearVest FMP key** (SSM SecureString `clearvest-fmp`), so it **shares ClearVest's free-tier quota** (about 250 calls/day).
- If FMP's plan doesn't include the calendar (401, 402, 403, or a 200 response with `Error Message`), or the key is missing, events come back `[]` with `sources.events="unavailable"`. That verdict is remembered per container for 6 hours.

**Cache** (shared table, `pk=MARKET`). Values are stored as one compact JSON string in `data`.

| sk | Lifetime |
|---|---|
| `DAY#<date>` | Past day with indices + VIX + events all present: **forever** (no `ttl`). Past day complete except events `unavailable`: 24 h. Today, future, or incomplete: 30 min. |
| `BARS#<yahooSymbol>#<date>#<interval>` | Settled day: forever. Recent day (see above): 60 s. Empty results are never cached. Items over 350 KB are skipped (a 24 h day of 1m bars is about 70 KB). |
| `FF#<thisweek\|nextweek>#<weekStart>` | 1 h |

Reads treat `ttl <= now` as a miss, because DynamoDB TTL deletes expired items lazily. Cache read/write errors only cause a fresh fetch. The browser also caches in memory: past days indefinitely, today for 5 minutes, day-strip failures for 60 seconds. Bars: settled days indefinitely, today/yesterday for 60 s, and **failures and `pending` results are never cached** (the next open or Retry asks again).

**Security:**
- The FMP key is read once per cold start with `WithDecryption=True` and is never logged.
- HTTP error details never include query strings.
- `/tmp/yfinance` is yfinance's timezone cache (the only writable directory on Lambda).

## Wiring for the coordinator (I did not edit these files)

### 1. `template.yaml`

**Parameter** (under `Parameters:`):

```yaml
  FmpKeyParam:
    Type: String
    Default: clearvest-fmp
    Description: >-
      SSM SecureString NAME (no leading slash) holding the FMP API key. It's shared with ClearVest, so it shares that quota.
      If the parameter is missing, economic events beyond Forex Factory's two weeks just come back as "unavailable".
```

**Table:** add TTL to the existing `JournalTable` `Properties`:

```yaml
      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true
```

**Function + log group** (under `Resources:`, next to `ApiFunction`). Runtime, arm64, the Powertools layer and `PermissionsBoundary` come from `Globals`.

```yaml
  MarketLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub /aws/lambda/${AWS::StackName}-${Stage}-market
      RetentionInDays: 30

  MarketFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub ${AWS::StackName}-${Stage}-market
      CodeUri: backend/functions/market/
      Handler: app.lambda_handler
      Timeout: 20
      MemorySize: 512
      LoggingConfig:
        LogGroup: !Ref MarketLogGroup
      Environment:
        Variables:
          TABLE_NAME: !Ref JournalTable
          FMP_KEY_PARAM: !Ref FmpKeyParam
          POWERTOOLS_SERVICE_NAME: tradejournal-market
      Policies:
        - DynamoDBCrudPolicy: { TableName: !Ref JournalTable }
        - Statement:
            - Effect: Allow
              Action: ssm:GetParameter
              Resource: !Sub arn:${AWS::Partition}:ssm:${AWS::Region}:${AWS::AccountId}:parameter/${FmpKeyParam}
      Events:
        MarketDay:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /api/market/day/{date}
            Method: GET
        MarketBars:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /api/market/bars
            Method: GET
```

How the template fits together:
- Both routes inherit `DefaultAuthorizer: CognitoJwt`.
- HTTP API picks the most specific route, so these win over `ApiFunction`'s `ANY /api/{proxy+}`. No change to `ApiFunction` is needed.
- The CloudFront `/api/*` behavior already forwards them.
- If the key is a SecureString under the **default `aws/ssm` key**, no KMS permission is needed. If it uses a customer-managed CMK, add `kms:Decrypt` on that key (to the function policy and the boundary).

**Build note:** yfinance pulls in pandas, numpy and curl_cffi. That's roughly 120–150 MB unzipped, which is under Lambda's 250 MB limit. `sam build` must produce **arm64** wheels: run it on an arm64 runner, or use `sam build --use-container`. A cold start that imports pandas takes about 1.5–3 s. Only requests that actually call Yahoo import it, and cache hits don't.

### 2. Permissions boundary (`infra/cicd-role.yaml` → `AppBoundary.PolicyDocument.Statement`)

The boundary currently has no SSM statement, so `ssm:GetParameter` would be silently denied and events would show as "unavailable". Add this statement and redeploy the `tradejournal-cicd` stack **before** the app stack:

```yaml
          - Sid: MarketFmpKey
            Effect: Allow
            Action: ssm:GetParameter
            Resource: !Sub 'arn:${AWS::Partition}:ssm:${AWS::Region}:${AWS::AccountId}:parameter/clearvest-fmp'
```

(If you rename `FmpKeyParam`, change the parameter name here too. The boundary stack doesn't see the app parameter.) DynamoDB and Logs are already covered by `AppTableData` (`${AppStackName}-*`) and `Logs`.

### 3. Dependencies

- `backend/functions/market/requirements.txt` (already written): `yfinance==1.7.0`, `requests>=2.32,<3`, `tzdata>=2024.1`.
- `pyproject.toml`: **no change needed for tests**. They fake yfinance and use the `requests` that moto already installs. Optionally add `requests` to `dev` explicitly.
- Tests add `backend/functions/market` to `sys.path` themselves, and load the handler as `market_app` (the API already uses the module name `app`).
- `frontend/package.json`: **no new dependencies**. The chart is hand-rolled SVG.

### 4. CI

`uv run pytest` already collects `backend/tests/market` (`testpaths = backend/tests`). Ruff passes on the new files.

## UI integration

All components take an injected `apiGet(path) => Promise<unknown>`. The path is relative to the API base (for example `/market/day/2026-10-13`), and the function must throw on non-2xx; an `ApiError` with `.status` lets the chart tell "too old" apart from other failures. `lib/api.ts` doesn't expose a generic GET today, so add one line to its `api` object:

```ts
get: (path: string) => send<unknown>('GET', path),
```

Then pass `apiGet={api.get}`. Imports come from `@/features/market`.

| Where | What |
|---|---|
| Today header (under the big P&L / session tape) | `<MarketContextStrip apiGet={api.get} date={todayLocal()} />` |
| Day sheet and Calendar day sheet | `<MarketContextStrip apiGet={api.get} date={day} maxEvents={3} />` |
| Trade detail sheet (above notes/screenshots) | `<TradeChart apiGet={api.get} trade={trade} />` (default height 240; 200 is fine on phones) |
| Pre-market plan, "Add today's events" one-tap button | `const d = await fetchMarketDay(api.get, todayLocal()); const line = d ? eventsForPlan(d.events) : '';` then append `line` to `plan.focus` or `plan.levels` (hide the button when `line` is empty). `fetchMarketDay` never throws. |

UI behaviour:
- **Strip:** while loading it shows a skeleton line. On error, or when there's nothing to show, it renders `null`: no error UI by design. More than `maxEvents` pills shows a `+N` expander.
- **Chart: trade times.** Trades store the trader's **local** `HH:MM`, and markers convert that to an instant in the browser's timezone. Axis labels and the crosshair readout are in ET.
  - An exit clock earlier than the entry is treated as crossing midnight.
  - With no entry time, the chart shows the 9:30–16:00 ET session.
- **Chart: options.** Entry/exit prices are premiums, so options get time markers only (no price lines on the underlying).
- **Chart: empty states.** Trades older than 60 days show "Chart unavailable for trades older than 60 days", with no request made. Otherwise:
  - `pending` → the candles that exist (if any) plus a calm note, "Market data for this time isn’t in yet — usually 10–15 min", with a small spinner. It auto-retries every `retryAfterSec` while the sheet is open, and after 20 min swaps the spinner for a Retry button.
  - `reason: market-closed` → "Market was closed that day".
  - A real failure → "Chart unavailable" with a working Retry button (44px target).
- **Chart: touch.** `touch-action: pan-y`, so a horizontal drag scrubs the crosshair and a vertical drag scrolls the sheet.

## Tests

- `uv run pytest backend/tests/market`: 63 tests, using moto DynamoDB + SSM, a frozen ET clock, a fake yfinance, a fake HTTP session and saved FF/FMP/FRED fixtures. No network. They cover:
  - root mapping
  - interval choice by age
  - cache hit, miss, TTL and expiry
  - each source failing on its own
  - FMP 402 → unavailable (memoized)
  - FF → FMP fallback
  - ET conversion across DST
  - auth and validation
- `cd frontend && npx vitest run src/features/market`: 15 tests covering the parsers, `eventsForPlan`, ET formatting, chart window maths and the fetch cache.
