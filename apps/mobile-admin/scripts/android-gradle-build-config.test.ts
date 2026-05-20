import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileAdminRoot = path.resolve(__dirname, '..');
const appsRoot = path.resolve(mobileAdminRoot, '..');

describe('mobile admin Android Gradle build config', () => {
  it('tracks a debug Firebase config in the native app search path', () => {
    const debugGoogleServicesPath = path.join(
      appsRoot,
      'mobile-admin/android/app/src/debug/google-services.json'
    );

    expect(existsSync(debugGoogleServicesPath)).toBe(true);

    const googleServices = JSON.parse(
      readFileSync(debugGoogleServicesPath, 'utf8')
    );
    expect(
      googleServices.client[0].client_info.android_client_info.package_name
    ).toBe('com.ogabassey.baci');
  });

  it('normalizes and raises library minSdk values to the React Native floor', () => {
    const sdkDefaults = readFileSync(
      path.join(appsRoot, 'android-sdk-defaults.gradle'),
      'utf8'
    );

    expect(sdkDefaults).toContain('def toSdkInt');
    expect(sdkDefaults).toContain('currentMinSdkVersion < minSdkVersion');
    expect(sdkDefaults).toContain('android.defaultConfig.minSdk = minSdkVersion');
  });

  it('declares the React Native Android SDK floor before third-party modules evaluate', () => {
    const androidBuildGradle = readFileSync(
      path.join(appsRoot, 'mobile-admin/android/build.gradle'),
      'utf8'
    );
    const sdkFloorIndex = androidBuildGradle.indexOf('minSdkVersion = 24');
    const expoRootPluginIndex = androidBuildGradle.indexOf(
      'apply plugin: "expo-root-project"'
    );

    expect(sdkFloorIndex).toBeGreaterThanOrEqual(0);
    expect(expoRootPluginIndex).toBeGreaterThanOrEqual(0);
    expect(sdkFloorIndex).toBeLessThan(expoRootPluginIndex);
    expect(androidBuildGradle).toContain('compileSdkVersion = 36');
    expect(androidBuildGradle).toContain('targetSdkVersion = 36');
  });

  it('forces new-architecture autolinking to wait for library codegen artifacts', () => {
    const appBuildGradle = readFileSync(
      path.join(appsRoot, 'mobile-admin/android/app/build.gradle'),
      'utf8'
    );

    expect(appBuildGradle).toContain(
      'def autolinkingTaskProvider = tasks.named("generateAutolinkingNewArchitectureFiles")'
    );
    expect(appBuildGradle).toContain(
      'task.name == "generateCodegenArtifactsFromSchema" || task.name == "generateCodegenSchemaFromJavaScript"'
    );
    expect(appBuildGradle).toContain(
      'autolinkingTaskProvider.configure { dependsOn(codegenTask) }'
    );
  });
});
