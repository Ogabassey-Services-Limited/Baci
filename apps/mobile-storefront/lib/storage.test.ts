jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
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
  multiGet?: jest.Mock;
  multiRemove?: jest.Mock;
};

const storageMock = AsyncStorage as unknown as AsyncStorageMock;

describe('storage batching compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storageMock.multiGet = jest.fn();
    storageMock.multiRemove = jest.fn();
  });

  it('prefers multiGet when the batch API is available', async () => {
    storageMock.multiGet!.mockResolvedValue([
      ['cart', '{"items":1}'],
      ['prefs', null],
    ]);

    await expect(getStorageEntries(['cart', 'prefs'])).resolves.toEqual([
      ['cart', '{"items":1}'],
      ['prefs', null],
    ]);

    expect(storageMock.multiGet).toHaveBeenCalledWith(['cart', 'prefs']);
    expect(storageMock.getItem).not.toHaveBeenCalled();
  });

  it('falls back to getItem when the batch API type is unavailable', async () => {
    storageMock.multiGet = undefined;
    storageMock.getItem
      .mockResolvedValueOnce('cached-cart')
      .mockResolvedValueOnce(null);

    await expect(getStorageEntries(['cart', 'prefs'])).resolves.toEqual([
      ['cart', 'cached-cart'],
      ['prefs', null],
    ]);

    expect(storageMock.getItem).toHaveBeenNthCalledWith(1, 'cart');
    expect(storageMock.getItem).toHaveBeenNthCalledWith(2, 'prefs');
  });

  it('prefers multiRemove when the batch API is available', async () => {
    storageMock.multiRemove!.mockResolvedValue(undefined);

    await removeStorageItems(['cache:a', 'cache:b']);

    expect(storageMock.multiRemove).toHaveBeenCalledWith([
      'cache:a',
      'cache:b',
    ]);
    expect(storageMock.removeItem).not.toHaveBeenCalled();
  });

  it('falls back to removeItem when the batch API type is unavailable', async () => {
    storageMock.multiRemove = undefined;
    storageMock.removeItem.mockResolvedValue(undefined);

    await removeStorageItems(['cache:a', 'cache:b']);

    expect(storageMock.removeItem).toHaveBeenNthCalledWith(1, 'cache:a');
    expect(storageMock.removeItem).toHaveBeenNthCalledWith(2, 'cache:b');
  });
});
