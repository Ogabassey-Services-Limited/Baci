import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const rawAndroidVersionCode = process.env.ANDROID_VERSION_CODE;
const parsedAndroidVersionCode =
  rawAndroidVersionCode === undefined
    ? undefined
    : Number(rawAndroidVersionCode);

let androidVersionCode: number | undefined;
const appVersion = '2.0.0';

// `parsedAndroidVersionCode` is undefined iff `rawAndroidVersionCode` is, so
// checking only the parsed value is sufficient and narrows the type below.
if (parsedAndroidVersionCode !== undefined) {
  if (!Number.isInteger(parsedAndroidVersionCode)) {
    console.warn(
      `[app.config] Ignoring ANDROID_VERSION_CODE="${rawAndroidVersionCode}" because it is not an integer.`
    );
  } else if (parsedAndroidVersionCode <= 0) {
    console.warn(
      `[app.config] Ignoring ANDROID_VERSION_CODE="${rawAndroidVersionCode}" because it must be greater than 0.`
    );
  } else if (parsedAndroidVersionCode > 2_100_000_000) {
    console.warn(
      `[app.config] Ignoring ANDROID_VERSION_CODE="${rawAndroidVersionCode}" because it exceeds 2100000000.`
    );
  } else {
    androidVersionCode = parsedAndroidVersionCode;
  }
}

const rawIosBuildNumber = process.env.IOS_BUILD_NUMBER;
let iosBuildNumber: string | undefined;

if (rawIosBuildNumber !== undefined) {
  const parsed = Number(rawIosBuildNumber);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.warn(
      `[app.config] Ignoring IOS_BUILD_NUMBER="${rawIosBuildNumber}" because it must be a positive integer.`
    );
  } else {
    iosBuildNumber = String(parsed);
  }
}

const rawIosAppVersion = process.env.IOS_APP_VERSION;
let _iosAppVersion: string | undefined;

if (rawIosAppVersion !== undefined && rawIosAppVersion.trim().length > 0) {
  const trimmed = rawIosAppVersion.trim();
  if (!/^\d+\.\d+\.\d+$/.test(trimmed)) {
    throw new Error(
      `[app.config] Invalid IOS_APP_VERSION="${rawIosAppVersion}". Must be semantic version major.minor.patch (e.g., 2.1.31).`
    );
  }
  _iosAppVersion = trimmed;
}

const runtimeVersion = _iosAppVersion ?? appVersion;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Ogabassey',
  slug: 'ogabassey-store',
  owner: 'ogabassey',
  version: runtimeVersion,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  scheme: 'ogabassey',
  assetBundlePatterns: ['**/*'],
  splash: {
    backgroundColor: '#000000',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.ogabassey.app',
    buildNumber: iosBuildNumber ?? '9',
    associatedDomains: [
      'applinks:ogabassey.com',
      'applinks:ogabassey.usebaci.com',
    ],
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSUserTrackingUsageDescription:
        'Your data will be used to provide personalized product recommendations and improve your shopping experience.',
    },
  },
  android: {
    ...(androidVersionCode !== undefined
      ? { versionCode: androidVersionCode }
      : {}),
    package: 'com.ogabassey.store',
    googleServicesFile: './google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#000000',
    },
    intentFilters: [
      {
        action: 'VIEW',
        data: [
          {
            scheme: 'ogabassey',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'ogabassey.com',
            pathPrefix: '/',
          },
          {
            scheme: 'https',
            host: 'ogabassey.usebaci.com',
            pathPrefix: '/',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/images/icon.png',
        color: '#000000',
        defaultChannel: 'orders',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Allow the app to access your camera to scan QR codes.',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          useFrameworks: 'static',
        },
      },
    ],
    './config/withFirebaseModularHeaders.js',
    './config/withObjCLinkerFlag.js',
    './config/withNoSplashImage.js',
    './config/withAndroidGradleFixes.js',
    'expo-localization',
    'expo-apple-authentication',
    'react-native-edge-to-edge',
  ],
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  experiments: {
    typedRoutes: false,
  },
  extra: {
    merchantId: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
    merchantSlug: 'ogabassey',
    businessType: 'electronics',
    templateId: 'default',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    eas: {
      projectId: 'c6c1897b-cac8-49b0-85f9-3d277aecc379',
    },
  },
  updates: {
    url: 'https://u.expo.dev/c6c1897b-cac8-49b0-85f9-3d277aecc379',
    checkAutomatically: 'ON_ERROR_RECOVERY',
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion,
});
