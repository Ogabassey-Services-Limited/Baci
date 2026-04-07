import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

const mockGetItem = jest.fn<(key: string) => Promise<string | null>>();
const mockSetItem = jest.fn<(key: string, value: string) => Promise<void>>();
const mockRemoveItem = jest.fn<(key: string) => Promise<void>>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: mockGetItem,
  setItem: mockSetItem,
  removeItem: mockRemoveItem,
}));

const {
  PUSH_TOKEN_STORAGE_KEY,
  pushOptOutKey,
  getStoredPushToken,
  storeLocalPushToken,
  clearStoredPushToken,
  isPushOptedOut,
  setPushOptOut,
} = require('./push-token-storage') as typeof import('./push-token-storage');

describe('push-token-storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('pushOptOutKey', () => {
    it('generates a per-user key', () => {
      expect(pushOptOutKey('user-1')).toBe(
        '@baci_storefront_push_opt_out_user-1'
      );
      expect(pushOptOutKey('user-2')).toBe(
        '@baci_storefront_push_opt_out_user-2'
      );
    });

    it('is distinct from the token storage key', () => {
      expect(pushOptOutKey('user-1')).not.toBe(PUSH_TOKEN_STORAGE_KEY);
    });
  });

  describe('getStoredPushToken', () => {
    it('returns stored token when present', async () => {
      mockGetItem.mockResolvedValue('ExponentPushToken[abc]');
      expect(await getStoredPushToken()).toBe('ExponentPushToken[abc]');
      expect(mockGetItem).toHaveBeenCalledWith(PUSH_TOKEN_STORAGE_KEY);
    });

    it('returns null when no token stored', async () => {
      mockGetItem.mockResolvedValue(null);
      expect(await getStoredPushToken()).toBeNull();
    });

    it('returns null (fail-open) when AsyncStorage throws', async () => {
      mockGetItem.mockRejectedValue(new Error('storage error'));
      expect(await getStoredPushToken()).toBeNull();
    });
  });

  describe('storeLocalPushToken', () => {
    it('sets the token under the correct key', async () => {
      mockSetItem.mockResolvedValue(undefined);
      await storeLocalPushToken('ExponentPushToken[xyz]');
      expect(mockSetItem).toHaveBeenCalledWith(
        PUSH_TOKEN_STORAGE_KEY,
        'ExponentPushToken[xyz]'
      );
    });

    it('does not throw (fail-open) when AsyncStorage throws', async () => {
      mockSetItem.mockRejectedValue(new Error('storage error'));
      await expect(storeLocalPushToken('tok')).resolves.toBeUndefined();
    });
  });

  describe('clearStoredPushToken', () => {
    it('removes the token key', async () => {
      mockRemoveItem.mockResolvedValue(undefined);
      await clearStoredPushToken();
      expect(mockRemoveItem).toHaveBeenCalledWith(PUSH_TOKEN_STORAGE_KEY);
    });

    it('does not throw (fail-open) when AsyncStorage throws', async () => {
      mockRemoveItem.mockRejectedValue(new Error('storage error'));
      await expect(clearStoredPushToken()).resolves.toBeUndefined();
    });
  });

  describe('isPushOptedOut', () => {
    it('returns true when opt-out key is "true"', async () => {
      mockGetItem.mockResolvedValue('true');
      expect(await isPushOptedOut('user-1')).toBe(true);
      expect(mockGetItem).toHaveBeenCalledWith(pushOptOutKey('user-1'));
    });

    it('returns false when opt-out key is absent', async () => {
      mockGetItem.mockResolvedValue(null);
      expect(await isPushOptedOut('user-1')).toBe(false);
    });

    it('returns false when opt-out key has any other value', async () => {
      mockGetItem.mockResolvedValue('false');
      expect(await isPushOptedOut('user-1')).toBe(false);
    });

    it('returns false (fail-open) when AsyncStorage throws', async () => {
      mockGetItem.mockRejectedValue(new Error('storage error'));
      expect(await isPushOptedOut('user-1')).toBe(false);
    });

    it('is user-scoped — different users have independent opt-out state', async () => {
      mockGetItem.mockImplementation((key: string) =>
        Promise.resolve(key === pushOptOutKey('user-1') ? 'true' : null)
      );
      expect(await isPushOptedOut('user-1')).toBe(true);
      expect(await isPushOptedOut('user-2')).toBe(false);
    });
  });

  describe('setPushOptOut', () => {
    it('sets the per-user opt-out key when optOut is true', async () => {
      mockSetItem.mockResolvedValue(undefined);
      await setPushOptOut('user-1', true);
      expect(mockSetItem).toHaveBeenCalledWith(pushOptOutKey('user-1'), 'true');
    });

    it('removes the per-user opt-out key when optOut is false', async () => {
      mockRemoveItem.mockResolvedValue(undefined);
      await setPushOptOut('user-1', false);
      expect(mockRemoveItem).toHaveBeenCalledWith(pushOptOutKey('user-1'));
    });

    it('does not throw (fail-open) when AsyncStorage throws on set', async () => {
      mockSetItem.mockRejectedValue(new Error('storage error'));
      await expect(setPushOptOut('user-1', true)).resolves.toBeUndefined();
    });

    it('does not throw (fail-open) when AsyncStorage throws on remove', async () => {
      mockRemoveItem.mockRejectedValue(new Error('storage error'));
      await expect(setPushOptOut('user-1', false)).resolves.toBeUndefined();
    });
  });
});
