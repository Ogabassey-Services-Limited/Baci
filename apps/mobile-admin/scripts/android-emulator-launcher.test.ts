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
      'cd apps/mobile-admin/android && ./gradlew :app:assembleDebug'
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
    // Policy invariants the docs and error messages reference directly.
    expect(launcher).toContain('BACI_ANDROID_GPU_MODE:-auto');
    expect(launcher).toContain(
      'BACI_ANDROID_AVD_NAME:-Baci_Pixel_9_Pro_XL_API_36_Google'
    );
    expect(launcher).toContain('Refusing -gpu swiftshader_indirect');
    expect(debugApkInstaller).toContain('install -r -d -t --no-streaming');
    expect(debugApkInstaller).not.toContain('installDebug');
    expect(devClientLauncher).toContain('BACI_ANDROID_APP_ID:-com.ogabassey.baci');
    expect(devClientLauncher).toContain('BACI_ANDROID_SCHEME:-baciadmin');
    expect(devClientLauncher).toContain('BACI_ANDROID_METRO_PORT:-8081');

    // Parity contract: the admin launcher scripts are the storefront scripts
    // with only the app-identity tokens swapped. Any hardening applied to one
    // copy must be applied to both (PR #2951 follow-up). If this fails, port
    // the change to the other app instead of loosening the assertion.
    const storefrontScriptsRoot = path.join(
      repoRoot,
      'apps/mobile-storefront/scripts'
    );
    const adaptStorefrontScript = (content: string) =>
      content
        .replaceAll(
          '/tmp/baci-mobile-storefront-emulator.log',
          '/tmp/baci-mobile-admin-emulator.log'
        )
        .replaceAll('BACI_ANDROID_METRO_PORT:-8082', 'BACI_ANDROID_METRO_PORT:-8081')
        .replaceAll('mobile-storefront QA', 'mobile-admin QA')
        .replaceAll(
          'pnpm --filter @baci/mobile-storefront',
          'pnpm --filter baci-mobile-admin'
        )
        .replaceAll(
          'Launching mobile-storefront Android dev client',
          'Launching mobile-admin Android dev client'
        )
        .replaceAll(
          'BACI_ANDROID_APP_ID:-com.ogabassey.store',
          'BACI_ANDROID_APP_ID:-com.ogabassey.baci'
        )
        .replaceAll('BACI_ANDROID_SCHEME:-ogabassey', 'BACI_ANDROID_SCHEME:-baciadmin')
        .replaceAll(
          'Starting Android emulator for mobile-storefront',
          'Starting Android emulator for mobile-admin'
        );

    for (const [scriptName, adminContent] of [
      ['launch-android-emulator.sh', launcher],
      ['install-android-debug.sh', debugApkInstaller],
      ['launch-android-dev-client.sh', devClientLauncher],
    ] as const) {
      const storefrontContent = readFileSync(
        path.join(storefrontScriptsRoot, scriptName),
        'utf8'
      );
      expect(adminContent).toBe(adaptStorefrontScript(storefrontContent));
    }

    // The shared helper libraries must be byte-identical across the two apps.
    for (const libName of ['android-common.sh', 'timeout.sh']) {
      const adminLib = readFileSync(
        path.join(appRoot, 'scripts/lib', libName),
        'utf8'
      );
      const storefrontLib = readFileSync(
        path.join(storefrontScriptsRoot, 'lib', libName),
        'utf8'
      );
      expect(adminLib).toBe(storefrontLib);
    }

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
