#!/usr/bin/env bash
# Add an existing user to the Cognito `admin` group so they see Settings → People in the app.
# Use it once to seed the first admin (the owner); after that, admins promote people in-app.
# The new rights show up after their next token refresh (≤ 60 min) or a sign-out/sign-in.
# Usage: scripts/make-admin.sh someone@example.com
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/_stack.sh
source "$ROOT/scripts/_stack.sh"
require_default_profile

EMAIL="${1:-}"
if [[ ! "$EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]; then
  echo "Usage: $0 <email>" >&2
  exit 2
fi
EMAIL="$(printf '%s' "$EMAIL" | tr '[:upper:]' '[:lower:]')"

POOL="$(stack_output UserPoolId)"
if [ -z "$POOL" ] || [ "$POOL" = "None" ]; then echo "Stack $STACK has no UserPoolId output" >&2; exit 1; fi

# The pool signs in by email, so the email works as the username (alias) for admin calls.
aws cognito-idp admin-add-user-to-group \
  --user-pool-id "$POOL" \
  --username "$EMAIL" \
  --group-name admin

echo "$EMAIL is now an admin. Sign out and back in (or wait up to an hour) to see Settings → People."
