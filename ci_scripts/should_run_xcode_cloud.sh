#!/bin/sh

set -eu

app_dir="${1:-}"

if [ -z "$app_dir" ]; then
  echo "error: Expected app directory argument." >&2
  exit 1
fi

if [ "${CI_XCODE_CLOUD_FORCE_BUILD:-0}" = "1" ]; then
  echo "info: CI_XCODE_CLOUD_FORCE_BUILD=1, skipping changed-path filter."
  exit 0
fi

resolve_changed_files() {
  if [ -n "${CI_XCODE_CLOUD_CHANGED_FILES:-}" ]; then
    printf '%s\n' "$CI_XCODE_CLOUD_CHANGED_FILES"
    return
  fi

  if git rev-parse --verify HEAD^ >/dev/null 2>&1; then
    git diff --name-only --diff-filter=ACDMRTUXB HEAD^ HEAD
    return
  fi

  git ls-tree -r --name-only --full-tree HEAD
}

matches_relevant_path() {
  path="$1"

  case "$path" in
    ci_scripts/*|patches/*|package.json|pnpm-lock.yaml|pnpm-workspace.yaml|.nvmrc)
      return 0
      ;;
  esac

  case "$app_dir" in
    apps/mobile-storefront)
      case "$path" in
        apps/mobile-storefront/*|packages/shared/*)
          return 0
          ;;
      esac
      ;;
    apps/mobile-admin)
      case "$path" in
        apps/mobile-admin/*|packages/shared/*)
          return 0
          ;;
      esac
      ;;
  esac

  return 1
}

changed_files="$(resolve_changed_files)"

if [ -z "$changed_files" ]; then
  echo "info: No changed files detected, running workflow for safety."
  exit 0
fi

while IFS= read -r path; do
  if matches_relevant_path "$path"; then
    echo "info: Xcode Cloud workflow for '$app_dir' is relevant because '$path' changed."
    exit 0
  fi
done <<EOF
$changed_files
EOF

echo "info: Skipping Xcode Cloud workflow for '$app_dir' because HEAD does not touch relevant paths."
exit 10
