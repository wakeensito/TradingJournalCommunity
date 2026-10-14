# Insights: "Cost of mistakes" → "Tagged mistakes · net"

- **Date:** 2026-10-14
- **Author:** @wakeensito (with Claude Code)
- **Team:** frontend
- **Status:** done
- **PR / issue:** #4 (also records #3, which shipped without a handoff)
- **Follows:** [2026-10-14-devops-user-management-release](2026-10-14-devops-user-management-release.md)

## What changed

- Renamed the Insights hero card heading. The figure is the **net** P&L of every mistake-tagged trade, so a
  mistake that happened to make money shows green and shrinks the total. "Cost" over-claimed; the subtext and rows
  were already honest.
- Nothing else in the card changed: same data, same rows, same `mistake-cost` id and `mistake-rows` test id.
- For the record, PR #3 (merged earlier today, no handoff): the CI deploy role gained `lambda:GetLayerVersion` on the
  AWS Powertools layer. The first CI deploy that created a Lambda (`AdminFunction`) failed on it and rolled back.

## How to run / verify it

```bash
cd frontend && npm run typecheck && npm test && npx playwright test -c playwright.mock.config.ts
```

## Decisions & why

- **Rename, don't filter.** Dropping profitable tagged trades would make the number look like a true cost but
  hide the habit. The owner wants the truth in one glance (design system intent), so the label changed instead.

## Gotchas

- None.

## Next steps

1. Nice-to-haves from the v2 handoff still stand: the back button closes sheets, an offline service worker, and a
   virtualized trade list.

## Open questions / blockers

- None.
