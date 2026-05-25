import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileAdminRoot = path.resolve(__dirname, '..');
const appsRoot = path.resolve(mobileAdminRoot, '..');

describe('mobile admin Android Gradle build config', () => {
  it('tracks the Firebase config outside generated native directories', () => {
    const googleServicesPath = path.join(
      appsRoot,
      'mobile-admin/google-services.json'
    );

    expect(existsSync(googleServicesPath)).toBe(true);

    const googleServices = JSON.parse(
      readFileSync(googleServicesPath, 'utf8')
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
    const gradleProperties = readFileSync(
      path.join(appsRoot, 'mobile-admin/android/gradle.properties'),
      'utf8'
    );
    const appBuildGradle = readFileSync(
      path.join(appsRoot, 'mobile-admin/android/app/build.gradle'),
      'utf8'
    );

    expect(gradleProperties).toContain('android.compileSdkVersion=36');
    expect(gradleProperties).toContain('android.targetSdkVersion=36');
    expect(gradleProperties).toContain('android.buildToolsVersion=36.0.0');
    expect(appBuildGradle).toContain('minSdkVersion rootProject.ext.minSdkVersion');
    expect(appBuildGradle).toContain('targetSdkVersion rootProject.ext.targetSdkVersion');
  });

  it('forces new-architecture autolinking to wait for library codegen artifacts', () => {
    const appBuildGradle = readFileSync(
      path.join(appsRoot, 'mobile-admin/android/app/build.gradle'),
      'utf8'
    );

    expect(appBuildGradle).toContain(
      'def autolinkingTask = tasks.named("generateAutolinkingNewArchitectureFiles").get()'
    );
    expect(appBuildGradle).toContain(
      'task.name == "generateCodegenArtifactsFromSchema" || task.name == "generateCodegenSchemaFromJavaScript"'
    );
    expect(appBuildGradle).toContain(
      'autolinkingTask.dependsOn(codegenTask)'
    );
  });
});
