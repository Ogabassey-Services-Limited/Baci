import type { TikTokBusinessPlugin } from '@baci/tiktok-business';
import type { ExpoConfig } from 'expo/config';

type ExpoPlugin = NonNullable<ExpoConfig['plugins']>[number];

interface ExpoPluginsOptions {
  facebookSdkPlugin: ExpoPlugin | null;
  tiktokBusinessPlugin: TikTokBusinessPlugin | null;
}

export function createExpoPlugins({
  facebookSdkPlugin,
  tiktokBusinessPlugin,
}: ExpoPluginsOptions): NonNullable<ExpoConfig['plugins']> {
  return [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#000000',
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
          'Allow the app to access your camera for QR scans and checkout identity verification.',
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
          useFrameworks: 'static',
        },
      },
    ],
    ...(tiktokBusinessPlugin ? [tiktokBusinessPlugin] : []),
    './config/withFirebaseModularHeaders.js',
    './config/withObjCLinkerFlag.js',
    './config/withNoSplashImage.js',
    './config/withAdaptiveAndroidManifest.js',
    './config/withAndroidSystemBars.js',
    './config/withAndroidGradleFixes.js',
    [
      'posthog-react-native/expo',
      {
        uploadNativeSymbols: true,
      },
    ],
    './config/withPostHogXcodeCliPath.js',
    'expo-localization',
    'expo-apple-authentication',
    ...(facebookSdkPlugin ? [facebookSdkPlugin] : []),
  ];
}
