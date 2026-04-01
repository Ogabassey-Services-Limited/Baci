jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getMany: jest.fn(),
  removeMany: jest.fn(),
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

  it('falls back to getItem when getMany is unavailable', async () => {
    storageMock.getMany = undefined;
    storageMock.getItem
      .mockResolvedValueOnce('cached-cart')
      .mockResolvedValueOnce(null);

    const result = await getStorageEntries(['cart', 'prefs']);

    expect(result).toEqual([
      ['cart', 'cached-cart'],
      ['prefs', null],
    ]);
    expect(storageMock.getItem).toHaveBeenNthCalledWith(1, 'cart');
    expect(storageMock.getItem).toHaveBeenNthCalledWith(2, 'prefs');
  });

  it('uses removeMany (v3 batch API) when available', async () => {
    storageMock.removeMany?.mockResolvedValue(undefined);

    await removeStorageItems(['cache:a', 'cache:b']);

    expect(storageMock.removeMany).toHaveBeenCalledWith(['cache:a', 'cache:b']);
    expect(storageMock.removeItem).not.toHaveBeenCalled();
  });

  it('falls back to removeItem when removeMany is unavailable', async () => {
    storageMock.removeMany = undefined;
    storageMock.removeItem.mockResolvedValue(undefined);

    await removeStorageItems(['cache:a', 'cache:b']);

    expect(storageMock.removeItem).toHaveBeenNthCalledWith(1, 'cache:a');
    expect(storageMock.removeItem).toHaveBeenNthCalledWith(2, 'cache:b');
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

  it('propagates getItem fallback errors', async () => {
    storageMock.getMany = undefined;
    storageMock.getItem.mockRejectedValue(new Error('single read failed'));

    await expect(getStorageEntries(['cart'])).rejects.toThrow(
      'single read failed'
    );
  });

  it('propagates removeItem fallback errors', async () => {
    storageMock.removeMany = undefined;
    storageMock.removeItem.mockRejectedValue(new Error('single remove failed'));

    await expect(removeStorageItems(['cache:a'])).rejects.toThrow(
      'single remove failed'
    );
  });
});
