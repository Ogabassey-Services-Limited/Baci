#!/bin/sh
# Warns when a mobile app's native dependencies may have changed
# but the corresponding Podfile.lock wasn't updated.

set -eu

apps="apps/mobile-admin apps/mobile-storefront"
warn=0

staged_files=$(git diff --cached --name-only 2>/dev/null || true)

for app in $apps; do
  app_name=$(basename "$app")
  pkg_changed=false
  podlock_changed=false

  # Check if package.json is staged
  echo "$staged_files" | grep -q "^${app}/package.json$" && pkg_changed=true

  # Check if Podfile.lock is staged
  echo "$staged_files" | grep -q "^${app}/ios/Podfile.lock$" && podlock_changed=true

  if [ "$pkg_changed" = true ] && [ "$podlock_changed" = false ]; then
    echo "warning: ${app_name}/package.json changed but ios/Podfile.lock was not updated."
    echo "  If you added/removed a native dependency, run:"
    echo "    cd ${app}/ios && pod install"
    echo "  Then stage the updated Podfile.lock."
    echo ""
    warn=1
  fi
done

if [ "$warn" = "1" ]; then
  # Exit 0 so the commit still goes through (it's a warning, not a blocker)
  echo "hint: Ignore this if your package.json change doesn't affect native deps."
fi

exit 0
