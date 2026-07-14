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

jest.mock('@/lib/storage', () => ({
  asyncStorage: {
    getItem: mockGetItem,
    setItem: mockSetItem,
    removeItem: mockRemoveItem,
  },
}));

const {
  WALLET_FUNDING_INTENT_STORAGE_KEY,
  WALLET_FUNDING_INTENT_TTL_MS,
  clearWalletFundingIntent,
  consumeWalletFundingIntent,
  storeWalletFundingIntent,
} =
  require('./wallet-funding-intent') as typeof import('./wallet-funding-intent');

const NOW = 1_800_000_000_000;

describe('wallet-funding-intent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('storeWalletFundingIntent', () => {
    it('persists an allowlisted destination with its timestamp', async () => {
      await storeWalletFundingIntent('/utilities/airtime?repeatAmount=500');

      expect(mockSetItem).toHaveBeenCalledWith(
        WALLET_FUNDING_INTENT_STORAGE_KEY,
        JSON.stringify({
          returnTo: '/utilities/airtime?repeatAmount=500',
          savedAt: NOW,
        })
      );
    });

    it.each([
      ['//evil.com'],
      ['/auth/callback?returnTo=//evil.com'],
      ['/checkout?redirect=//evil.com'],
      ['/settings'],
      [undefined],
    ])('never stores %s, and clears any previously armed intent', async (value) => {
      await storeWalletFundingIntent(value);

      expect(mockSetItem).not.toHaveBeenCalled();
      expect(mockRemoveItem).toHaveBeenCalledWith(
        WALLET_FUNDING_INTENT_STORAGE_KEY
      );
    });

    it('swallows storage write failures', async () => {
      mockSetItem.mockRejectedValue(new Error('disk full'));

      await expect(
        storeWalletFundingIntent('/checkout')
      ).resolves.toBeUndefined();
    });
  });

  describe('consumeWalletFundingIntent', () => {
    it('returns the stored destination and clears it (single use)', async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify({ returnTo: '/checkout', savedAt: NOW - 1000 })
      );

      await expect(consumeWalletFundingIntent()).resolves.toBe('/checkout');
      expect(mockRemoveItem).toHaveBeenCalledWith(
        WALLET_FUNDING_INTENT_STORAGE_KEY
      );
    });

    it('returns undefined when nothing is stored', async () => {
      await expect(consumeWalletFundingIntent()).resolves.toBeUndefined();
    });

    it('drops an intent older than the TTL', async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify({
          returnTo: '/checkout',
          savedAt: NOW - WALLET_FUNDING_INTENT_TTL_MS - 1,
        })
      );

      await expect(consumeWalletFundingIntent()).resolves.toBeUndefined();
      expect(mockRemoveItem).toHaveBeenCalledWith(
        WALLET_FUNDING_INTENT_STORAGE_KEY
      );
    });

    it('keeps an intent that is exactly at the TTL boundary', async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify({
          returnTo: '/imei-check',
          savedAt: NOW - WALLET_FUNDING_INTENT_TTL_MS,
        })
      );

      await expect(consumeWalletFundingIntent()).resolves.toBe('/imei-check');
    });

    it('drops a future-dated intent', async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify({ returnTo: '/checkout', savedAt: NOW + 5000 })
      );

      await expect(consumeWalletFundingIntent()).resolves.toBeUndefined();
    });

    it('drops an unparseable record', async () => {
      mockGetItem.mockResolvedValue('{not-json');

      await expect(consumeWalletFundingIntent()).resolves.toBeUndefined();
      expect(mockRemoveItem).toHaveBeenCalledWith(
        WALLET_FUNDING_INTENT_STORAGE_KEY
      );
    });

    it('re-validates the stored value against the allowlist on read', async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify({
          returnTo: '/auth/callback?returnTo=//evil.com',
          savedAt: NOW,
        })
      );

      await expect(consumeWalletFundingIntent()).resolves.toBeUndefined();
    });

    it('returns undefined when the read itself fails', async () => {
      mockGetItem.mockRejectedValue(new Error('storage unavailable'));

      await expect(consumeWalletFundingIntent()).resolves.toBeUndefined();
    });
  });

  describe('clearWalletFundingIntent', () => {
    it('removes the record', async () => {
      await clearWalletFundingIntent();

      expect(mockRemoveItem).toHaveBeenCalledWith(
        WALLET_FUNDING_INTENT_STORAGE_KEY
      );
    });

    it('swallows storage failures', async () => {
      mockRemoveItem.mockRejectedValue(new Error('nope'));

      await expect(clearWalletFundingIntent()).resolves.toBeUndefined();
    });
  });
});
