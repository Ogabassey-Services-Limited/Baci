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

function removeKotlinGradlePlugin(content, description) {
  return assertReplaceOrThrow(
    content,
    /\s*classpath\(['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin['"]\)\s*\n?/g,
    '\n',
    description
  );
}

function addAsyncStorageRepo(content, asyncStorageRepo, description) {
  if (content.includes('async-storage')) {
    return content;
  }

  return assertReplaceOrThrow(
    content,
    /(allprojects\s*\{\s*repositories\s*\{)/,
    `$1\n    ${asyncStorageRepo}`,
    description
  );
}

function removeKotlinAndroidPlugin(content, description) {
  return assertReplaceOrThrow(
    content,
    /apply plugin:\s*["']org\.jetbrains\.kotlin\.android["']\s*\n?/g,
    '',
    description
  );
}

function fixProguardOptimize(content, description) {
  return assertReplaceOrThrow(
    content,
    /proguard-android\.txt/g,
    'proguard-android-optimize.txt',
    description
  );
}

module.exports = {
  addAsyncStorageRepo,
  assertReplaceOrThrow,
  ensureGradleWrapperVersion,
  ensureReleaseSigning,
  fixProguardOptimize,
  removeKotlinAndroidPlugin,
  removeKotlinGradlePlugin,
};
