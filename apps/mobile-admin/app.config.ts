import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Expo App Configuration
 * Using app.config.ts to properly inject environment variables
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Baci',
  slug: 'baci',
  owner: 'ogabassey-services-limited',
  version: '1.1.0',
  orientation: 'default',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
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
    buildNumber: '9',
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
    versionCode: 9,
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
    googleServicesFile: './google-services.json',
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
