import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const reactNativeAndroidRoot = path.resolve(
  __dirname,
  '../../../node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react'
);
const androidSettingsPath = path.resolve(
  __dirname,
  '../android/settings.gradle'
);
const reactNativeAndroidBuildPath = path.resolve(
  __dirname,
  '../../../node_modules/react-native/ReactAndroid/build.gradle.kts'
);

function readReactNativeSource(relativePath: string) {
  return readFileSync(path.join(reactNativeAndroidRoot, relativePath), 'utf8');
}

describe('mobile admin Android edge-to-edge dependency guard', () => {
  it('compiles the patched React Native source instead of the prebuilt AAR', () => {
    const settingsGradle = readFileSync(androidSettingsPath, 'utf8');

    expect(settingsGradle).toContain(
      'substitute(module("com.facebook.react:react-android"))'
    );
    expect(settingsGradle).toContain(
      'project(":packages:react-native:ReactAndroid")'
    );
  });

  it('keeps Hermes precompiled while React Native is built from source', () => {
    const reactNativeBuild = readFileSync(reactNativeAndroidBuildPath, 'utf8');

    expect(reactNativeBuild).toContain(
      'compileOnly("com.facebook.hermes:hermes-android:250829098.0.14")'
    );
    expect(reactNativeBuild).not.toContain(
      'compileOnly(project(":packages:react-native:ReactAndroid:hermes-engine"))'
    );
  });

  it('removes deprecated status-bar color APIs from React Native bytecode inputs', () => {
    const statusBarModule = readReactNativeSource(
      'modules/statusbar/StatusBarModule.kt'
    );

    expect(statusBarModule).not.toContain('statusBarColor');
  });

  it('removes deprecated system-bar colors and cutout modes from WindowUtil', () => {
    const windowUtil = readReactNativeSource('views/view/WindowUtil.kt');

    for (const deprecatedToken of [
      'statusBarColor',
      'navigationBarColor',
      'LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES',
      'LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT',
    ]) {
      expect(windowUtil).not.toContain(deprecatedToken);
    }
  });
});
