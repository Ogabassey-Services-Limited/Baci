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

exec "$root/ci_scripts/hook-bin/pnpm" "$@"
