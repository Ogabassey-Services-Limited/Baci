#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

default_sdk_root() {
  case "$(uname -s)" in
    Darwin)
      printf '%s\n' "$HOME/Library/Android/sdk"
      ;;
    Linux)
      printf '%s\n' "$HOME/Android/Sdk"
      ;;
    MINGW* | MSYS* | CYGWIN*)
      if [[ -n "${LOCALAPPDATA:-}" ]]; then
        printf '%s\n' "${LOCALAPPDATA}\\Android\\Sdk"
      fi
      ;;
  esac
}

SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$(default_sdk_root)}}"
ADB="${SDK_ROOT}/platform-tools/adb"
ADB_SERIAL="${BACI_ANDROID_ADB_SERIAL:-emulator-5554}"
APK_PATH="${BACI_ANDROID_APK_PATH:-android/app/build/outputs/apk/debug/app-debug.apk}"

if [[ ! -x "$ADB" ]]; then
  echo "Android adb not found. Set ANDROID_SDK_ROOT or ANDROID_HOME, or install the Android SDK at $SDK_ROOT." >&2
  exit 1
fi

if [[ "$APK_PATH" != /* ]]; then
  APK_PATH="${APP_ROOT}/${APK_PATH}"
fi

if [[ ! -f "$APK_PATH" ]]; then
  echo "Android debug APK not found at $APK_PATH" >&2
  echo "Build it first with:" >&2
  echo "  cd \"${APP_ROOT}/android\" && ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain" >&2
  exit 1
fi

"$ADB" -s "$ADB_SERIAL" wait-for-device

if [[ "$("$ADB" -s "$ADB_SERIAL" shell echo ok | tr -d '\r\n ')" != "ok" ]]; then
  echo "Android adb shell is not responsive on $ADB_SERIAL." >&2
  exit 1
fi

"$ADB" -s "$ADB_SERIAL" install -r -d -t --no-streaming "$APK_PATH"

echo "Android debug APK installed on $ADB_SERIAL."
