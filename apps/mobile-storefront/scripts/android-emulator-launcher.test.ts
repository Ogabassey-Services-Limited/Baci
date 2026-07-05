import { readFileSync } from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(__dirname, '..');

describe('Android emulator launcher (storefront)', () => {
  const packageJson = JSON.parse(
    readFileSync(path.join(appRoot, 'package.json'), 'utf8')
  ) as { scripts?: Record<string, string> };
  const launcher = readFileSync(
    path.join(appRoot, 'scripts/launch-android-emulator.sh'),
    'utf8'
  );
  const timeoutHelpers = readFileSync(
    path.join(appRoot, 'scripts/lib/timeout.sh'),
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

  it('wires the four android QA entrypoints in package.json', () => {
    expect(packageJson.scripts?.['android:emulator']).toBe(
      'bash ./scripts/launch-android-emulator.sh'
    );
    expect(packageJson.scripts?.['android:install']).toBe(
      'bash ./scripts/install-android-debug.sh'
    );
    expect(packageJson.scripts?.['android:metro']).toBe(
      "NODE_OPTIONS='--no-warnings --import tsx' expo start --dev-client --scheme ogabassey --host lan --port 8082"
    );
    expect(packageJson.scripts?.['android:launch']).toBe(
      'bash ./scripts/launch-android-dev-client.sh'
    );
  });

  it('keeps the emulator launcher on the shared AVD with safe GPU and boot policy', () => {
    expect(launcher).toContain(
      'BACI_ANDROID_AVD_NAME:-Baci_Pixel_9_Pro_XL_API_36_Google'
    );
    expect(launcher).toContain('BACI_ANDROID_GPU_MODE:-auto');
    expect(launcher).toContain('Refusing -gpu swiftshader_indirect');
    expect(launcher).toContain(
      'BACI_ANDROID_SYSTEM_IMAGE_PACKAGE:-system-images;android-36;google_apis;arm64-v8a'
    );
    expect(launcher).toContain('BACI_ANDROID_EMULATOR_PORT:-5554');
    expect(launcher).toContain('BACI_ANDROID_EMULATOR_MEMORY_MB:-4096');
    expect(launcher).toContain('BACI_ANDROID_EMULATOR_CORES:-2');
    expect(launcher).toContain('default_sdk_root');
    expect(launcher).toContain('$HOME/Android/Sdk');
    expect(launcher).toContain('source "${SCRIPT_DIR}/lib/timeout.sh"');
    expect(launcher).toContain('remove_stale_avd_locks');
    expect(launcher).toContain('confirm_adb_shell_stable');
    expect(launcher).toContain('stabilize_android_system');
    expect(launcher).toContain('wait_for_android_settle');
    expect(launcher).toContain('trap cleanup EXIT');
  });

  it('targets storefront Metro port and log file in the emulator launcher', () => {
    expect(launcher).toContain('BACI_ANDROID_METRO_PORT:-8082');
    expect(launcher).toContain('baci-mobile-storefront-emulator.log');
    expect(launcher).toContain('dedicated Baci QA AVD');
    expect(launcher).toContain('terminate_process_group "$emulator_pid"');
    expect(launcher).toContain('kill -- "-${process_pid}"');
    expect(launcher).toContain(
      'pnpm --filter @baci/mobile-storefront android:emulator'
    );
    expect(launcher).not.toContain('baci-mobile-admin');
  });

  it('installs the debug APK with the non-streaming flags and boot checks', () => {
    expect(debugApkInstaller).toContain(
      'BACI_ANDROID_APK_PATH:-android/app/build/outputs/apk/debug/app-debug.apk'
    );
    expect(debugApkInstaller).toContain('getprop sys.boot_completed');
    expect(debugApkInstaller).toContain('install -r -d -t --no-streaming');
    expect(debugApkInstaller).toContain('BACI_ANDROID_ADB_INSTALL_TIMEOUT_SECONDS:-120');
    expect(debugApkInstaller).toContain(
      'run_with_timeout "$ADB_INSTALL_TIMEOUT_SECONDS" "$ADB" -s "$ADB_SERIAL" install'
    );
    expect(debugApkInstaller).not.toContain('installDebug');
    expect(debugApkInstaller).toContain(
      'pnpm --filter @baci/mobile-storefront android:emulator'
    );
  });

  it('launches the dev client with storefront app id, scheme, and Metro reverse', () => {
    expect(devClientLauncher).toContain(
      'BACI_ANDROID_APP_ID:-com.ogabassey.store'
    );
    expect(devClientLauncher).toContain('BACI_ANDROID_SCHEME:-ogabassey');
    expect(devClientLauncher).toContain('BACI_ANDROID_METRO_PORT:-8082');
    expect(devClientLauncher).toContain('BACI_ANDROID_EMULATOR_PORT:-5554');
    expect(devClientLauncher).toContain(
      'ADB_SERIAL="${BACI_ANDROID_ADB_SERIAL:-emulator-${EMULATOR_PORT}}"'
    );
    expect(devClientLauncher).toContain('default_sdk_root');
    expect(devClientLauncher).toContain('$HOME/Android/Sdk');
    expect(devClientLauncher).toContain(
      'source "${SCRIPT_DIR}/lib/timeout.sh"'
    );
    expect(devClientLauncher).toContain(
      'BACI_ANDROID_DEV_SERVER_URL:-http://10.0.2.2:${METRO_PORT}'
    );
    expect(devClientLauncher).toContain('expo-development-client');
    expect(devClientLauncher).toContain('ensure_metro_reverse');
    expect(devClientLauncher).toContain('pidof -s "$APP_ID"');
    expect(devClientLauncher).not.toContain('com.ogabassey.baci');
  });

  it('uses shared timeout helpers that terminate stalled child process groups', () => {
    expect(timeoutHelpers).toContain('start_new_session=True');
    expect(timeoutHelpers).toContain('os.killpg(process.pid, signal.SIGTERM)');
    expect(timeoutHelpers).toContain('os.killpg(process.pid, signal.SIGKILL)');
    expect(timeoutHelpers).toContain('sys.exit(124)');
    expect(timeoutHelpers).toContain('capture_with_timeout()');
    expect(launcher).not.toContain('run_with_timeout()');
    expect(devClientLauncher).not.toContain('run_with_timeout()');
  });

  it('bounds dev-client adb probes through the shared timeout helper', () => {
    expect(devClientLauncher).toContain(
      'run_with_timeout 5 "$ADB" -s "$ADB_SERIAL" shell getprop sys.boot_completed'
    );
    expect(devClientLauncher).toContain(
      'run_with_timeout 5 "$ADB" -s "$ADB_SERIAL" shell echo ok'
    );
    expect(devClientLauncher).toContain(
      'run_with_timeout 5 "$ADB" -s "$ADB_SERIAL" shell cat /proc/loadavg'
    );
    expect(devClientLauncher).toContain(
      'run_with_timeout 5 "$ADB" -s "$ADB_SERIAL" shell pidof -s "$APP_ID"'
    );
    expect(devClientLauncher).toContain(
      'run_with_timeout "$REVERSE_TIMEOUT_SECONDS" "$ADB" -s "$ADB_SERIAL" reverse'
    );
  });
});
