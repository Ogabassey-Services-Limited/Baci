#!/bin/sh

set -eu

if [ -n "${CI_PRIMARY_REPOSITORY_PATH:-}" ]; then
  repo_root="$CI_PRIMARY_REPOSITORY_PATH"
else
  script_dir="$(cd "$(dirname "$0")" && pwd)"
  repo_root="$(cd "$script_dir/../../../.." && pwd)"
fi

# Default base for auto-generated marketing version: 1.1.<CI_BUILD_NUMBER>
# Override in Xcode Cloud with CI_MARKETING_VERSION_BASE or CI_MARKETING_VERSION.
export CI_MARKETING_VERSION_BASE="${CI_MARKETING_VERSION_BASE:-1.1}"

exec "$repo_root/ci_scripts/ci_post_clone.sh" "apps/mobile-storefront"
