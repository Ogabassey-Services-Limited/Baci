/**
 * Expo config plugin: Android Gradle fixes for AGP 9.x + RN 0.85
 *
 * Applies after `expo prebuild --clean` so native dirs are always correct:
 * 1. Removes kotlin-gradle-plugin classpath (built into AGP 9.x)
 * 2. Keeps apply plugin "org.jetbrains.kotlin.android" for Kotlin compilation
 * 3. Changes proguard-android.txt → proguard-android-optimize.txt (AGP 9.x requirement)
 * 4. Bumps Gradle wrapper to 9.3.1 (minimum for AGP 9.x)
 * 5. Adds async-storage local maven repo
 */
const { withDangerousMod, withFinalizedMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
const {
  addAsyncStorageRepo,
  ensureGradleProperty,
  ensureMergedJvmArgs,
  ensureGradleWrapperVersion,
  ensureReleaseSigning,
  fixProguardOptimize,
  removeKotlinGradlePlugin,
} = require('../../../.github/scripts/expoAndroidGradleFixes');

const {
  ensureFinalizedPostHogAndroidUploadBestEffort,
  ensurePostHogAndroidUploadBestEffort,
} = require('./withAndroidGradleFixes.posthog');
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

        // Keep kotlin.android plugin for compilation of MainApplication/MainActivity
        // (Removing it disables Kotlin compilation, causing ClassNotFoundException on MainApplication)

        // Fix proguard file name
        content = fixProguardOptimize(
          content,
          `failed to update Proguard optimize config in ${appBuildGradle}`
        );

        content = ensureReleaseSigning(content);
        content = ensurePostHogAndroidUploadBestEffort(content);

        // Dynamically inject Facebook SDK resource entries to avoid hardcoding secrets in VCS
        if (!content.includes('resValue "string", "facebook_app_id"')) {
          const searchStr = 'defaultConfig {';
          const index = content.indexOf(searchStr);
          if (index !== -1) {
            const insertIndex = index + searchStr.length;
            const resValues = `
        def storefrontFacebookAppId = System.getenv("STOREFRONT_FACEBOOK_APP_ID") ?: ""
        def storefrontFacebookClientToken = System.getenv("STOREFRONT_FACEBOOK_CLIENT_TOKEN") ?: ""
        if ((storefrontFacebookAppId && !storefrontFacebookClientToken) || (!storefrontFacebookAppId && storefrontFacebookClientToken)) {
            throw new GradleException("STOREFRONT_FACEBOOK_APP_ID and STOREFRONT_FACEBOOK_CLIENT_TOKEN must be configured together.")
        }
        resValue "string", "facebook_app_id", storefrontFacebookAppId
        resValue "string", "facebook_client_token", storefrontFacebookClientToken
        resValue "string", "fb_login_protocol_scheme", storefrontFacebookAppId ? "fb" + storefrontFacebookAppId : "fb_local_dev"`;
            content =
              content.slice(0, insertIndex) +
              resValues +
              content.slice(insertIndex);
          }
        }

        fs.writeFileSync(appBuildGradle, content);
      }

      // Strip hardcoded Facebook SDK secrets from strings.xml to prevent committing them to VCS
      const stringsXmlPath = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'values',
        'strings.xml'
      );

      if (fs.existsSync(stringsXmlPath)) {
        let content = fs.readFileSync(stringsXmlPath, 'utf-8');
        content = content.replace(
          /\s*<string name="facebook_app_id">.*?<\/string>\s*/g,
          '\n'
        );
        content = content.replace(
          /\s*<string name="facebook_client_token">.*?<\/string>\s*/g,
          '\n'
        );
        content = content.replace(
          /\s*<string name="fb_login_protocol_scheme">.*?<\/string>\s*/g,
          '\n'
        );

        // Normalize any empty lines/excessive newlines
        content = content.replace(/\n\s*\n/g, '\n');
        fs.writeFileSync(stringsXmlPath, content);
      }

      const gradleProperties = path.join(
        cfg.modRequest.platformProjectRoot,
        'gradle.properties'
      );

      if (fs.existsSync(gradleProperties)) {
        let content = fs.readFileSync(gradleProperties, 'utf-8');
        content = ensureGradleProperty(
          content,
          'android.builtInKotlin',
          'false'
        );
        content = ensureMergedJvmArgs(content, [
          '-Xmx2048m',
          '-XX:MaxMetaspaceSize=1024m',
        ]);
        fs.writeFileSync(gradleProperties, content);
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

  return withFinalizedMod(updatedConfig, [
    'android',
    (cfg) => {
      ensureFinalizedPostHogAndroidUploadBestEffort(cfg.modRequest);

      return cfg;
    },
  ]);
}

module.exports = withAndroidGradleFixes;
