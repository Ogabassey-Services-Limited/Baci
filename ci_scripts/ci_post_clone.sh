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
    Baci|BaciTheEcommerceBuilder)
      printf 'apps/mobile-admin\n'
      return
      ;;
    Ogabassey|OgabasseyEasybuyGadgets)
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

resolve_info_plist_path() {
  ios_dir_arg="${1:-}"
  app_dir_arg="${2:-}"

  if [ -z "$ios_dir_arg" ] || [ ! -d "$ios_dir_arg" ]; then
    echo "error: resolve_info_plist_path expected ios_dir to point to a readable iOS directory." >&2
    exit 1
  fi

  if [ -z "$app_dir_arg" ]; then
    echo "error: resolve_info_plist_path expected app_dir to be set before use." >&2
    exit 1
  fi

  case "${CI_XCODE_SCHEME:-}" in
    OgabasseyEasybuyGadgets)
      if [ -f "$ios_dir_arg/OgabasseyEasybuyGadgets/Info.plist" ]; then
        printf '%s\n' "$ios_dir_arg/OgabasseyEasybuyGadgets/Info.plist"
        return
      fi
      ;;
    Ogabassey)
      if [ -f "$ios_dir_arg/Ogabassey/Info.plist" ]; then
        printf '%s\n' "$ios_dir_arg/Ogabassey/Info.plist"
        return
      fi
      ;;
    BaciTheEcommerceBuilder)
      if [ -f "$ios_dir_arg/BaciTheEcommerceBuilder/Info.plist" ]; then
        printf '%s\n' "$ios_dir_arg/BaciTheEcommerceBuilder/Info.plist"
        return
      fi
      ;;
    Baci)
      if [ -f "$ios_dir_arg/Baci/Info.plist" ]; then
        printf '%s\n' "$ios_dir_arg/Baci/Info.plist"
        return
      fi
      ;;
  esac

  case "$app_dir_arg" in
    apps/mobile-storefront)
      for candidate in OgabasseyEasybuyGadgets/Info.plist Ogabassey/Info.plist; do
        if [ -f "$ios_dir_arg/$candidate" ]; then
          printf '%s\n' "$ios_dir_arg/$candidate"
          return
        fi
      done
      ;;
    apps/mobile-admin)
      for candidate in BaciTheEcommerceBuilder/Info.plist Baci/Info.plist; do
        if [ -f "$ios_dir_arg/$candidate" ]; then
          printf '%s\n' "$ios_dir_arg/$candidate"
          return
        fi
      done
      ;;
  esac

  echo "error: Unable to locate Info.plist for '$app_dir_arg' (scheme '${CI_XCODE_SCHEME:-<unset>}')." >&2
  exit 1
}

assert_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: Missing required command '$1'." >&2
    exit 1
  fi
}

provision_mobile_admin_google_service_info() {
  if [ "$app_dir" != "apps/mobile-admin" ]; then
    return
  fi

  google_service_info_path="$repo_root/$app_dir/GoogleService-Info.plist"
  if [ -f "$google_service_info_path" ]; then
    if [ -s "$google_service_info_path" ]; then
      echo "info: Using existing GoogleService-Info.plist"
      return
    fi
    echo "warning: Existing GoogleService-Info.plist is empty; regenerating." >&2
  fi

  encoded_google_service_info="${GOOGLE_SERVICE_INFO_PLIST_BASE64:-}"
  if [ -z "$encoded_google_service_info" ]; then
    echo "error: '$google_service_info_path' is missing and GOOGLE_SERVICE_INFO_PLIST_BASE64 is not set." >&2
    exit 1
  fi

  node -e "
    const fs = require('fs');
    const outputPath = process.argv[1];
    const encoded = process.env.GOOGLE_SERVICE_INFO_PLIST_BASE64 ?? '';
    if (!encoded.trim()) {
      console.error('error: GOOGLE_SERVICE_INFO_PLIST_BASE64 is empty.');
      process.exit(1);
    }
    fs.writeFileSync(outputPath, Buffer.from(encoded.trim(), 'base64'));
  " "$google_service_info_path"

  echo "info: Provisioned GoogleService-Info.plist from GOOGLE_SERVICE_INFO_PLIST_BASE64"
}

redact_url_credentials() {
  printf '%s' "$1" | sed -E 's#(https?://)[^/@]+@#\1***:***@#'
}

log_network_diagnostics() {
  echo "info: Network diagnostics before pod install"

  for proxy_var in HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy; do
    proxy_value="$(printenv "$proxy_var" 2>/dev/null || true)"
    if [ -n "$proxy_value" ]; then
      echo "info: $proxy_var=$(redact_url_credentials "$proxy_value")"
    else
      echo "info: $proxy_var=<unset>"
    fi
  done

  git_config_output="$(git config --show-origin --get-regexp 'url\\..*insteadof|http\\..*proxy|https\\..*proxy' 2>/dev/null || true)"
  if [ -n "$git_config_output" ]; then
    echo "info: Relevant git config entries:"
    printf '%s\n' "$git_config_output" | while IFS= read -r line; do
      echo "info: $(redact_url_credentials "$line")"
    done
  else
    echo "info: Relevant git config entries: none"
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

set +e
sh "$repo_root/ci_scripts/should_run_xcode_cloud.sh" "$app_dir"
path_filter_status="$?"
set -e

if [ "$path_filter_status" -ne 0 ]; then
  exit "$path_filter_status"
fi

install_node_if_missing
assert_command corepack
assert_command pod
assert_command python3

node_bin="$(command -v node)"
echo "info: Using node at '$node_bin'"

cd "$repo_root"
corepack enable
pnpm_spec="$(node -p "const pm=require('./package.json').packageManager || ''; if (!pm.startsWith('pnpm@')) { throw new Error('packageManager must start with pnpm@'); } pm")"
corepack prepare "$pnpm_spec" --activate
provision_mobile_admin_google_service_info
pnpm install --frozen-lockfile

escaped_node_bin="$(printf '%s' "$node_bin" | sed "s/'/'\"'\"'/g")"
printf "export NODE_BINARY='%s'\n" "$escaped_node_bin" > "$ios_dir/.xcode.env.local"
echo "info: Wrote '$ios_dir/.xcode.env.local'"

cd "$ios_dir"

# Pin CocoaPods to the same version used to generate Podfile.lock for
# reproducibility. Note: --deployment is NOT used because dynamic podspecs
# (e.g. react-native-webview) resolve differently during Expo autolinking,
# causing false-positive "changes to podfile" errors. Podfile.lock in VCS
# still ensures deterministic installs.
required_cocoapods_version="$(sed -n 's/^COCOAPODS: *//p' Podfile.lock 2>/dev/null || true)"

# Build a version-pinned pod command using the RubyGems _VERSION_ specifier so
# the exact CocoaPods gem is invoked even if a different version is pre-installed.
# Intentional word-splitting: "pod _1.16.2_" must expand to two words.
# SC2086 is suppressed at each $pod_cmd invocation site below.
if [ -n "$required_cocoapods_version" ]; then
  pod_cmd="pod _${required_cocoapods_version}_"
else
  pod_cmd="pod"
fi

if [ -n "$required_cocoapods_version" ]; then
  current_cocoapods_version="$(pod --version 2>/dev/null || true)"
  if [ "$current_cocoapods_version" != "$required_cocoapods_version" ]; then
    echo "info: Podfile.lock requires CocoaPods $required_cocoapods_version (current: ${current_cocoapods_version:-none})"
    echo "info: Installing CocoaPods $required_cocoapods_version via gem"
    gem install cocoapods -v "$required_cocoapods_version" --no-document
    # shellcheck disable=SC2086
    echo "info: CocoaPods $($pod_cmd --version) now active"
  else
    echo "info: CocoaPods $current_cocoapods_version matches Podfile.lock"
  fi
else
  echo "warning: Could not extract CocoaPods version from Podfile.lock (missing or malformed). Using system default: $(pod --version 2>/dev/null || echo 'none')." >&2
fi

# Xcode Cloud images may ship with a stale or partial CocoaPods trunk repo that
# prevents the CDN source from initialising ("Unable to add a source … named trunk").
# Removing it lets CocoaPods recreate it cleanly on the next run.
trunk_repo="${HOME}/.cocoapods/repos/trunk"
if [ -d "$trunk_repo" ]; then
  echo "info: Removing stale CocoaPods trunk repo at '$trunk_repo'"
  rm -rf "$trunk_repo"
fi

if [ "${CI_POD_ALLOW_REPO_UPDATE:-0}" = "1" ]; then
  log_network_diagnostics
  echo "info: Running pod install with repo updates enabled."
  # shellcheck disable=SC2086
  $pod_cmd install --repo-update
else
  log_network_diagnostics
  # shellcheck disable=SC2086
  $pod_cmd install --no-repo-update
fi

echo "info: CocoaPods installation finished for '$app_dir'"

# --- Resolve version metadata from Xcode Cloud / App Store Connect ---
# - CFBundleVersion comes from CI_BUILD_NUMBER.
# - CFBundleShortVersionString can be supplied explicitly via CI_MARKETING_VERSION.
# - Otherwise we resolve it from App Store Connect and the repo default to avoid
#   submitting builds to a closed marketing-version train.
if [ -n "${CI_BUILD_NUMBER:-}" ]; then
  plist_path="$(resolve_info_plist_path "$ios_dir" "$app_dir")"
  marketing_version="${CI_MARKETING_VERSION:-}"
  version_resolver="$repo_root/ci_scripts/resolve_app_store_marketing_version.py"

  if [ -z "$marketing_version" ]; then
    if [ ! -f "$version_resolver" ]; then
      echo "error: Marketing version resolver not found at '$version_resolver'." >&2
      exit 1
    fi
    marketing_version="$(python3 "$version_resolver" "$app_dir")"
    echo "info: Resolved CFBundleShortVersionString to '$marketing_version'"
  fi

  if [ -f "$plist_path" ]; then
    if ! printf '%s' "$CI_BUILD_NUMBER" | grep -Eq '^[1-9][0-9]*$'; then
      echo "error: CI_BUILD_NUMBER must be a positive integer. Got '$CI_BUILD_NUMBER'." >&2
      exit 1
    fi

    # Set CFBundleVersion (build number) to CI_BUILD_NUMBER.
    /usr/libexec/PlistBuddy -c "Set :CFBundleVersion \"${CI_BUILD_NUMBER}\"" "$plist_path"
    echo "info: Set CFBundleVersion to '$CI_BUILD_NUMBER'"

    if [ -n "$marketing_version" ]; then
      if printf '%s' "$marketing_version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
        if ! /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString \"${marketing_version}\"" "$plist_path" 2>/dev/null; then
          /usr/libexec/PlistBuddy -c "Add :CFBundleShortVersionString string \"${marketing_version}\"" "$plist_path"
        fi
        echo "info: Set CFBundleShortVersionString to '$marketing_version'"
      else
        echo "error: Invalid CI_MARKETING_VERSION '$marketing_version'. Expected format N.N.N." >&2
        exit 1
      fi
    else
      echo "warning: CI_MARKETING_VERSION is not set; keeping existing CFBundleShortVersionString." >&2
    fi
  else
    echo "warning: Info.plist not found at '$plist_path', skipping version bump."
  fi
fi
