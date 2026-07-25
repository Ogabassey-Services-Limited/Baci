#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: $0 <vercel-command> [args...]" >&2
  exit 64
fi

vercel_cli_version="${VERCEL_CLI_VERSION:-57.0.0}"
runner_temp="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
vercel_cli_dir="${VERCEL_CLI_DIR:-${runner_temp}/vercel-cli-${vercel_cli_version}}"
vercel_cli_store="${VERCEL_CLI_STORE:-${runner_temp}/vercel-cli-store-${vercel_cli_version}}"
vercel_bin="${vercel_cli_dir}/node_modules/.bin/vercel"

install_vercel_cli() {
  rm -rf "$vercel_cli_dir" "$vercel_cli_store"
  mkdir -p "$vercel_cli_dir" "$vercel_cli_store"

  cat > "${vercel_cli_dir}/package.json" <<JSON
{"private":true,"dependencies":{}}
JSON

  pnpm \
    --dir "$vercel_cli_dir" \
    add \
    --allow-build=esbuild \
    --reporter=append-only \
    --store-dir "$vercel_cli_store" \
    "vercel@${vercel_cli_version}"
}

if [ ! -x "$vercel_bin" ]; then
  install_vercel_cli
fi

exec "$vercel_bin" "$@"
