jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
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

type AsyncStorageMock = {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
  getMany?: jest.Mock;
  removeMany?: jest.Mock;
  multiGet: jest.Mock;
  multiRemove: jest.Mock;
};

const storageMock = AsyncStorage as unknown as AsyncStorageMock;

describe('storage batching helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storageMock.getMany = jest.fn();
    storageMock.removeMany = jest.fn();
  });

  it('uses getMany (v3 batch API) when available', async () => {
    storageMock.getMany?.mockResolvedValue({
      cart: '{"items":1}',
      prefs: null,
    });

    const result = await getStorageEntries(['cart', 'prefs']);

    expect(result).toEqual([
      ['cart', '{"items":1}'],
      ['prefs', null],
    ]);
    expect(storageMock.getMany).toHaveBeenCalledWith(['cart', 'prefs']);
    expect(storageMock.getItem).not.toHaveBeenCalled();
  });

  it('falls back to multiGet when getMany is unavailable', async () => {
    storageMock.getMany = undefined;
    storageMock.multiGet.mockResolvedValue([
      ['cart', 'cached-cart'],
      ['prefs', null],
    ]);

    const result = await getStorageEntries(['cart', 'prefs']);

    expect(result).toEqual([
      ['cart', 'cached-cart'],
      ['prefs', null],
    ]);
    expect(storageMock.multiGet).toHaveBeenCalledWith(['cart', 'prefs']);
  });

  it('uses removeMany (v3 batch API) when available', async () => {
    storageMock.removeMany?.mockResolvedValue(undefined);

    await removeStorageItems(['cache:a', 'cache:b']);

    expect(storageMock.removeMany).toHaveBeenCalledWith(['cache:a', 'cache:b']);
    expect(storageMock.removeItem).not.toHaveBeenCalled();
  });

  it('falls back to multiRemove when removeMany is unavailable', async () => {
    storageMock.removeMany = undefined;
    storageMock.multiRemove.mockResolvedValue(undefined);

    await removeStorageItems(['cache:a', 'cache:b']);

    expect(storageMock.multiRemove).toHaveBeenCalledWith(['cache:a', 'cache:b']);
  });

  it('returns empty array for empty keys', async () => {
    const result = await getStorageEntries([]);
    expect(result).toEqual([]);
    expect(storageMock.getMany).not.toHaveBeenCalled();
  });

  it('skips removeMany for empty keys', async () => {
    await removeStorageItems([]);
    expect(storageMock.removeMany).not.toHaveBeenCalled();
  });

  it('propagates getMany errors', async () => {
    storageMock.getMany?.mockRejectedValue(new Error('storage read failed'));

    await expect(getStorageEntries(['cart'])).rejects.toThrow(
      'storage read failed'
    );
  });

  it('propagates removeMany errors', async () => {
    storageMock.removeMany?.mockRejectedValue(
      new Error('storage write failed')
    );

    await expect(removeStorageItems(['cache:a'])).rejects.toThrow(
      'storage write failed'
    );
  });

  it('propagates multiGet fallback errors', async () => {
    storageMock.getMany = undefined;
    storageMock.multiGet.mockRejectedValue(new Error('multi read failed'));

    await expect(getStorageEntries(['cart'])).rejects.toThrow(
      'multi read failed'
    );
  });

  it('propagates multiRemove fallback errors', async () => {
    storageMock.removeMany = undefined;
    storageMock.multiRemove.mockRejectedValue(new Error('multi remove failed'));

    await expect(removeStorageItems(['cache:a'])).rejects.toThrow(
      'multi remove failed'
    );
  });
});
