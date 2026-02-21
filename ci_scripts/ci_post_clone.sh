#!/bin/sh

set -eu

resolve_repo_root() {
  if [ -n "${CI_PRIMARY_REPOSITORY_PATH:-}" ]; then
    printf '%s\n' "$CI_PRIMARY_REPOSITORY_PATH"
    return
  fi

  script_dir="$(cd "$(dirname "$0")" && pwd)"
  printf '%s\n' "$(cd "$script_dir/.." && pwd)"
}

resolve_app_dir() {
  if [ -n "${1:-}" ]; then
    printf '%s\n' "$1"
    return
  fi

  case "${CI_XCODE_SCHEME:-}" in
    Baci)
      printf 'apps/mobile-admin\n'
      return
      ;;
    Ogabassey)
      printf 'apps/mobile-storefront\n'
      return
      ;;
  esac

  case "${CI_PRODUCT:-}" in
    *mobile-admin*)
      printf 'apps/mobile-admin\n'
      return
      ;;
    *mobile-storefront*)
      printf 'apps/mobile-storefront\n'
      return
      ;;
  esac

  echo "error: Unable to infer app directory from CI metadata." >&2
  echo "error: CI_XCODE_SCHEME='${CI_XCODE_SCHEME:-<unset>}' CI_PRODUCT='${CI_PRODUCT:-<unset>}'" >&2
  exit 1
}

assert_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: Missing required command '$1'." >&2
    exit 1
  fi
}

repo_root="$(resolve_repo_root)"
app_dir="$(resolve_app_dir "${1:-}")"
ios_dir="$repo_root/$app_dir/ios"

if [ ! -d "$ios_dir" ]; then
  echo "error: iOS directory not found at '$ios_dir'." >&2
  exit 1
fi

echo "info: Xcode Cloud bootstrap for '$app_dir'"
echo "info: Repository root '$repo_root'"

assert_command node
assert_command corepack
assert_command pod

node_bin="$(command -v node)"
echo "info: Using node at '$node_bin'"

cd "$repo_root"
corepack enable
pnpm_spec="$(node -p "const pm=require('./package.json').packageManager || ''; if (!pm.startsWith('pnpm@')) { throw new Error('packageManager must start with pnpm@'); } pm")"
corepack prepare "$pnpm_spec" --activate
pnpm install --frozen-lockfile

printf 'export NODE_BINARY="%s"\n' "$node_bin" > "$ios_dir/.xcode.env.local"
echo "info: Wrote '$ios_dir/.xcode.env.local'"

cd "$ios_dir"
if [ "${CI_POD_ALLOW_REPO_UPDATE:-0}" = "1" ]; then
  echo "info: Running pod install with repo updates enabled."
  pod install
else
  pod install --no-repo-update --deployment
fi

echo "info: CocoaPods installation finished for '$app_dir'"
