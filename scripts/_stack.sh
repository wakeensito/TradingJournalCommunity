# shellcheck shell=bash
# Shared helpers for scripts/*.sh (sourced, not executed). Default AWS profile ONLY.

STACK="${STACK:-tradejournal}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"

require_default_profile() {
  if [ -n "${AWS_PROFILE:-}" ] && [ "${AWS_PROFILE}" != "default" ]; then
    echo "Refusing to run with AWS_PROFILE=${AWS_PROFILE}: this project deploys with the default profile only." >&2
    echo "Run: unset AWS_PROFILE" >&2
    exit 1
  fi
}

# stack_output <OutputKey>
stack_output() {
  aws cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
