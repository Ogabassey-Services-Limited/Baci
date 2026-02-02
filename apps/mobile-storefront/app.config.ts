import { ExpoConfig, ConfigContext } from 'expo/config';

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
    associatedDomains: [
      'applinks:ogabassey.com',
      'applinks:ogabassey.usebaci.com',
    ],
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.ogabassey.store',
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
    'expo-localization',
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
