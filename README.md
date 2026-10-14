# Trading Journal

A simple, fast trading journal for discretionary day traders: log a trade in about 10 seconds, see a truthful P&L, close
the day with one line. Quant-style analytics are there, but collapsed until you want them.

**Live:** https://dc1cprzv21d8m.cloudfront.net (invite only)

## What it does

- **Quick log** has five required inputs: symbol, Long/Short, qty, entry and exit. Fees are added automatically, and futures multipliers come from an exact table.
- **CSV import** from Tradovate, NinjaTrader, Webull and Robinhood. Re-importing the same file never creates duplicates.
- **Today, Calendar, Trades:**
  - The *session tape* shows every trade as a green or red tick.
  - The monthly P&L calendar shows weekly totals.
  - "Close the day" holds one line of review.
- **Insights:**
  - Net P&L, win %, real profit factor, avg win/loss, day win %, and **cost of mistakes**.
  - Breakdowns by setup, symbol, weekday and hour. Deeper stats are collapsed.
- **AI coach** (Bedrock): on-demand weekly review, or ask a question about your own trades. It runs server-side and never edits data.
- **Market context:** each day automatically shows ES/NQ, VIX, and high-impact economic events. Each trade has a chart with its entry and exit marked.
- **Prop accounts:** profit target and trailing/static drawdown progress.
- **Full export** to CSV and JSON. Your data is yours.

## Architecture

React 18 + Vite + Tailwind v4 SPA, served by CloudFront and S3. `/api/*` goes to an HTTP API with a Cognito JWT authorizer, then to Python Lambdas
(API + market data), backed by DynamoDB (single table), S3 (screenshots) and Bedrock (coach). Everything is AWS SAM, in one stack
(`tradejournal`). GitHub Actions deploys via OIDC (`infra/cicd-role.yaml`).

Further reading:
- Spec: `docs/superpowers/specs/2026-10-13-v2-simple-journal-on-aws-design.md`
- Design system: `.interface-design/system.md`
- Market data: `docs/market-context.md`
- How to work in this repo: `AGENTS.md`

## Develop

```bash
uv venv && uv pip install -e '.[dev]' && uv run pytest          # backend
cd frontend && npm ci && npm run typecheck && npm test           # frontend
scripts/dev-config.sh && cd frontend && npm run dev              # local UI against the deployed API
```

## Deploy

```bash
scripts/deploy.sh                       # default AWS profile; SAM stack + SPA upload + invalidation
scripts/create-user.sh you@example.com  # admin-only signup, prints a temporary password
```

v1 (Firebase) is retired. Its code is in git history and on the `archive/*` branches.
