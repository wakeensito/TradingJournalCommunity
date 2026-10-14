# v2: Firebase → AWS rebuild, simple-first journal

- **Date:** 2026-10-13
- **Author:** @wakeensito (with Claude Code)
- **Team:** devops (full-stack)
- **Status:** done (deployed); the PR to `main` is pending until the owner runs launch-repo (branch protection, board)
- **PR / issue:** none yet. Branch `v2`.
- **Branch:** `v2`
- **Follows:** none (first handoff)

## What changed

- Retired the Firebase app. It's in git history and on the `archive/wip-2026-10-13` and `archive/stash-dashboard-css-wip` branches.
- New AWS stack `tradejournal` (SAM):
  - CloudFront + S3 SPA.
  - HTTP API with a Cognito JWT authorizer.
  - Python Lambdas: `api`, `market` and `admin`.
  - DynamoDB single table, S3 screenshots, Bedrock (DeepSeek V3.2) coach.
  - Live at https://dc1cprzv21d8m.cloudfront.net.
- New React 18 / TS strict / Tailwind v4 frontend, built to `.interface-design/system.md`:
  - 5-input quick log.
  - Session tape signature.
  - P&L calendar.
  - Insights with cost of mistakes, plus deeper stats (collapsed).
  - Prop accounts, CSV import/export.
- Market context (provider code adapted from ClearVest): ES/NQ/VIX + economic events per day, and a candle chart per trade.
  It reads the `clearvest-fmp` SSM key by name.
- OIDC deploy role `tradejournal-cicd`:
  - Assumable from `main` only.
  - Has a permissions boundary.
  - Its CloudFront writes are tag-gated, because the account hosts other sites.

## How to run / verify it

```bash
uv run pytest                         # backend: api + market + admin (moto, offline)
cd frontend && npm test && npm run typecheck && npm run build
npx playwright test -c playwright.mock.config.ts      # layout/click sweep at 360/390/768/1440, no backend
set -a; . ./.env.e2e; set +a; npx playwright test     # LIVE e2e (dedicated test user; .env.e2e is gitignored)
scripts/deploy.sh                     # default profile only
```

Env var names only: `E2E_BASE_URL`, `E2E_EMAIL`, `E2E_PASSWORD`, `VITE_API_ORIGIN` (dev proxy).

## Decisions & why

- **P&L lives only in `frontend/src/lib/pnl.ts` / `stats.ts`.** v1's bugs came from four copies of the math.
- **One DynamoDB item per write**, with idempotent client ids. Import ids are fingerprints, so re-import never duplicates.
  - A date change moves the sort key in one transaction.
  - Combining trades deletes the sources in the same transaction.
- **In-app Cognito auth via `fetch`** (no Amplify), with a 365-day refresh token. Each device signs in once.
- **Market Lambda is scoped by IAM to `pk = MARKET` rows.** It can never read journal data.
- **CI can't create CloudFront distributions.** A RequestTag-gated tag grant would let it adopt other sites' distributions.
  The first creation (or a replacement) is a laptop `scripts/deploy.sh`.

## Gotchas

- When `infra/cicd-role.yaml` changes, redeploy `tradejournal-cicd` **before** the app stack. The app's function roles need
  the boundary policy to allow every action they use.
- Forex Factory's calendar only covers this week and next. Older dates fall back to FMP, which is shared with ClearVest's free-tier key.
- Cognito's default email sender is capped at about 50 messages a day. That's fine for invites at this scale.
- Yahoo intraday bars only go back about 60 days (1m bars for the last 7 days).

## Next steps

1. Owner runs `bash ~/.claude/skills/launch-repo/launch.sh Tradingjournalcommunity --no-seed-issues`, then pushes `v2` and opens a PR to `main`.
   (Pushing and GitHub changes were blocked for the agent.)
2. Set repo vars `AWS_DEPLOY_ROLE_ARN` (stack output) and `DEPLOY_ENABLED=true`. Add repo secrets for live e2e in CI if wanted.
3. Wording follow-up: "Cost of mistakes" also lists mistakes that netted positive. Rename it to "Tagged mistakes · net", or filter it.
4. Nice-to-haves: the back button closes sheets, an offline service worker, and a virtualized trade list.

## Open questions / blockers

- None blocking. A custom domain is optional (ACM cert + alias) if the owner wants one.
