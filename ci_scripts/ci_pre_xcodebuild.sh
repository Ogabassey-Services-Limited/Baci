#!/bin/sh

set -eu

resolve_marketing_version_script() {
  if [ -n "${CI_PRIMARY_REPOSITORY_PATH:-}" ]; then
    printf '%s\n' "$CI_PRIMARY_REPOSITORY_PATH/ci_scripts/resolve_app_store_marketing_version.py"
    return
  fi

  script_dir="$(cd "$(dirname "$0")" && pwd)"
  printf '%s\n' "$script_dir/resolve_app_store_marketing_version.py"
}

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

resolve_existing_path() {
  while [ "$#" -gt 0 ]; do
    candidate="$1"
    shift
    if [ -f "$repo_root/$candidate" ]; then
      printf '%s\n' "$candidate"
      return
    fi
  done

  echo "error: Unable to locate an expected project file in '$repo_root'." >&2
  exit 1
}

resolve_version_files() {
  app_dir_arg="$1"

  case "$app_dir_arg" in
    apps/mobile-storefront)
      project_pbxproj="$(resolve_existing_path \
        'apps/mobile-storefront/ios/OgabasseyEasybuyGadgets.xcodeproj/project.pbxproj' \
        'apps/mobile-storefront/ios/Ogabassey.xcodeproj/project.pbxproj')"
      info_plist="$(resolve_existing_path \
        'apps/mobile-storefront/ios/OgabasseyEasybuyGadgets/Info.plist' \
        'apps/mobile-storefront/ios/Ogabassey/Info.plist')"
      ;;
    apps/mobile-admin)
      project_pbxproj="$(resolve_existing_path \
        'apps/mobile-admin/ios/Baci.xcodeproj/project.pbxproj')"
      info_plist="$(resolve_existing_path \
        'apps/mobile-admin/ios/Baci/Info.plist' \
        'apps/mobile-admin/ios/BaciTheEcommerceBuilder/Info.plist')"
      ;;
    *)
      echo "error: Unsupported app directory '$app_dir_arg'." >&2
      exit 1
      ;;
  esac

  printf '%s\n' "$project_pbxproj"
  printf '%s\n' "$info_plist"
}

assert_readable_file() {
  path="$1"
  label="$2"

  if [ ! -f "$path" ]; then
    echo "error: ${label} not found at '$path'." >&2
    exit 1
  fi
}

assert_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: Missing required command '$1'." >&2
    exit 1
  fi
}

assert_numeric() {
  value="$1"
  label="$2"

  case "$value" in
    ''|*[!0-9]*)
      echo "error: ${label} must contain digits only. Received '$value'." >&2
      exit 1
      ;;
  esac
}

validate_marketing_version() {
  value="$1"
  if ! printf '%s' "$value" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "error: CI_MARKETING_VERSION must use numeric semantic format (example: 1.4.1)." >&2
    exit 1
  fi
}

replace_build_setting() {
  pbxproj="$1"
  key="$2"
  value="$3"

  if ! grep -q "${key} =" "$pbxproj"; then
    echo "error: '${key}' not found in '$pbxproj'." >&2
    exit 1
  fi

  perl -0pi -e "s/${key}\\s*=\\s*[^;]+;/${key} = ${value};/g" "$pbxproj"
}

set_plist_value() {
  plist_path="$1"
  key="$2"
  value="$3"

  if /usr/libexec/PlistBuddy -c "Set :${key} ${value}" "$plist_path" >/dev/null 2>&1; then
    return
  fi

  /usr/libexec/PlistBuddy -c "Add :${key} string ${value}" "$plist_path" >/dev/null
}

repo_root="$(resolve_repo_root)"
app_dir="$(resolve_app_dir "${1:-}")"
build_number="${CI_BUILD_NUMBER:-}"
marketing_version="${CI_MARKETING_VERSION:-}"

assert_command grep
assert_command perl
assert_command sed
assert_command python3

if [ ! -x /usr/libexec/PlistBuddy ]; then
  echo "error: /usr/libexec/PlistBuddy is required but not executable." >&2
  exit 1
fi

if [ -z "$build_number" ]; then
  echo "error: CI_BUILD_NUMBER is required for iOS versioning in Xcode Cloud." >&2
  exit 1
fi

assert_numeric "$build_number" "CI_BUILD_NUMBER"

if [ -z "$marketing_version" ]; then
  version_resolver="$(resolve_marketing_version_script)"
  assert_readable_file "$version_resolver" "Marketing version resolver"
  marketing_version="$(python3 "$version_resolver" "$app_dir")"
  echo "info: CI_MARKETING_VERSION is unset. Resolved '$marketing_version' for '$app_dir'."
fi

validate_marketing_version "$marketing_version"

paths="$(resolve_version_files "$app_dir")"
project_pbxproj="$(printf '%s\n' "$paths" | sed -n '1p')"
info_plist="$(printf '%s\n' "$paths" | sed -n '2p')"

project_pbxproj="$repo_root/$project_pbxproj"
info_plist="$repo_root/$info_plist"

assert_readable_file "$project_pbxproj" "Project file"
assert_readable_file "$info_plist" "Info.plist"

echo "info: Applying Xcode Cloud versioning for '$app_dir'"
echo "info: CI_BUILD_NUMBER='$build_number'"

replace_build_setting "$project_pbxproj" "CURRENT_PROJECT_VERSION" "$build_number"
set_plist_value "$info_plist" "CFBundleVersion" "$build_number"

echo "info: CI_MARKETING_VERSION='$marketing_version'"
replace_build_setting "$project_pbxproj" "MARKETING_VERSION" "$marketing_version"
set_plist_value "$info_plist" "CFBundleShortVersionString" "$marketing_version"

echo "info: Versioning step completed"
