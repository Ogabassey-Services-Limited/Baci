import type { CustomerInfo } from 'react-native-purchases';
import { isRuntimePlatform } from '@/config/runtime-platform';

interface DeviceModule {
  isDevice?: boolean;
}

export function isProFromInfo(info: CustomerInfo | null): boolean {
  if (!info) return false;

  const activeKeys = Object.keys(info.entitlements.active);
  const possibleProKeys = [
    'pro',
    'baci_pro',
    'premium',
    'all_features',
    'monthly',
    'yearly',
    'default',
  ];
  const isPro = activeKeys.some((key) =>
    possibleProKeys.includes(key.toLowerCase())
  );

  if (activeKeys.length > 0 && __DEV__) {
    console.log('[RevenueCat] Active Entitlements:', activeKeys, 'Is Pro:', isPro);
  }

  return isPro;
}

export async function shouldSkipNativePurchasesOnDevelopmentSimulator() {
  if (!__DEV__ || isRuntimePlatform('web')) {
    return false;
  }

  try {
    const deviceModule = (await import('expo-device')) as DeviceModule;
    return deviceModule.isDevice === false;
  } catch {
    return false;
  }
}
