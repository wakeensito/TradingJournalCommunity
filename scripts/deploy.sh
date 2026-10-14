#!/usr/bin/env bash
# Build + deploy the SAM stack, then build the SPA, write its runtime config.json and publish it.
# Default AWS profile only. Used locally and by .github/workflows/deploy.yml (OIDC credentials).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/_stack.sh
source "$ROOT/scripts/_stack.sh"
require_default_profile
cd "$ROOT"

echo "==> sam build"
sam build
echo "==> sam deploy (stack $STACK, $AWS_REGION)"
sam deploy --no-confirm-changeset --no-fail-on-empty-changeset

WEB="$(stack_output WebBucketName)"
DIST="$(stack_output DistributionId)"
APP_URL="$(stack_output AppUrl)"
POOL="$(stack_output UserPoolId)"
CLIENT="$(stack_output UserPoolClientId)"
REGION="$(stack_output Region)"
for v in WEB DIST APP_URL POOL CLIENT REGION; do
  if [ -z "${!v}" ] || [ "${!v}" = "None" ]; then echo "Missing stack output for $v" >&2; exit 1; fi
done

echo "==> build SPA"
(cd frontend && npm ci && npm run build)

cat > frontend/dist/config.json <<JSON
{"region":"$REGION","userPoolId":"$POOL","clientId":"$CLIENT","apiBase":"/api"}
JSON

echo "==> publish SPA to s3://$WEB"
# 1) Hashed assets first (immutable), without pruning, so clients on the old index.html keep working.
if [ -d frontend/dist/assets ]; then
  aws s3 sync frontend/dist/assets "s3://$WEB/assets" \
    --cache-control "public, max-age=31536000, immutable"
fi
# 2) Everything else (index.html, config.json, sw.js, manifest, icons) must revalidate every time.
aws s3 sync frontend/dist "s3://$WEB" --delete --exclude "assets/*" \
  --cache-control "no-cache, no-store, must-revalidate"
# 3) Prune assets no longer referenced by this build.
if [ -d frontend/dist/assets ]; then
  aws s3 sync frontend/dist/assets "s3://$WEB/assets" --delete \
    --cache-control "public, max-age=31536000, immutable"
fi

echo "==> invalidate CloudFront $DIST"
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/*" --query 'Invalidation.Id' --output text

echo "Deployed: $APP_URL"
