import { Platform } from 'react-native';

export type RuntimePlatform = 'android' | 'ios' | 'web' | (string & {});

interface PlatformSelection<T> {
  android?: T;
  default?: T;
  ios?: T;
  web?: T;
}

export function getRuntimePlatform(): RuntimePlatform {
  return Platform.OS as RuntimePlatform;
}

export function isRuntimePlatform(platform: RuntimePlatform): boolean {
  return getRuntimePlatform() === platform;
}

export function selectRuntimePlatform<T>(
  options: PlatformSelection<T>,
  platform: RuntimePlatform = getRuntimePlatform()
): T | undefined {
  if (platform === 'ios') {
    return options.ios ?? options.default;
  }

  if (platform === 'android') {
    return options.android ?? options.default;
  }

  if (platform === 'web') {
    return options.web ?? options.default;
  }

  return options.default;
}
