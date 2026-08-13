#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: $0 <pnpm args...>" >&2
  exit 64
fi

root=$(git rev-parse --show-toplevel)
real_pnpm=$(command -v pnpm)

export BACI_REAL_PNPM="$real_pnpm"
export PATH="$root/ci_scripts/hook-bin:$PATH"

if sh "$root/ci_scripts/is-sparse-checkout.sh"; then
  # Turbo and nested `pnpm run` subprocesses resolve the real pnpm binary
  # directly, bypassing hook-bin. PNPM_CONFIG_* is the supported way to
  # propagate sparse-worktree settings into those child invocations.
  export PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
  export PNPM_CONFIG_ALLOW_UNUSED_PATCHES=true

  if [ ! -x "$root/node_modules/.bin/turbo" ]; then
    sh "$root/.github/scripts/pnpm-install-sparse-worktree.sh" --frozen-lockfile
  fi
fi

exec "$root/ci_scripts/hook-bin/pnpm" "$@"
