#!/usr/bin/env bash
# Local dev: write frontend/public/config.json (gitignored) and frontend/.env.local (VITE_API_ORIGIN) from
# the deployed stack, so `npm run dev` signs in against the real pool and proxies /api to CloudFront.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/_stack.sh
source "$ROOT/scripts/_stack.sh"
require_default_profile

APP_URL="$(stack_output AppUrl)"
POOL="$(stack_output UserPoolId)"
CLIENT="$(stack_output UserPoolClientId)"
REGION="$(stack_output Region)"
for v in APP_URL POOL CLIENT REGION; do
  if [ -z "${!v}" ] || [ "${!v}" = "None" ]; then echo "Missing stack output for $v (deploy first)" >&2; exit 1; fi
done

mkdir -p "$ROOT/frontend/public"
cat > "$ROOT/frontend/public/config.json" <<JSON
{"region":"$REGION","userPoolId":"$POOL","clientId":"$CLIENT","apiBase":"/api"}
JSON
echo "VITE_API_ORIGIN=$APP_URL" > "$ROOT/frontend/.env.local"

echo "Wrote frontend/public/config.json and frontend/.env.local (VITE_API_ORIGIN=$APP_URL)"
