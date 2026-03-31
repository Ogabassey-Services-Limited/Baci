import { jest } from '@jest/globals';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    getMany: jest.fn(),
    setMany: jest.fn(),
    removeMany: jest.fn(),
    getAllKeys: jest.fn(),
    clear: jest.fn(),
  },
}));

type StorageModule = typeof import('./storage');
type AsyncStorageModule = typeof import('@react-native-async-storage/async-storage');

async function loadStorageModule(): Promise<{
  asyncStorage: StorageModule['asyncStorage'];
  initializeStorage: StorageModule['initializeStorage'];
  isStorageReady: StorageModule['isStorageReady'];
  syncStorage: StorageModule['syncStorage'];
  AsyncStorage: AsyncStorageModule['default'];
}> {
  jest.resetModules();

  const asyncStorageModule = (await import(
    '@react-native-async-storage/async-storage'
  )) as AsyncStorageModule;
  const storageModule = (await import('./storage')) as StorageModule;

  return {
    AsyncStorage: asyncStorageModule.default,
    asyncStorage: storageModule.asyncStorage,
    initializeStorage: storageModule.initializeStorage,
    isStorageReady: storageModule.isStorageReady,
    syncStorage: storageModule.syncStorage,
  };
}

describe('storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hydrates syncStorage from AsyncStorage.getMany during initialization', async () => {
    const { AsyncStorage, initializeStorage, isStorageReady, syncStorage } =
      await loadStorageModule();

    const mockGetMany = AsyncStorage.getMany as jest.MockedFunction<
      (keys: string[]) => Promise<Record<string, string | null>>
    >;

    mockGetMany.mockResolvedValue({
      'app-settings-storage': '{"theme":"dark"}',
      'auth-storage': null,
    });

    expect(isStorageReady()).toBe(false);

    await initializeStorage(['app-settings-storage', 'auth-storage']);

    expect(AsyncStorage.getMany).toHaveBeenCalledWith([
      'app-settings-storage',
      'auth-storage',
    ]);
    expect(syncStorage.getItem('app-settings-storage')).toBe(
      '{"theme":"dark"}'
    );
    expect(syncStorage.getItem('auth-storage')).toBeNull();
    expect(isStorageReady()).toBe(true);
  });

  it('proxies asyncStorage.removeItem to AsyncStorage.removeItem', async () => {
    const { AsyncStorage, asyncStorage } = await loadStorageModule();

    await asyncStorage.removeItem('cache-key');

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('cache-key');
  });
});
