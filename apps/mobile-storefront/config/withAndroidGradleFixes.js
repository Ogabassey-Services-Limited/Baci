/**
 * Expo config plugin: Android Gradle fixes for AGP 9.x + RN 0.84
 *
 * Applies after `expo prebuild --clean` so native dirs are always correct:
 * 1. Removes kotlin-gradle-plugin classpath (built into AGP 9.x)
 * 2. Removes apply plugin "org.jetbrains.kotlin.android" (built into AGP 9.x)
 * 3. Changes proguard-android.txt → proguard-android-optimize.txt (AGP 9.x requirement)
 * 4. Bumps Gradle wrapper to 9.3.1 (minimum for AGP 9.x)
 * 5. Adds async-storage local maven repo
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
const {
  addAsyncStorageRepo,
  ensureGradleWrapperVersion,
  ensureReleaseSigning,
  fixProguardOptimize,
  removeKotlinAndroidPlugin,
  removeKotlinGradlePlugin,
} = require('../../../.github/scripts/expoAndroidGradleFixes');

function withAndroidGradleFixes(config) {
  // Fix root build.gradle
  const updatedConfig = withDangerousMod(config, [
    'android',
    (cfg) => {
      const rootBuildGradle = path.join(
        cfg.modRequest.platformProjectRoot,
        'build.gradle'
      );

      if (fs.existsSync(rootBuildGradle)) {
        let content = fs.readFileSync(rootBuildGradle, 'utf-8');

        // Remove kotlin-gradle-plugin classpath
        content = removeKotlinGradlePlugin(
          content,
          `failed to remove kotlin-gradle-plugin from ${rootBuildGradle}`
        );

        // Add async-storage local maven repo if not present
        const asyncStorageRepo =
          'maven { url "$rootDir/../../../node_modules/@react-native-async-storage/async-storage/android/local_repo" }';
        content = addAsyncStorageRepo(
          content,
          asyncStorageRepo,
          `failed to inject async-storage repo into ${rootBuildGradle}`
        );

        fs.writeFileSync(rootBuildGradle, content);
      }

      // Fix app/build.gradle
      const appBuildGradle = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'build.gradle'
      );

      if (fs.existsSync(appBuildGradle)) {
        let content = fs.readFileSync(appBuildGradle, 'utf-8');

        // Remove kotlin.android plugin
        content = removeKotlinAndroidPlugin(
          content,
          `failed to remove Kotlin Android plugin from ${appBuildGradle}`
        );

        // Fix proguard file name
        content = fixProguardOptimize(
          content,
          `failed to update Proguard optimize config in ${appBuildGradle}`
        );

        content = ensureReleaseSigning(content);

        fs.writeFileSync(appBuildGradle, content);
      }

      // Fix Gradle wrapper version
      const wrapperProps = path.join(
        cfg.modRequest.platformProjectRoot,
        'gradle',
        'wrapper',
        'gradle-wrapper.properties'
      );

      if (fs.existsSync(wrapperProps)) {
        let content = fs.readFileSync(wrapperProps, 'utf-8');
        content = ensureGradleWrapperVersion(content);
        fs.writeFileSync(wrapperProps, content);
      }

      return cfg;
    },
  ]);

  return updatedConfig;
}

module.exports = withAndroidGradleFixes;
