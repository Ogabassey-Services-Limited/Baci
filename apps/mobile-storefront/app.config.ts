import type { ConfigContext, ExpoConfig } from 'expo/config';

const rawAndroidVersionCode = process.env.ANDROID_VERSION_CODE;
const parsedAndroidVersionCode =
  rawAndroidVersionCode === undefined
    ? undefined
    : Number(rawAndroidVersionCode);

let androidVersionCode: number | undefined;

if (rawAndroidVersionCode !== undefined) {
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

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Ogabassey',
  slug: 'ogabassey-store',
  owner: 'ogabassey',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  scheme: 'ogabassey',
  assetBundlePatterns: ['**/*'],
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#000000',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.ogabassey.store',
    scheme: 'ogabassey', // Ensure scheme is explicitly set for iOS
    associatedDomains: [
      'applinks:ogabassey.com',
      'applinks:ogabassey.usebaci.com',
    ],
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSUserTrackingUsageDescription:
        'Your data will be used to provide personalized product recommendations and improve your shopping experience.',
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: ['ogabassey'],
        },
      ],
    },
  },
  android: {
    ...(androidVersionCode !== undefined
      ? { versionCode: androidVersionCode }
      : {}),
    package: 'com.ogabassey.store',
    scheme: 'ogabassey', // Ensure scheme is explicitly set for Android
    googleServicesFile: './google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#000000',
    },
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
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
    'expo-clipboard',
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
    'expo-localization',
    'expo-apple-authentication',
  ],
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  experiments: {
    typedRoutes: true,
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
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
});
