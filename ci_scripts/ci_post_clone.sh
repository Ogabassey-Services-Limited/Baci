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

resolve_required_node_version() {
  nvmrc_path="$repo_root/.nvmrc"
  if [ -f "$nvmrc_path" ]; then
    required_from_nvmrc="$(tr -d '[:space:]' < "$nvmrc_path")"
    if [ -n "$required_from_nvmrc" ]; then
      printf '%s\n' "$required_from_nvmrc"
      return
    fi
  fi

  package_json_path="$repo_root/package.json"
  if [ -f "$package_json_path" ]; then
    required_from_engines="$(sed -n 's/^[[:space:]]*"node"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$package_json_path" | head -n 1)"
    if [ -n "$required_from_engines" ]; then
      printf '%s\n' "$required_from_engines"
      return
    fi
  fi

  echo "error: Unable to determine required Node.js version from .nvmrc or package.json engines.node." >&2
  exit 1
}

install_node_if_missing() {
  required_node_version="$(resolve_required_node_version)"

  if command -v node >/dev/null 2>&1; then
    echo "info: node already available at '$(command -v node)' ($(node --version)); required '$required_node_version'"
    return
  fi

  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "$HOME/.nvm/nvm.sh"
  fi

  if command -v nvm >/dev/null 2>&1; then
    echo "info: node not found — installing '$required_node_version' via nvm"
    nvm install "$required_node_version"
    nvm use "$required_node_version"
    hash -r
    assert_command node
    echo "info: Installed node $(node --version)"
    return
  fi

  required_major="$(printf '%s\n' "$required_node_version" | sed -E 's/^[^0-9]*([0-9]+).*/\1/')"
  if [ -z "$required_major" ]; then
    echo "error: Could not derive Node.js major version from '$required_node_version'." >&2
    exit 1
  fi

  echo "info: node not found — installing via Homebrew"
  assert_command brew
  export HOMEBREW_NO_AUTO_UPDATE="${HOMEBREW_NO_AUTO_UPDATE:-1}"
  brew_formula="node@$required_major"
  if brew info "$brew_formula" >/dev/null 2>&1; then
    brew install "$brew_formula"
    brew_prefix="$(brew --prefix "$brew_formula")"
  else
    echo "warning: Homebrew formula '$brew_formula' unavailable. Falling back to 'node'."
    brew install node
    brew_prefix="$(brew --prefix)"
  fi
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

# Xcode Cloud images may ship with a stale or partial CocoaPods trunk repo that
# prevents the CDN source from initialising ("Unable to add a source … named trunk").
# Removing it lets CocoaPods recreate it cleanly on the next run.
trunk_repo="${HOME}/.cocoapods/repos/trunk"
if [ -d "$trunk_repo" ]; then
  echo "info: Removing stale CocoaPods trunk repo at '$trunk_repo'"
  rm -rf "$trunk_repo"
fi

if [ "${CI_POD_ALLOW_REPO_UPDATE:-0}" = "1" ]; then
  echo "info: Running pod install with repo updates enabled."
  pod install --repo-update
else
  pod install --no-repo-update
fi

echo "info: CocoaPods installation finished for '$app_dir'"
