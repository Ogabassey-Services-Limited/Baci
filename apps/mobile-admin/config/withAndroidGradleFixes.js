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

const GRADLE_DISTRIBUTION = 'gradle-9.3.1-bin.zip';
const GRADLE_SHA256 =
  'b266d5ff6b90eada6dc3b20cb090e3731302e553a27c5d3e4df1f0d76beaff06';

function assertReplaceOrThrow(content, pattern, replacement, description) {
  const updated = content.replace(pattern, replacement);
  if (updated === content) {
    throw new Error(
      `[withAndroidGradleFixes] Failed to update ${description}; upstream Gradle template changed.`
    );
  }
  return updated;
}

function ensureAdminCodegenOrdering(content) {
  if (content.includes('generateAutolinkingNewArchitectureFiles')) {
    return content;
  }

  return assertReplaceOrThrow(
    content,
    /\/\*\*\s*\n \* Set this to true in release builds/m,
    `gradle.projectsEvaluated {
    def autolinkingTask = tasks.named("generateAutolinkingNewArchitectureFiles").get()

    rootProject.allprojects { subproject ->
        subproject.tasks.matching { task ->
            task.name == "generateCodegenArtifactsFromSchema" || task.name == "generateCodegenSchemaFromJavaScript"
        }.configureEach { codegenTask ->
            autolinkingTask.dependsOn(codegenTask)
        }
    }

    autolinkingTask.outputs.upToDateWhen { false }
}

/**
 * Set this to true in release builds`,
    'admin codegen ordering injection'
  );
}

function ensureReleaseSigning(content) {
  let updated = content;

  if (!updated.includes('ANDROID_KEYSTORE_FILE')) {
    updated = assertReplaceOrThrow(
      updated,
      /signingConfigs\s*\{\s*debug\s*\{[\s\S]*?keyPassword 'android'\s*\n\s*\}\s*\n\s*\}/m,
      `signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            def keystorePath = System.getenv("ANDROID_KEYSTORE_FILE") ?: null
            def keystorePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: null
            def keyAliasVal = System.getenv("ANDROID_KEY_ALIAS") ?: null
            def keyPasswordVal = System.getenv("ANDROID_KEY_PASSWORD") ?: null

            if (keystorePath != null) {
                if (!file(keystorePath).exists()) {
                    throw new GradleException(
                        "ANDROID_KEYSTORE_FILE is set to '\${keystorePath}' but the file does not exist."
                    )
                }
                if (!keystorePassword || !keyAliasVal || !keyPasswordVal) {
                    throw new GradleException(
                        "Release keystore found but signing credentials incomplete. " +
                        "Missing: " +
                        (!keystorePassword ? "ANDROID_KEYSTORE_PASSWORD " : "") +
                        (!keyAliasVal ? "ANDROID_KEY_ALIAS " : "") +
                        (!keyPasswordVal ? "ANDROID_KEY_PASSWORD " : "")
                    )
                }
                storeFile file(keystorePath)
                storePassword keystorePassword
                keyAlias keyAliasVal
                keyPassword keyPasswordVal
            }
        }
    }`,
      'release signingConfigs injection'
    );
  }

  return assertReplaceOrThrow(
    updated,
    /release\s*\{\s*(?:\/\/[^\n]*\n\s*)*signingConfig signingConfigs\.debug/m,
    `release {
            if (signingConfigs.release.storeFile != null) {
                signingConfig signingConfigs.release
            }`,
    'release signingConfig rewrite'
  );
}

function ensureWorkletsPickFirst(content) {
  if (content.includes("pickFirsts += ['**/libworklets.so']")) {
    return content;
  }

  return assertReplaceOrThrow(
    content,
    /useLegacyPackaging enableLegacyPackaging\.toBoolean\(\)\n/m,
    `useLegacyPackaging enableLegacyPackaging.toBoolean()
            pickFirsts += ['**/libworklets.so']
`,
    'worklets pickFirsts injection'
  );
}

function ensureGradleWrapperVersion(content) {
  let updated = assertReplaceOrThrow(
    content,
    /distributionUrl=https\\:\/\/services\.gradle\.org\/distributions\/gradle-[^\n]+/,
    `distributionUrl=https\\://services.gradle.org/distributions/${GRADLE_DISTRIBUTION}`,
    'Gradle distributionUrl rewrite'
  );

  if (updated.includes('distributionSha256Sum=')) {
    updated = assertReplaceOrThrow(
      updated,
      /distributionSha256Sum=.*\n?/,
      `distributionSha256Sum=${GRADLE_SHA256}\n`,
      'Gradle distributionSha256Sum rewrite'
    );
  } else {
    updated = assertReplaceOrThrow(
      updated,
      /(distributionUrl=.*\n)/,
      `$1distributionSha256Sum=${GRADLE_SHA256}\n`,
      'Gradle distributionSha256Sum insertion'
    );
  }

  return updated;
}

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
        content = assertReplaceOrThrow(
          content,
          /\s*classpath\(['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin['"]\)\s*\n?/g,
          '\n',
          'kotlin-gradle-plugin classpath removal'
        );

        // Add async-storage local maven repo if not present
        const asyncStorageRepo =
          'maven { url "$rootDir/../../../node_modules/@react-native-async-storage/async-storage/android/local_repo" }';
        if (!content.includes('async-storage')) {
          content = assertReplaceOrThrow(
            content,
            /(allprojects\s*\{\s*repositories\s*\{)/,
            `$1\n    ${asyncStorageRepo}`,
            'async-storage maven repo injection'
          );
        }

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
        content = assertReplaceOrThrow(
          content,
          /apply plugin:\s*["']org\.jetbrains\.kotlin\.android["']\s*\n?/g,
          '',
          'kotlin.android plugin removal'
        );

        // Fix proguard file name
        content = assertReplaceOrThrow(
          content,
          /proguard-android\.txt/g,
          'proguard-android-optimize.txt',
          'proguard optimize rewrite'
        );

        content = ensureAdminCodegenOrdering(content);
        content = ensureReleaseSigning(content);
        content = ensureWorkletsPickFirst(content);

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
