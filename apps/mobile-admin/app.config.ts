import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const { resolveAndroidGoogleServicesFile } = require(
  './config/android-google-services-file'
) as {
  resolveAndroidGoogleServicesFile: (options?: {
    easBuildProfile?: string;
    projectRoot?: string;
  }) => string;
};

const rawAndroidVersionCode = process.env.ANDROID_VERSION_CODE;
const parsedAndroidVersionCode =
  rawAndroidVersionCode === undefined
    ? undefined
    : Number(rawAndroidVersionCode);

let _androidVersionCode: number | undefined;

if (rawAndroidVersionCode !== undefined) {
  if (!Number.isInteger(parsedAndroidVersionCode)) {
    console.warn(
      `[app.config] Ignoring ANDROID_VERSION_CODE="${rawAndroidVersionCode}" because it is not an integer.`
    );
  } else if ((parsedAndroidVersionCode as number) <= 0) {
    console.warn(
      `[app.config] Ignoring ANDROID_VERSION_CODE="${rawAndroidVersionCode}" because it must be greater than 0.`
    );
  } else if ((parsedAndroidVersionCode as number) > 2_100_000_000) {
    console.warn(
      `[app.config] Ignoring ANDROID_VERSION_CODE="${rawAndroidVersionCode}" because it exceeds 2100000000.`
    );
  } else {
    _androidVersionCode = parsedAndroidVersionCode;
  }
}

const rawIosBuildNumber = process.env.IOS_BUILD_NUMBER;
let _iosBuildNumber: string | undefined;

if (rawIosBuildNumber !== undefined) {
  const parsed = Number(rawIosBuildNumber);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.warn(
      `[app.config] Ignoring IOS_BUILD_NUMBER="${rawIosBuildNumber}" because it must be a positive integer.`
    );
  } else {
    _iosBuildNumber = String(parsed);
  }
}

const rawIosAppVersion = process.env.IOS_APP_VERSION;
let _iosAppVersion: string | undefined;

if (rawIosAppVersion !== undefined && rawIosAppVersion.trim().length > 0) {
  const trimmed = rawIosAppVersion.trim();
  if (!/^\d+\.\d+\.\d+$/.test(trimmed)) {
    throw new Error(
      `[app.config] Invalid IOS_APP_VERSION="${rawIosAppVersion}". Must be semantic version major.minor.patch (e.g., 2.0.31).`
    );
  }
  _iosAppVersion = trimmed;
}

/**
 * Expo App Configuration
 * Using app.config.ts to properly inject environment variables
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Baci - The Ecommerce Builder',
  slug: 'baci',
  owner: 'ogabassey-services-limited',
  version: _iosAppVersion ?? '2.0.1',
  orientation: 'default',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  scheme: 'baciadmin',
  assetBundlePatterns: ['**/*'],
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#f0bf58',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.ogabassey.baci',
    buildNumber: _iosBuildNumber ?? '13',
    // www.usebaci.com excluded: Vercel 308-redirects www → bare domain,
    // and Apple/Android reject redirects for verification files.
    associatedDomains: ['applinks:usebaci.com'],
    infoPlist: {
      NSCameraUsageDescription:
        'Allow the app to scan barcodes for inventory management and product lookup.',
      NSPhotoLibraryUsageDescription:
        'Allow the app to access photos for product images.',
      ITSAppUsesNonExemptEncryption: false,
    },
    googleServicesFile: './GoogleService-Info.plist',
  },
  android: {
    package: 'com.ogabassey.baci',
    versionCode: _androidVersionCode ?? 9,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#f0bf58',
    },
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
    ],
    googleServicesFile: resolveAndroidGoogleServicesFile(),
    intentFilters: [
      {
        action: 'VIEW',
        data: [
          {
            scheme: 'baciadmin',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
      {
        action: 'VIEW',
        autoVerify: true,
        // www.usebaci.com excluded: Vercel 308-redirects www → bare domain,
        // so Android can't verify assetlinks.json at www. Users on www get
        // redirected to usebaci.com which IS verified.
        data: [
          { scheme: 'https', host: 'usebaci.com', pathPrefix: '/dashboard' },
          { scheme: 'https', host: 'usebaci.com', pathPrefix: '/admin' },
          { scheme: 'https', host: 'usebaci.com', pathPrefix: '/store' },
          { scheme: 'https', host: 'usebaci.com', pathPrefix: '/orders' },
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
        cameraPermission: 'Allow the app to scan barcodes for inventory.',
      },
    ],
    '@react-native-community/datetimepicker',
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme:
          'com.googleusercontent.apps.319018494610-qao63i6hrhsqupk7cbtd80ovfamrm4lm',
      },
    ],
    'expo-build-properties',
    'expo-web-browser',
    'expo-font',
    'expo-sharing',
    'react-native-edge-to-edge',
    './config/withAndroidGradleFixes.js',
    [
      './plugins/with-ios-release-hardening',
      {
        minimumOSVersion: '15.1',
        teamId: process.env.EXPO_APPLE_TEAM_ID,
      },
    ],
  ],
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  experiments: {
    // typedRoutes disabled: generated .expo/types/router.d.ts only includes
    // (auth) routes and misses all (admin) routes, causing false TS errors.
    typedRoutes: false,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    eas: {
      projectId: '4b258ae6-fc8a-4b3d-bcbe-dfb3402203c9',
    },
    router: {},
  },
});
