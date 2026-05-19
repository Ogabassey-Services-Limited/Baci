import { isRuntimePlatform } from '@/config/runtime-platform';

export interface OrderExportNativeModules {
  FileSystem: typeof import('expo-file-system/legacy') | null;
  Print: typeof import('expo-print') | null;
  Sharing: typeof import('expo-sharing') | null;
}

export async function loadOrderExportNativeModules(): Promise<OrderExportNativeModules> {
  // Expo export modules are native-only; reject web before loading them.
  if (isRuntimePlatform('web')) {
    throw new Error('Export modules not available');
  }

  const [FileSystem, Print, Sharing] = await Promise.all([
    import('expo-file-system/legacy').catch(() => null),
    import('expo-print').catch(() => null),
    import('expo-sharing').catch(() => null),
  ]);

  return {
    FileSystem,
    Print,
    Sharing,
  };
}
