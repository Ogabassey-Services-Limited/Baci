/** @jest-environment node */

import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

const mockGetMany = jest
  .fn<() => Promise<Record<string, string | null>>>()
  .mockResolvedValue({});
const mockPlatform = { OS: 'web' };
const mockWarn = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getMany: mockGetMany,
  removeMany: jest.fn(),
  multiGet: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('react-native', () => ({
  Platform: mockPlatform,
}));

jest.mock('./logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: mockWarn,
    error: jest.fn(),
  })),
}));

function loadStorageModule(): typeof import('./storage') {
  let storageModule: typeof import('./storage') | undefined;

  jest.isolateModules(() => {
    storageModule = jest.requireActual<typeof import('./storage')>('./storage');
  });

  if (!storageModule) {
    throw new Error('Storage module did not load');
  }

  return storageModule;
}

describe('storage startup initialization', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockPlatform.OS = 'web';
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined,
    });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  });

  it('does not read browser storage while Expo renders web on the server', () => {
    loadStorageModule();

    expect(mockGetMany).not.toHaveBeenCalled();
  });

  it('does not warn when persisted stores read their empty SSR snapshot', () => {
    const { syncStorage } = loadStorageModule();

    expect(syncStorage.getItem('cart-storage')).toBeNull();
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('begins startup hydration after web is running in a browser', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {},
    });

    loadStorageModule();

    expect(mockGetMany).toHaveBeenCalledWith([
      'cart-storage',
      'saved-storage',
      'comparison-storage',
      'search_history',
    ]);
  });

  it('still begins startup hydration for native runtimes', () => {
    mockPlatform.OS = 'ios';

    loadStorageModule();

    expect(mockGetMany).toHaveBeenCalledWith([
      'cart-storage',
      'saved-storage',
      'comparison-storage',
      'search_history',
    ]);
  });
});
