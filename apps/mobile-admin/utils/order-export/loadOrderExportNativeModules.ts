import { Platform } from 'react-native';

export interface OrderExportNativeModules {
  FileSystem: typeof import('expo-file-system') | null;
  Print: typeof import('expo-print') | null;
  Sharing: typeof import('expo-sharing');
}

export async function loadOrderExportNativeModules(): Promise<OrderExportNativeModules> {
  if (Platform.OS === 'web') {
    throw new Error('Export modules not available');
  }

  const [FileSystem, Print, Sharing] = await Promise.all([
    import('expo-file-system').catch(() => null),
    import('expo-print').catch(() => null),
    import('expo-sharing'),
  ]);

  return {
    FileSystem,
    Print,
    Sharing,
  };
}
