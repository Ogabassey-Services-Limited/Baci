const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let mockPlatformProjectRoot;

jest.mock('@expo/config-plugins', () => ({
  withDangerousMod: (config, [, action]) =>
    action({
      ...config,
      modRequest: {
        ...(config.modRequest ?? {}),
        platformProjectRoot: mockPlatformProjectRoot,
      },
    }),
}));

const withAndroidGradleFixes = require('./withAndroidGradleFixes');

function writeProjectFile(projectRoot, relativePath, content) {
  const filePath = path.join(projectRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function readProjectFile(projectRoot, relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('withAndroidGradleFixes', () => {
  afterEach(() => {
    if (mockPlatformProjectRoot) {
      fs.rmSync(mockPlatformProjectRoot, { force: true, recursive: true });
    }
    mockPlatformProjectRoot = undefined;
  });

  it('applies Gradle fixes while retaining the Kotlin Android plugin', () => {
    mockPlatformProjectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'baci-gradle-')
    );
    writeProjectFile(
      mockPlatformProjectRoot,
      'build.gradle',
      `buildscript {
    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
`
    );
    writeProjectFile(
      mockPlatformProjectRoot,
      'app/build.gradle',
      `apply plugin: "org.jetbrains.kotlin.android"

android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.debug
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}
`
    );
    writeProjectFile(
      mockPlatformProjectRoot,
      'gradle.properties',
      'org.gradle.jvmargs=-Xmx2048m\n'
    );
    writeProjectFile(
      mockPlatformProjectRoot,
      'gradle/wrapper/gradle-wrapper.properties',
      'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.13-bin.zip\n'
    );

    withAndroidGradleFixes({ name: 'Ogabassey', slug: 'ogabassey' });

    const rootBuildGradle = readProjectFile(
      mockPlatformProjectRoot,
      'build.gradle'
    );
    const appBuildGradle = readProjectFile(
      mockPlatformProjectRoot,
      'app/build.gradle'
    );
    const gradleProperties = readProjectFile(
      mockPlatformProjectRoot,
      'gradle.properties'
    );
    const wrapperProperties = readProjectFile(
      mockPlatformProjectRoot,
      'gradle/wrapper/gradle-wrapper.properties'
    );

    expect(rootBuildGradle).not.toContain('kotlin-gradle-plugin');
    expect(rootBuildGradle).toContain(
      'node_modules/@react-native-async-storage/async-storage/android/local_repo'
    );
    expect(appBuildGradle).toContain(
      'apply plugin: "org.jetbrains.kotlin.android"'
    );
    expect(appBuildGradle).toContain('ANDROID_KEYSTORE_FILE');
    expect(appBuildGradle).toContain('signingConfig signingConfigs.release');
    expect(appBuildGradle).toContain('proguard-android-optimize.txt');
    expect(gradleProperties).toContain('android.builtInKotlin=false');
    expect(wrapperProperties).toContain('gradle-9.3.1-bin.zip');
    expect(wrapperProperties).toContain('distributionSha256Sum=');
  });
});
