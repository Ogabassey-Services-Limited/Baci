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

  # CI_PRODUCT is not guaranteed to contain repository paths in Xcode Cloud.
  # Treat this as a best-effort fallback only; scheme routing above is authoritative.
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

install_node_if_missing() {
  if command -v node >/dev/null 2>&1; then
    echo "info: node already available at '$(command -v node)'"
    return
  fi

  echo "info: node not found — installing via Homebrew"
  assert_command brew
  brew install node
  brew_prefix="$(brew --prefix)"
  PATH="$brew_prefix/bin:$PATH"
  export PATH
  assert_command node
  echo "info: Installed node $(node --version)"
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

install_node_if_missing
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

escaped_node_bin="$(printf '%s' "$node_bin" | sed "s/'/'\"'\"'/g")"
printf "export NODE_BINARY='%s'\n" "$escaped_node_bin" > "$ios_dir/.xcode.env.local"
echo "info: Wrote '$ios_dir/.xcode.env.local'"

cd "$ios_dir"
pod install --no-repo-update --deployment

echo "info: CocoaPods installation finished for '$app_dir'"
