#!/bin/sh

set -eu

if [ -n "${CI_PRIMARY_REPOSITORY_PATH:-}" ]; then
  repo_root="$CI_PRIMARY_REPOSITORY_PATH"
else
  script_dir="$(cd "$(dirname "$0")" && pwd)"
  repo_root="$(cd "$script_dir/../../../.." && pwd)"
fi

exec "$repo_root/ci_scripts/ci_post_clone.sh" "apps/mobile-admin"
