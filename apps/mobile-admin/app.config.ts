import 'tsx/cjs';
import './config/app-config-env';

import type { TikTokBusinessPlugin } from '@baci/tiktok-business';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const { DEFAULT_ADMIN_TIKTOK_IOS_APP_STORE_ID } =
  require('./config/tiktok-constants') as {
    DEFAULT_ADMIN_TIKTOK_IOS_APP_STORE_ID: string;
  };

const { resolveAndroidGoogleServicesFile } =
  require('./config/android-google-services-file') as {
    resolveAndroidGoogleServicesFile: (options?: {
      easBuildProfile?: string;
      projectRoot?: string;
    }) => string;
  };

const { resolveUpdateChannel } =
  require('./config/resolve-update-channel.js') as typeof import('./config/resolve-update-channel');

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

// Human-facing app version (Android versionName + iOS CFBundleShortVersionString).
// Release workflows inject an auto-incrementing value: APP_VERSION (Android) or
// the legacy IOS_APP_VERSION (iOS). Without it, builds fall back to the pinned
// baseline below — which is why every Android release previously shipped "2.0.1".
// Use `|| ` (not `??`) so an empty/whitespace APP_VERSION — e.g. a workflow that
// exports it without a value — is treated as unset and still falls through to
// IOS_APP_VERSION rather than silently dropping to the pinned baseline.
const rawAppVersion =
  process.env.APP_VERSION?.trim() || process.env.IOS_APP_VERSION?.trim();
let _appVersion: string | undefined;

if (rawAppVersion) {
  if (!/^\d+\.\d+\.\d+$/.test(rawAppVersion)) {
    throw new Error(
      `[app.config] Invalid app version "${rawAppVersion}" (from APP_VERSION/IOS_APP_VERSION). Must be semantic version major.minor.patch (e.g., 2.0.31).`
    );
  }
  _appVersion = rawAppVersion;
}

const tiktokIosAppStoreId =
  process.env.ADMIN_TIKTOK_APP_STORE_ID?.trim() ||
  DEFAULT_ADMIN_TIKTOK_IOS_APP_STORE_ID;
const tiktokIosAppId = process.env.ADMIN_TIKTOK_APP_ID?.trim() || undefined;
const tiktokIosAppSecret =
  process.env.ADMIN_TIKTOK_APP_SECRET?.trim() || undefined;
const isTikTokBusinessConfigured = Boolean(
  tiktokIosAppStoreId && tiktokIosAppId && tiktokIosAppSecret
);
const tiktokBusinessPlugin: TikTokBusinessPlugin | null =
  isTikTokBusinessConfigured && tiktokIosAppId && tiktokIosAppSecret
    ? [
        '@baci/tiktok-business/plugin',
        {
          ios: {
            appId: tiktokIosAppStoreId,
            tiktokAppId: tiktokIosAppId,
            appSecret: tiktokIosAppSecret,
            debugMode: process.env.TIKTOK_SDK_DEBUG === '1',
            disableSKAdNetworkSupport:
              process.env.ADMIN_TIKTOK_DISABLE_SKAN === '1',
          },
        },
      ]
    : null;
const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim();
const posthogHost =
  process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://eu.i.posthog.com';
const EAS_PROJECT_ID = '4b258ae6-fc8a-4b3d-bcbe-dfb3402203c9';
const EAS_UPDATE_URL = `https://u.expo.dev/${EAS_PROJECT_ID}`;
const updateChannel = resolveUpdateChannel(process.env);

/**
 * Expo App Configuration
 * Using app.config.ts to properly inject environment variables
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Baci - The Ecommerce Builder',
  slug: 'baci',
  owner: 'ogabassey-services-limited',
  version: _appVersion ?? '2.0.1',
  runtimeVersion: {
    policy: 'fingerprint',
  },
  updates: {
    // Release builds check in the background at launch and keep using the
    // embedded/cached bundle immediately. A downloaded update is applied on
    // the next restart, preserving a working startup path during outages.
    checkAutomatically: 'ON_LOAD',
    enableBsdiffPatchSupport: true,
    enabled: true,
    fallbackToCacheTimeout: 0,
    requestHeaders: {
      'expo-channel-name': updateChannel,
    },
    url: EAS_UPDATE_URL,
    useEmbeddedUpdate: true,
  },
  orientation: 'default',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  scheme: 'baciadmin',
  assetBundlePatterns: ['**/*'],
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
      NSUserTrackingUsageDescription:
        'Your data will be used to measure ad performance and improve Baci app promotion.',
      ITSAppUsesNonExemptEncryption: false,
    },
    googleServicesFile: './GoogleService-Info.plist',
  },
  android: {
    package: 'com.ogabassey.baci',
    versionCode: _androidVersionCode ?? 9,
    // expo-tracking-transparency adds AD_ID for its optional Android
    // getAdvertisingId API. Baci only invokes its ATT APIs on iOS, so remove
    // the transitive Android permission to keep the Play declaration accurate.
    blockedPermissions: ['com.google.android.gms.permission.AD_ID'],
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
          { scheme: 'https', host: 'usebaci.com', pathPrefix: '/invite' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  plugins: [
    'expo-router',
    // Keep the physical-device development client on its last working
    // project. Do not set defaultLaunchURL: LAN addresses are ephemeral and
    // a baked-in URL would be unsafe for preview/release builds.
    [
      'expo-dev-client',
      {
        launchMode: 'most-recent',
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#f0bf58',
      },
    ],
    [
      'expo-navigation-bar',
      {
        enforceContrast: false,
        hidden: false,
        style: 'dark',
      },
    ],
    [
      'expo-secure-store',
      {
        configureAndroidBackup: true,
        faceIDPermission:
          'Allow Baci Admin to protect your merchant account credentials.',
      },
    ],
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
    [
      'posthog-react-native/expo',
      {
        skipOnConflict: true,
        uploadNativeSymbols: true,
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          buildToolsVersion: '36.0.0',
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
        ios: {
          deploymentTarget: '16.4',
          // Force module-map generation for the Objective-C Google pods that
          // AppCheckCore (pulled in transitively by
          // @react-native-google-signin/google-signin) imports from Swift.
          // Without this, `expo prebuild --clean` + `pod install --repo-update`
          // resolves AppCheckCore 11.3.0, which refuses to integrate as a static
          // library because GoogleUtilities/RecaptchaInterop "do not define
          // modules", failing the iOS release build. Targeted modular_headers
          // keeps the global use_modular_headers! side-effects out of the build.
          extraPods: [
            { name: 'GoogleUtilities', modular_headers: true },
            { name: 'RecaptchaInterop', modular_headers: true },
          ],
        },
      },
    ],
    ...(tiktokBusinessPlugin ? [tiktokBusinessPlugin] : []),
    'expo-web-browser',
    'expo-font',
    'expo-sharing',
    '@react-native-vector-icons/ionicons',
    '@react-native-vector-icons/fontawesome',
    './config/withAndroidSystemBars.js',
    './config/withAndroidGradleFixes.js',
    [
      './plugins/with-ios-release-hardening',
      {
        minimumOSVersion: '16.4',
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
    // SDK 57's supported React Compiler integration configures Babel through
    // Expo, keeping compiler behavior consistent across native and web builds.
    reactCompiler: true,
    // typedRoutes disabled: generated .expo/types/router.d.ts only includes
    // (auth) routes and misses all (admin) routes, causing false TS errors.
    typedRoutes: false,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    posthogApiKey,
    posthogHost,
    tiktokBusiness: {
      iosAppStoreId: tiktokIosAppStoreId,
      iosTikTokAppId: tiktokIosAppId ?? '',
      isConfigured: isTikTokBusinessConfigured,
    },
    eas: {
      projectId: EAS_PROJECT_ID,
    },
    router: {},
  },
});
