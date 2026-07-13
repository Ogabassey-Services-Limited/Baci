/**
 * Expo config plugin: Android Gradle fixes for AGP 9.x + React Native
 *
 * Applies after `expo prebuild --clean` so native dirs are always correct:
 * 1. Removes kotlin-gradle-plugin classpath (built into AGP 9.x)
 * 2. Keeps apply plugin "org.jetbrains.kotlin.android" while android.builtInKotlin=false
 * 3. Changes proguard-android.txt → proguard-android-optimize.txt (AGP 9.x requirement)
 * 4. Bumps Gradle wrapper to 9.3.1 (minimum for AGP 9.x)
 * 5. Adds async-storage local maven repo
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
const {
  addAsyncStorageRepo,
  assertReplaceOrThrow,
  ensureGradleProperty,
  ensureMergedJvmArgs,
  ensureGradleWrapperVersion,
  ensureReleaseSigning,
  fixProguardOptimize,
  removeKotlinGradlePlugin,
} = require('../../../.github/scripts/expoAndroidGradleFixes');

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

function ensureKotlinAndroidPlugin(content) {
  if (content.includes('org.jetbrains.kotlin.android')) {
    return content;
  }

  return assertReplaceOrThrow(
    content,
    /(apply plugin:\s*(["'])com\.android\.application\2\s*\n)/,
    '$1apply plugin: "org.jetbrains.kotlin.android"\n',
    'kotlin.android plugin retention'
  );
}

function ensureDebugFirebaseAutoInitDisabled(content) {
  let updated = content;
  const metadata = [
    '<meta-data android:name="firebase_messaging_auto_init_enabled" android:value="false" tools:replace="android:value" />',
    '<meta-data android:name="firebase_analytics_collection_enabled" android:value="false" tools:replace="android:value" />',
  ];

  if (metadata.every((line) => updated.includes(line))) {
    return updated;
  }

  const selfClosingApplication = updated.match(/<application\b[^>]*\/>/m);
  if (selfClosingApplication) {
    const openingApplication = selfClosingApplication[0].replace(
      /\s*\/>$/,
      '>'
    );
    updated = updated.replace(
      selfClosingApplication[0],
      `${openingApplication}
    </application>`
    );
  }

  for (const line of metadata) {
    if (updated.includes(line)) {
      continue;
    }

    updated = assertReplaceOrThrow(
      updated,
      /\n\s*<\/application>/m,
      `\n        ${line}
    </application>`,
      'debug Firebase auto-init metadata injection'
    );
  }

  return updated;
}

function ensureDebugManifestsFirebaseAutoInitDisabled(platformProjectRoot) {
  for (const relativeManifest of [
    'app/src/debug/AndroidManifest.xml',
    'app/src/debugOptimized/AndroidManifest.xml',
  ]) {
    const manifestPath = path.join(platformProjectRoot, relativeManifest);

    if (!fs.existsSync(manifestPath)) {
      continue;
    }

    const content = fs.readFileSync(manifestPath, 'utf-8');
    fs.writeFileSync(
      manifestPath,
      ensureDebugFirebaseAutoInitDisabled(content)
    );
  }
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
        content = removeKotlinGradlePlugin(
          content,
          'kotlin-gradle-plugin classpath removal'
        );

        // Add async-storage local maven repo if not present
        const asyncStorageRepo =
          'maven { url "$rootDir/../../../node_modules/@react-native-async-storage/async-storage/android/local_repo" }';
        content = addAsyncStorageRepo(
          content,
          asyncStorageRepo,
          'async-storage maven repo injection'
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

        // Keep kotlin.android plugin for MainApplication/MainActivity compilation.
        // android.builtInKotlin=false means AGP will not compile Kotlin by itself.
        content = ensureKotlinAndroidPlugin(content);

        // Fix proguard file name
        content = fixProguardOptimize(content, 'proguard optimize rewrite');

        content = ensureAdminCodegenOrdering(content);
        content = ensureReleaseSigning(content);
        content = ensureWorkletsPickFirst(content);

        fs.writeFileSync(appBuildGradle, content);
      }

      // Fix Gradle wrapper version
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

      ensureDebugManifestsFirebaseAutoInitDisabled(
        cfg.modRequest.platformProjectRoot
      );

      return cfg;
    },
  ]);

  return updatedConfig;
}

module.exports = withAndroidGradleFixes;
