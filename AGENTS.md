# Agent instructions — Tradingjournalcommunity

**Trading Journal v2** is a simple, fast trading journal for a discretionary day trader (futures plus options), not a quant
tool. It runs on AWS: a React SPA served by CloudFront and S3, with an HTTP API, Python Lambda, DynamoDB, Cognito and Bedrock behind it.
v1 (Firebase) was retired in Oct 2026. Its code lives in git history (`main` before v2) and on the `archive/*` branches.

**Source of truth:**
- `docs/superpowers/specs/2026-10-13-v2-simple-journal-on-aws-design.md` — the spec: API contract, data model and P&L rules.
- `.interface-design/system.md` — the design system.
- `frontend/src/lib/types.ts` — the canonical data shapes.

## Before starting work

1. Read `docs/handoffs/README.md`.
2. Read the newest handoff(s): `ls docs/handoffs/ | sort | tail -n 10`
3. Start from that handoff's **Next steps** unless the user says otherwise.

## After finishing a PR or milestone

Write a new handoff in the **same PR** as the work: `docs/handoffs/YYYY-MM-DD-<team>-<slug>.md`, copied from
`docs/handoffs/_TEMPLATE.md`, with every section filled. Never edit another person's handoff. Write a new one and link it under **Follows**.

## Commands

```bash
# Backend (repo root)
uv venv && uv pip install -e '.[dev]'
uv run pytest                        # API tests (moto)
uv run ruff check . && uv run ruff format --check .
sam validate --lint && sam build

# Frontend
cd frontend && npm ci
npm run typecheck && npm test        # tsc + vitest (P&L, stats, CSV parsers)
npm run build
npm run dev                          # :5173; needs scripts/dev-config.sh once (proxies /api to the deployed app)

# Deploy (default AWS profile ONLY, us-east-1, stack `tradejournal`)
scripts/deploy.sh                    # sam deploy + SPA upload + config.json + invalidation
scripts/create-user.sh <email>       # admin-only signup; prints a temp password

# E2E (against the deployed URL; CI normally runs this)
E2E_BASE_URL=... E2E_EMAIL=... E2E_PASSWORD=... npm run e2e
```

## Product rules (don't regress these)

- **Quick log stays short.** It has at most 5 required inputs, and everything else is optional and collapsed. Adding a required field needs the owner's sign-off.
- **There is one P&L implementation** (`frontend/src/lib/pnl.ts` and `stats.ts`). The API never computes stats. The only exception is the AI coach summary, which mirrors the formula.
- **Fees always count.** Multipliers come from an exact root-symbol table, never a substring match.
- **One document per write.** Never save whole collections.
- **Quant features are additive.** Deeper stats, R and prop rules stay collapsed or opt-in.
- **The AI coach** runs server-side (Bedrock), on demand only, and never writes data.

## Advisory Council

On significant decisions, reason through five standing advisors and surface their relevant takes before recommending.
The lenses are deliberately in tension.

- **Contrarian:** argues against the chosen path *and* against my own first answer. Names the hidden cost and the ignored failure mode.
- **First Principles:** strips the problem to what's actually true and required. Challenges inherited patterns.
- **Expansionist:** asks what this unlocks long-term. It's checked by the Contrarian and by the anti-scope-creep product rules above.
- **Outsider:** sees it as a casual trader who hates journaling, or a non-engineer, would. Names what we've gone blind to.
- **Executor:** finds the smallest concrete next step, its real cost, and how reversible it is. Lands the decision.

**When to convene:** architecture and API shape, product scope (especially "should this be core or additive?"), design
trade-offs, naming, and risky or irreversible actions. **Not** for routine edits, lookups or simple fixes.
**How:** quote only the advisors with something non-redundant (usually 2–3), one or two sentences each, then a short **Synthesis**
that lands on one recommendation.

## House rules

- `main` is protected: branch and PR only, and `ci-ok` must be green.
- Label issues and PRs with a `team:*` label.
- Never commit secrets, AWS account IDs, or ARNs. Use pseudo-parameters and repo variables.
- Use the default AWS profile only.
