import { beforeEach, describe, expect, it, jest } from '@jest/globals';

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
import { getStorageEntries, removeStorageItems } from './storage';

type GetManyMock = jest.MockedFunction<
  (keys: string[]) => Promise<Record<string, string | null>>
>;
type RemoveManyMock = jest.MockedFunction<(keys: string[]) => Promise<void>>;

type AsyncStorageMock = {
  getMany: GetManyMock;
  removeMany: RemoveManyMock;
};

const storageMock = AsyncStorage as unknown as AsyncStorageMock;

describe('storage fallback wrappers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads through AsyncStorage batch helpers when MMKV is unavailable', async () => {
    storageMock.getMany.mockResolvedValue({
      cart: '{"items":1}',
      prefs: null,
    });

    await expect(getStorageEntries(['cart', 'prefs'])).resolves.toEqual([
      ['cart', '{"items":1}'],
      ['prefs', null],
    ]);
  });

  it('removes through AsyncStorage batch helpers when MMKV is unavailable', async () => {
    storageMock.removeMany.mockResolvedValue(undefined);

    await removeStorageItems(['cache:a', 'cache:b']);

    expect(storageMock.removeMany).toHaveBeenCalledWith(['cache:a', 'cache:b']);
  });
});
