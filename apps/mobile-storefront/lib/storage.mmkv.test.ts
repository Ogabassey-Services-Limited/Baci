jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  getMany: jest.fn(),
  removeMany: jest.fn(),
  multiGet: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('./logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { asyncStorage } from './storage';

type AsyncStorageMock = {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
  getAllKeys: jest.Mock;
  getMany?: jest.Mock;
  removeMany?: jest.Mock;
  multiGet?: jest.Mock;
  multiRemove?: jest.Mock;
};

const storageMock = AsyncStorage as unknown as AsyncStorageMock;

describe('storage MMKV migration', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.resetModules();
    jest.dontMock('react-native');
    jest.dontMock('react-native-mmkv');
  });

  it('migrates legacy AsyncStorage state into MMKV during startup', async () => {
    const getMany = jest.fn().mockResolvedValue({
      'cart-storage': '{"state":{"items":[{"id":"cart-1"}]}}',
      'comparison-storage': null,
      'saved-storage': null,
      search_history: null,
    });
    const removeMany = jest.fn();
    const mmkvSet = jest.fn();
    const mmkvGetString = jest.fn(() => null);

    process.env.NODE_ENV = 'production';
    jest.resetModules();
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      getMany,
      removeMany,
      multiGet: jest.fn(),
      multiRemove: jest.fn(),
    }));
    jest.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
    }));
    jest.doMock('react-native-mmkv', () => ({
      createMMKV: jest.fn(() => ({
        getString: mmkvGetString,
        remove: jest.fn(),
        set: mmkvSet,
      })),
    }));
    jest.doMock('./logger', () => ({
      createLogger: jest.fn(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
    }));

    const storage = jest.requireActual<typeof import('./storage')>('./storage');

    await storage.waitForStorageReady();

    expect(getMany).toHaveBeenCalledWith([
      'cart-storage',
      'saved-storage',
      'comparison-storage',
      'search_history',
    ]);
    expect(mmkvSet).toHaveBeenCalledWith(
      'cart-storage',
      '{"state":{"items":[{"id":"cart-1"}]}}'
    );
    expect(removeMany).toHaveBeenCalledWith(['cart-storage']);
    expect(storage.isStorageReady()).toBe(true);
  });

  it('removes MMKV and legacy AsyncStorage entries when native storage is active', async () => {
    const getMany = jest.fn().mockResolvedValue({
      'cart-storage': null,
      'comparison-storage': null,
      'saved-storage': null,
      search_history: null,
    });
    const removeMany = jest.fn();
    const mmkvRemove = jest.fn();

    process.env.NODE_ENV = 'production';
    jest.resetModules();
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      getMany,
      removeMany,
      multiGet: jest.fn(),
      multiRemove: jest.fn(),
    }));
    jest.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
    }));
    jest.doMock('react-native-mmkv', () => ({
      createMMKV: jest.fn(() => ({
        getString: jest.fn(() => null),
        remove: mmkvRemove,
        set: jest.fn(),
      })),
    }));
    jest.doMock('./logger', () => ({
      createLogger: jest.fn(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
    }));

    const storage = jest.requireActual<typeof import('./storage')>('./storage');
    await storage.waitForStorageReady();
    jest.clearAllMocks();

    await storage.removeStorageItems(['cart-storage', 'saved-storage']);

    expect(mmkvRemove).toHaveBeenNthCalledWith(1, 'cart-storage');
    expect(mmkvRemove).toHaveBeenNthCalledWith(2, 'saved-storage');
    expect(removeMany).toHaveBeenCalledWith(['cart-storage', 'saved-storage']);
  });
});

describe('asyncStorage.getAllKeys', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.resetModules();
    jest.dontMock('react-native');
    jest.dontMock('react-native-mmkv');
  });

  // In the Jest env MMKV is disabled (NODE_ENV === 'test'), so the shim reads
  // through to AsyncStorage — the fallback path used on Web/SSR/Expo Go.
  it('returns the AsyncStorage keys when MMKV is unavailable', async () => {
    storageMock.getAllKeys.mockResolvedValueOnce([
      'cart-storage',
      'auth-storage',
    ]);

    await expect(asyncStorage.getAllKeys()).resolves.toEqual([
      'cart-storage',
      'auth-storage',
    ]);
  });

  it('returns an empty array (and does not throw) when enumeration fails', async () => {
    storageMock.getAllKeys.mockRejectedValueOnce(new Error('boom'));

    await expect(asyncStorage.getAllKeys()).resolves.toEqual([]);
  });

  it('returns unique MMKV and legacy keys when native storage is available', async () => {
    const getMany = jest.fn().mockResolvedValue({
      'cart-storage': null,
      'comparison-storage': null,
      'saved-storage': null,
      search_history: null,
    });
    const legacyGetAllKeys = jest
      .fn()
      .mockResolvedValue(['REACT_QUERY_OFFLINE_CACHE', 'legacy-cache']);
    const mmkvGetAllKeys = jest.fn(() => [
      'mmkv-cache',
      'REACT_QUERY_OFFLINE_CACHE',
      'mmkv-cache',
    ]);

    process.env.NODE_ENV = 'production';
    jest.resetModules();
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      getAllKeys: legacyGetAllKeys,
      getMany,
      removeMany: jest.fn(),
      multiGet: jest.fn(),
      multiRemove: jest.fn(),
    }));
    jest.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
    }));
    jest.doMock('react-native-mmkv', () => ({
      createMMKV: jest.fn(() => ({
        getAllKeys: mmkvGetAllKeys,
        getString: jest.fn(() => null),
        remove: jest.fn(),
        set: jest.fn(),
      })),
    }));
    jest.doMock('./logger', () => ({
      createLogger: jest.fn(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
    }));

    const storage = jest.requireActual<typeof import('./storage')>('./storage');
    await storage.waitForStorageReady();

    await expect(storage.asyncStorage.getAllKeys()).resolves.toEqual([
      'mmkv-cache',
      'REACT_QUERY_OFFLINE_CACHE',
      'legacy-cache',
    ]);
  });

  it('still returns MMKV keys when legacy AsyncStorage enumeration fails', async () => {
    const getMany = jest.fn().mockResolvedValue({
      'cart-storage': null,
      'comparison-storage': null,
      'saved-storage': null,
      search_history: null,
    });
    const legacyGetAllKeys = jest.fn().mockRejectedValue(new Error('locked'));
    const mmkvGetAllKeys = jest.fn(() => ['mmkv-cache']);

    process.env.NODE_ENV = 'production';
    jest.resetModules();
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      getAllKeys: legacyGetAllKeys,
      getMany,
      removeMany: jest.fn(),
      multiGet: jest.fn(),
      multiRemove: jest.fn(),
    }));
    jest.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
    }));
    jest.doMock('react-native-mmkv', () => ({
      createMMKV: jest.fn(() => ({
        getAllKeys: mmkvGetAllKeys,
        getString: jest.fn(() => null),
        remove: jest.fn(),
        set: jest.fn(),
      })),
    }));
    jest.doMock('./logger', () => ({
      createLogger: jest.fn(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
    }));

    const storage = jest.requireActual<typeof import('./storage')>('./storage');
    await storage.waitForStorageReady();

    await expect(storage.asyncStorage.getAllKeys()).resolves.toEqual([
      'mmkv-cache',
    ]);
  });
});
