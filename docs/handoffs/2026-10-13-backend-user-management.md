# In-app user management + self account management

- **Date:** 2026-10-13
- **Author:** @wakeensito (with Claude Code)
- **Team:** backend (and frontend)
- **Status:** done
- **PR / issue:** #2
- **Follows:** 2026-10-13-devops-v2-aws-rebuild.md

## What changed

- Cognito `admin` group. A new `AdminFunction` (`/api/admin/users*`) lets admins:
  - list users
  - invite users (an email is sent, and the temporary password is shown once)
  - disable or enable a user
  - reset a password (a temporary password is shown once)
  - resend an invite
  - make a user admin or remove admin
  - remove a user, optionally purging their trades and screenshots
- **Guardrails:** an admin can't disable, delete or demote themselves, and the last admin can't be removed.
- **Settings → Your account:** change password, and sign out of all devices (GlobalSignOut).
- **Settings → People:** admin only.

## How to run / verify it

```bash
uv run pytest backend/tests/admin
cd frontend && npx playwright test -c playwright.mock.config.ts e2e/mocked/people.spec.ts
scripts/make-admin.sh you@example.com   # then sign out/in (groups ride the token)
```

## Decisions & why

- **Separate Lambda** so only it holds Cognito admin rights.
- **Authorization is enforced server-side** from the JWT `cognito:groups` claim. The UI only hides controls.
- **Temporary passwords are shown once** as well as emailed, because Cognito's default sender is rate-limited and can land in spam.

## Gotchas

- **Deploy order:** redeploy `tradejournal-cicd` before the app. The boundary gains the Cognito admin and photo-list actions.
- **Boundary scope:** the boundary's Cognito admin actions can't be scoped to one pool. The function policy pins it to this pool.
- **Unverified email text:** whether `{username}` in the invite email renders as the email or the sub hasn't been checked. Send one real invite to find out.

## Next steps

1. Owner sends a real invite and confirms the email text.

## Open questions / blockers

- None.
