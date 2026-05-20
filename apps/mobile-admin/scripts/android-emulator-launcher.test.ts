import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '../..');

describe('Android emulator launcher', () => {
  it('is the documented mobile-admin Android QA entrypoint', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(appRoot, 'package.json'), 'utf8')
    ) as { scripts?: Record<string, string> };
    const agents = readFileSync(path.join(appRoot, 'AGENTS.md'), 'utf8');
    const rootAgents = readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8');
    const claudeInstructions = readFileSync(
      path.join(repoRoot, 'CLAUDE.md'),
      'utf8'
    );
    const geminiInstructions = readFileSync(
      path.join(repoRoot, 'GEMINI.md'),
      'utf8'
    );
    const copilotInstructions = readFileSync(
      path.join(repoRoot, '.github/copilot-instructions.md'),
      'utf8'
    );
    const rulerAgents = readFileSync(
      path.join(repoRoot, '.ruler/AGENTS.md'),
      'utf8'
    );
    const rulerTesting = readFileSync(
      path.join(repoRoot, '.ruler/07-testing.md'),
      'utf8'
    );
    const readme = readFileSync(path.join(appRoot, 'README.md'), 'utf8');
    const debugManifest = readFileSync(
      path.join(appRoot, 'android/app/src/debug/AndroidManifest.xml'),
      'utf8'
    );
    const debugOptimizedManifest = readFileSync(
      path.join(
        appRoot,
        'android/app/src/debugOptimized/AndroidManifest.xml'
      ),
      'utf8'
    );
    const androidQaPlan = readFileSync(
      path.join(
        repoRoot,
        'docs/superpowers/plans/2026-05-10-branch-system-android-e2e-qa.md'
      ),
      'utf8'
    );
    const launcher = readFileSync(
      path.join(appRoot, 'scripts/launch-android-emulator.sh'),
      'utf8'
    );
    const debugApkInstaller = readFileSync(
      path.join(appRoot, 'scripts/install-android-debug.sh'),
      'utf8'
    );
    const devClientLauncher = readFileSync(
      path.join(appRoot, 'scripts/launch-android-dev-client.sh'),
      'utf8'
    );

    expect(packageJson.scripts?.['android:emulator']).toBe(
      'bash ./scripts/launch-android-emulator.sh'
    );
    expect(packageJson.scripts?.['android:install']).toBe(
      'bash ./scripts/install-android-debug.sh'
    );
    expect(packageJson.scripts?.['android:metro']).toBe(
      'expo start --dev-client --scheme baciadmin --host lan --port 8081'
    );
    expect(packageJson.scripts?.['android:launch']).toBe(
      'bash ./scripts/launch-android-dev-client.sh'
    );
    expect(agents).toContain('pnpm --filter baci-mobile-admin android:emulator');
    expect(agents).toContain('pnpm --filter baci-mobile-admin android:install');
    expect(agents).toContain('pnpm --filter baci-mobile-admin android:metro');
    expect(agents).toContain('pnpm --filter baci-mobile-admin android:launch');
    expect(rootAgents).toContain(
      'pnpm --filter baci-mobile-admin android:emulator'
    );
    expect(rootAgents).toContain(
      'pnpm --filter baci-mobile-admin android:install'
    );
    expect(rootAgents).toContain(
      'pnpm --filter baci-mobile-admin android:metro'
    );
    expect(rootAgents).toContain(
      'pnpm --filter baci-mobile-admin android:launch'
    );
    expect(claudeInstructions).toContain(
      'pnpm --filter baci-mobile-admin android:emulator'
    );
    expect(claudeInstructions).toContain(
      'pnpm --filter baci-mobile-admin android:install'
    );
    expect(claudeInstructions).toContain(
      'pnpm --filter baci-mobile-admin android:metro'
    );
    expect(claudeInstructions).toContain(
      'pnpm --filter baci-mobile-admin android:launch'
    );
    expect(geminiInstructions).toContain(
      'pnpm --filter baci-mobile-admin android:emulator'
    );
    expect(geminiInstructions).toContain(
      'pnpm --filter baci-mobile-admin android:install'
    );
    expect(geminiInstructions).toContain(
      'pnpm --filter baci-mobile-admin android:metro'
    );
    expect(geminiInstructions).toContain(
      'pnpm --filter baci-mobile-admin android:launch'
    );
    expect(copilotInstructions).toContain(
      'pnpm --filter baci-mobile-admin android:emulator'
    );
    expect(copilotInstructions).toContain(
      'pnpm --filter baci-mobile-admin android:install'
    );
    expect(copilotInstructions).toContain(
      'pnpm --filter baci-mobile-admin android:metro'
    );
    expect(copilotInstructions).toContain(
      'pnpm --filter baci-mobile-admin android:launch'
    );
    expect(rulerAgents).toContain(
      'pnpm --filter baci-mobile-admin android:emulator'
    );
    expect(rulerAgents).toContain(
      'pnpm --filter baci-mobile-admin android:install'
    );
    expect(rulerAgents).toContain(
      'pnpm --filter baci-mobile-admin android:metro'
    );
    expect(rulerAgents).toContain(
      'pnpm --filter baci-mobile-admin android:launch'
    );
    expect(rulerTesting).toContain(
      'pnpm --filter baci-mobile-admin android:emulator'
    );
    expect(rulerTesting).toContain(
      'pnpm --filter baci-mobile-admin android:install'
    );
    expect(rulerTesting).toContain(
      'pnpm --filter baci-mobile-admin android:metro'
    );
    expect(rulerTesting).toContain(
      'pnpm --filter baci-mobile-admin android:launch'
    );
    expect(readme).toContain('pnpm --filter baci-mobile-admin android:emulator');
    expect(readme).toContain('pnpm --filter baci-mobile-admin android:install');
    expect(readme).toContain('pnpm --filter baci-mobile-admin android:metro');
    expect(readme).toContain('pnpm --filter baci-mobile-admin android:launch');
    expect(androidQaPlan).toContain(
      'pnpm --filter baci-mobile-admin android:emulator'
    );
    expect(androidQaPlan).toContain(
      'pnpm --filter baci-mobile-admin android:install'
    );
    expect(androidQaPlan).toContain(
      'pnpm --filter baci-mobile-admin android:metro'
    );
    expect(androidQaPlan).toContain(
      'pnpm --filter baci-mobile-admin android:launch'
    );
    expect(androidQaPlan).not.toContain('"$EMULATOR" -avd');
    expect(androidQaPlan).not.toContain('shell am start -n "$ACTIVITY"');
    expect(launcher).toContain('BACI_ANDROID_GPU_MODE:-auto');
    expect(launcher).toContain(
      'BACI_ANDROID_AVD_NAME:-Baci_Pixel_9_Pro_XL_API_36_Google'
    );
    expect(launcher).toContain('BACI_ANDROID_PLATFORM_PACKAGE:-platforms;android-36');
    expect(launcher).toContain(
      'BACI_ANDROID_SYSTEM_IMAGE_PACKAGE:-system-images;android-36;google_apis;arm64-v8a'
    );
    expect(launcher).toContain('BACI_ANDROID_DEVICE_PROFILE:-pixel_9_pro_xl');
    expect(launcher).toContain('BACI_ANDROID_EMULATOR_PORT:-5554');
    expect(launcher).toContain('BACI_ANDROID_ADB_SERIAL:-emulator-${EMULATOR_PORT}');
    expect(launcher).toContain('BACI_ANDROID_MIN_EMULATOR_BUILD:-15261927');
    expect(launcher).toContain('BACI_ANDROID_BOOT_TIMEOUT_SECONDS:-420');
    expect(launcher).toContain('BACI_ANDROID_EMULATOR_MEMORY_MB:-4096');
    expect(launcher).toContain('BACI_ANDROID_EMULATOR_CORES:-2');
    expect(launcher).toContain('BACI_ANDROID_COLD_BOOT:-0');
    expect(launcher).toContain('BACI_ANDROID_SETTLE_TIMEOUT_SECONDS:-600');
    expect(launcher).toContain('BACI_ANDROID_SETTLE_LOAD_MAX:-8.0');
    expect(launcher).toContain('BACI_ANDROID_SETTLE_STABILITY_PROBES:-2');
    expect(launcher).toContain('BACI_ANDROID_METRO_PORT:-8081');
    expect(launcher).toContain('BACI_ANDROID_COLD_BOOT must be 0 or 1');
    expect(launcher).toContain('Required AVD');
    expect(launcher).toContain('sdkmanager --sdk_root=${SDK_ROOT}');
    expect(launcher).toContain('avdmanager create avd');
    expect(launcher).toContain('system-images;android-36;google_apis;arm64-v8a');
    expect(launcher).toContain('platforms;android-36');
    expect(launcher).toContain('pixel_9_pro_xl');
    expect(launcher).not.toContain('Baci_Pixel_9_API_35_ATD');
    expect(launcher).not.toContain('system-images;android-35;aosp_atd;arm64-v8a');
    expect(launcher).not.toContain('system-images;android-35;google_atd;arm64-v8a');
    expect(launcher).not.toContain('system-images;android-35;default;arm64-v8a');
    expect(launcher).not.toContain('system-images;android-36;default;arm64-v8a');
    expect(launcher).not.toContain('system-images;android-36.1');
    expect(launcher).toContain('Refusing -gpu swiftshader_indirect');
    expect(launcher).toContain('Android Emulator is too old');
    expect(launcher).toContain('shell echo ok');
    expect(launcher).toContain('export ANDROID_HOME="$SDK_ROOT"');
    expect(launcher).toContain('export ANDROID_SDK_ROOT="$SDK_ROOT"');
    expect(launcher).toContain('${SDK_ROOT}/platform-tools');
    expect(launcher).toContain('${SDK_ROOT}/emulator');
    expect(launcher).toContain('${SDK_ROOT}/cmdline-tools/latest/bin');
    expect(launcher).toContain("'-port'");
    expect(launcher).toContain('run_with_timeout');
    expect(launcher).toContain('BACI_ANDROID_ADB_STABILITY_PROBES:-3');
    expect(launcher).toContain('confirm_adb_shell_stable');
    expect(launcher).toContain('stabilize_android_system');
    expect(launcher).toContain('com.android.bluetooth');
    expect(launcher).not.toContain('com.android.phone');
    expect(launcher).toContain('com.android.launcher3');
    expect(launcher).toContain('com.android.quicksearchbox');
    expect(launcher).toContain('com.android.localtransport');
    expect(launcher).toContain('reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}"');
    expect(launcher).toContain('wait_for_android_settle');
    expect(launcher).toContain('cat /proc/loadavg');
    expect(launcher).toContain('cleanup_files=()');
    expect(launcher).toContain('if ((${#remaining[@]} == 0))');
    expect(launcher).toContain('trap cleanup EXIT');
    expect(launcher).toContain('python3 is required');
    expect(launcher).toContain('start_new_session=True');
    expect(launcher).toContain("emulator_args.append('-no-snapshot-load')");
    expect(launcher).not.toContain("'-no-snapshot'");
    expect(debugApkInstaller).toContain('BACI_ANDROID_ADB_SERIAL:-emulator-5554');
    expect(debugApkInstaller).toContain(
      'BACI_ANDROID_APK_PATH:-android/app/build/outputs/apk/debug/app-debug.apk'
    );
    expect(debugApkInstaller).toContain('default_sdk_root');
    expect(debugApkInstaller).toContain('uname -s');
    expect(debugApkInstaller).toContain('LOCALAPPDATA');
    expect(debugApkInstaller).toContain('cd \\"${APP_ROOT}/android\\"');
    expect(debugApkInstaller).toContain('shell echo ok');
    expect(debugApkInstaller).toContain('install -r -d -t --no-streaming');
    expect(debugApkInstaller).not.toContain('installDebug');
    expect(devClientLauncher).toContain('BACI_ANDROID_ADB_SERIAL:-emulator-5554');
    expect(devClientLauncher).toContain('BACI_ANDROID_APP_ID:-com.ogabassey.baci');
    expect(devClientLauncher).toContain('BACI_ANDROID_SCHEME:-baciadmin');
    expect(devClientLauncher).toContain('BACI_ANDROID_METRO_PORT:-8081');
    expect(devClientLauncher).toContain(
      'BACI_ANDROID_DEV_SERVER_URL:-http://10.0.2.2:${METRO_PORT}'
    );
    expect(devClientLauncher).toContain('BACI_ANDROID_LAUNCH_LOAD_MAX:-8.0');
    expect(devClientLauncher).toContain(
      'BACI_ANDROID_LAUNCH_AM_START_TIMEOUT_SECONDS:-20'
    );
    expect(devClientLauncher).toContain('BACI_ANDROID_FORCE_STOP:-1');
    expect(devClientLauncher).toContain('wait_for_adb_shell');
    expect(devClientLauncher).toContain('wait_for_android_settle');
    expect(devClientLauncher).toContain('ensure_metro_reverse');
    expect(devClientLauncher).toContain('reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}"');
    expect(devClientLauncher).toContain('expo-development-client');
    expect(devClientLauncher).toContain('android.intent.action.VIEW');
    expect(devClientLauncher).toContain('shell am start');
    expect(devClientLauncher).toContain(
      'run_with_timeout "$AM_START_TIMEOUT_SECONDS"'
    );
    expect(devClientLauncher).toContain('pidof -s "$APP_ID"');
    expect(devClientLauncher).toContain('raw adb launch commands');
    expect(debugManifest).toContain('firebase_messaging_auto_init_enabled');
    expect(debugManifest).toContain(
      'firebase_analytics_collection_enabled'
    );
    expect(debugOptimizedManifest).toContain(
      'firebase_messaging_auto_init_enabled'
    );
    expect(debugOptimizedManifest).toContain(
      'firebase_analytics_collection_enabled'
    );
  });
});
