import 'dotenv/config';
import type { TikTokBusinessPlugin } from '@baci/tiktok-business';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const {
  DEFAULT_STOREFRONT_TIKTOK_IOS_APP_STORE_ID,
  DEFAULT_STOREFRONT_TIKTOK_IOS_TIKTOK_APP_ID,
} = require('./config/tiktok-constants') as {
  DEFAULT_STOREFRONT_TIKTOK_IOS_APP_STORE_ID: string;
  DEFAULT_STOREFRONT_TIKTOK_IOS_TIKTOK_APP_ID: string;
};

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
const tiktokIosAppStoreId =
  process.env.STOREFRONT_TIKTOK_APP_STORE_ID?.trim() ||
  DEFAULT_STOREFRONT_TIKTOK_IOS_APP_STORE_ID;
const tiktokIosAppId =
  process.env.STOREFRONT_TIKTOK_APP_ID?.trim() ||
  DEFAULT_STOREFRONT_TIKTOK_IOS_TIKTOK_APP_ID;
const tiktokIosAppSecret =
  process.env.STOREFRONT_TIKTOK_APP_SECRET?.trim() || undefined;
const isTikTokBusinessConfigured = Boolean(
  tiktokIosAppStoreId && tiktokIosAppId && tiktokIosAppSecret
);
const tiktokBusinessPlugin: TikTokBusinessPlugin | null =
  isTikTokBusinessConfigured && tiktokIosAppSecret
    ? [
        '@baci/tiktok-business/plugin',
        {
          ios: {
            appId: tiktokIosAppStoreId,
            tiktokAppId: tiktokIosAppId,
            appSecret: tiktokIosAppSecret,
            debugMode: process.env.TIKTOK_SDK_DEBUG === '1',
            disableSKAdNetworkSupport:
              process.env.STOREFRONT_TIKTOK_DISABLE_SKAN === '1',
          },
        },
      ]
    : null;

const facebookAppId =
  process.env.STOREFRONT_FACEBOOK_APP_ID?.trim();
const facebookClientToken =
  process.env.STOREFRONT_FACEBOOK_CLIENT_TOKEN?.trim();

if (!facebookAppId || !facebookClientToken) {
  throw new Error(
    '[app.config] STOREFRONT_FACEBOOK_APP_ID and STOREFRONT_FACEBOOK_CLIENT_TOKEN are required in your environment to build and prevent silent fallback.'
  );
}

const isFacebookSdkConfigured = true;

const facebookSdkPlugin: NonNullable<ExpoConfig['plugins']>[number] | null =
  isFacebookSdkConfigured && facebookAppId && facebookClientToken
    ? [
        'react-native-fbsdk-next',
        {
          appID: facebookAppId,
          clientToken: facebookClientToken,
          displayName: 'Ogabassey',
          scheme: `fb${facebookAppId}`,
          advertiserIDCollectionEnabled: false,
          autoLogAppEventsEnabled: false,
        },
      ]
    : null;

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
      SKAdNetworkItems: [
        {
          SKAdNetworkIdentifier: '282ce24gcd.skadnetwork',
        },
        {
          SKAdNetworkIdentifier: 'v9wttpbfk9.skadnetwork',
        },
        {
          SKAdNetworkIdentifier: 'n38lu8286q.skadnetwork',
        },
      ],
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
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#000000',
      },
    ],
    'expo-font',
    'expo-image',
    'expo-secure-store',
    'expo-sharing',
    'expo-tracking-transparency',
    'expo-web-browser',
    '@react-native-vector-icons/ionicons',
    '@react-native-vector-icons/fontawesome',
    '@react-native-vector-icons/feather',
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
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          buildToolsVersion: '36.0.0',
        },
        ios: {
          deploymentTarget: '16.4',
          useFrameworks: 'static',
        },
      },
    ],
    ...(tiktokBusinessPlugin ? [tiktokBusinessPlugin] : []),
    './config/withFirebaseModularHeaders.js',
    './config/withObjCLinkerFlag.js',
    './config/withNoSplashImage.js',
    './config/withAndroidGradleFixes.js',
    'expo-localization',
    'expo-apple-authentication',
    'react-native-edge-to-edge',
    ...(facebookSdkPlugin ? [facebookSdkPlugin] : []),
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
    tiktokBusiness: {
      iosAppStoreId: tiktokIosAppStoreId,
      iosTikTokAppId: tiktokIosAppId,
      isConfigured: isTikTokBusinessConfigured,
    },
    facebookAppId: facebookAppId ?? null,
    facebookClientToken: facebookClientToken ?? null,
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
