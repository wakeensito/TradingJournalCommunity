# Admin API security review fixes: live admin check, last-admin race, tag-scoped Cognito IAM

- **Date:** 2026-10-15
- **Author:** @wakeensito (with Claude Code)
- **Team:** cybersecurity
- **Status:** in-progress (merged code needs the two-step deploy below)
- **PR / issue:** see the PR from `fix/admin-security-review`
- **Branch:** `fix/admin-security-review`
- **Follows:** [2026-10-14-devops-user-management-release](2026-10-14-devops-user-management-release.md)

## What changed

- **Stale privilege:** every admin route still checks the JWT `cognito:groups` claim, and then checks live in Cognito
  that the caller is still an **enabled** member of `admin`. A demoted, disabled or deleted admin gets a 403 right away,
  even though their token still says admin for up to 60 minutes.
- **Last-admin race (TOCTOU):** demote and disable re-count the enabled admins *after* the write. If none are left, the
  change is rolled back (re-added to the group, or re-enabled) and the request returns 409. Delete can't be undone, so it
  re-checks right before `AdminDeleteUser` that at least one enabled admin other than the target remains. The small
  window that's left is documented in a code comment, and the function logs an error if a delete ever leaves zero admins.
- **Over-broad IAM:** the user pool now carries `tradejournal:managed-by=tradejournal-cicd` (`UserPoolTags` in
  `template.yaml`). In `infra/cicd-role.yaml`, the AppBoundary `AppUserAdmin` statement and the deploy role's mutating
  Cognito actions (`AppCognitoWriteOwn`, `AppCognitoUntagOwn`) only work on pools that carry that tag. Reads
  (`AppCognitoRead`) stay ungated so CloudFormation can still describe resources.
- Updated the spec's admin auth and guardrail text to match.

## How to run / verify it

```bash
uv run pytest backend/tests/admin                      # stale-token, disabled-caller and race/rollback tests
uv run ruff check . && uv run ruff format --check .
sam validate --lint && uvx cfn-lint infra/cicd-role.yaml template.yaml

# After step (a) of the deploy order (default profile, read-only):
aws cognito-idp describe-user-pool --user-pool-id <pool id> --query UserPool.UserPoolTags
#   → must include "tradejournal:managed-by": "tradejournal-cicd" before step (b)
```

**Deploy order (it matters):**

1. **(a)** Merge. CI deploys the app stack with the role that's live today, which isn't tag-gated. That adds the tag to the pool
   and ships the new admin code. The code needs no new IAM action.
2. Verify that the pool has the tag (command above).
3. **(b)** Only then, the owner redeploys `tradejournal-cicd` from a laptop:
   `aws cloudformation deploy --template-file infra/cicd-role.yaml --stack-name tradejournal-cicd --capabilities CAPABILITY_NAMED_IAM`.

If (b) runs before (a), AdminFunction is denied every Cognito call (People page broken) and CI can't update the pool.
To recover, tag the pool once from a laptop:
`aws cognito-idp tag-resource --resource-arn <pool arn> --tags tradejournal:managed-by=tradejournal-cicd`.

## Decisions & why

- **The live check uses `ListUsersInGroup`, not `AdminGetUser` plus `AdminListGroupsForUser`.** One call answers both
  "still in `admin`?" and "still enabled?", and the function already holds that permission. `AdminListGroupsForUser`
  would be a new IAM action, so it would need the boundary redeploy *before* the app deploy. The tag condition needs the
  opposite order, so that would leave the People page broken between the two steps. The caller is matched on `sub` (immutable),
  not on the username claim.
- **No `aws:RequestTag` path for `TagResource`.** Allowing "tag any untagged pool with our tag" would let the CI role
  claim kinfolk's pool, which has no ownership tag, and then update or delete it. New pools get the tag in
  `CreateUserPool` itself, and the existing pool gets it from step (a).
- All 11 boundary actions, and every mutating action in the deploy role, support `aws:ResourceTag` on the `userpool`
  resource, per the Service Authorization Reference for Amazon Cognito User Pools. Nothing had to be split into an ungated statement.
- Both racing requests may roll back. That's the safe outcome, and either admin can retry.

## Gotchas

- Never remove or change the pool's `tradejournal:managed-by` tag. If it's gone, the AdminFunction is denied by its boundary.
- The pre-change `_guard_last_admin` can't be reached by an honest caller any more, because a live, distinct enabled
  admin is always making the request. It stays as defense in depth, and a monkeypatched test covers it.
- At the time of writing, the live `tradejournal-prod-users` pool had only `aws:cloudformation:*` tags, so step (a) is required.

## Next steps

1. Merge, let CI deploy, and confirm the tag (step a).
2. Owner redeploys `tradejournal-cicd` (step b), then smoke-tests Settings → People (list, then invite and delete a throwaway user).

## Open questions / blockers

- Owner: run step (b) after confirming the tag. Until then the IAM scoping fix isn't live, but the code fixes are.
