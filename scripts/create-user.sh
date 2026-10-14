#!/usr/bin/env bash
# Admin-only sign-up: create a Cognito user with a one-time temporary password (printed once, never
# emailed). The user signs in with it and the app walks them through NEW_PASSWORD_REQUIRED.
# Usage: scripts/create-user.sh someone@example.com
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

POOL="$(stack_output UserPoolId)"
if [ -z "$POOL" ] || [ "$POOL" = "None" ]; then echo "Stack $STACK has no UserPoolId output" >&2; exit 1; fi

# Satisfies the pool policy (>= 8 chars, upper, lower, digit); generated locally with a CSPRNG.
TEMP_PASSWORD="$(python3 -c 'import secrets,string
a=string.ascii_letters+string.digits
print("".join(secrets.choice(a) for _ in range(14))+secrets.choice(string.ascii_uppercase)+secrets.choice(string.ascii_lowercase)+secrets.choice(string.digits))')"

aws cognito-idp admin-create-user \
  --user-pool-id "$POOL" \
  --username "$EMAIL" \
  --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
  --temporary-password "$TEMP_PASSWORD" \
  --message-action SUPPRESS \
  --query 'User.UserStatus' --output text >/dev/null

echo "Created $EMAIL"
echo "Temporary password (shown once, valid 7 days): $TEMP_PASSWORD"
echo "Sign in at $(stack_output AppUrl) and choose a new password."
