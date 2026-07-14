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
const CUSTOMER_ID = 'customer-1';
const OTHER_CUSTOMER_ID = 'customer-2';

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
    it('persists an allowlisted destination with its owner and timestamp', async () => {
      await storeWalletFundingIntent({
        customerId: CUSTOMER_ID,
        returnTo: '/utilities/airtime?repeatAmount=500',
      });

      expect(mockSetItem).toHaveBeenCalledWith(
        WALLET_FUNDING_INTENT_STORAGE_KEY,
        JSON.stringify({
          customerId: CUSTOMER_ID,
          returnTo: '/utilities/airtime?repeatAmount=500',
          savedAt: NOW,
        })
      );
    });

    it('never stores an ownerless intent, and clears any previously armed one', async () => {
      await storeWalletFundingIntent({
        customerId: undefined,
        returnTo: '/checkout',
      });

      expect(mockSetItem).not.toHaveBeenCalled();
      expect(mockRemoveItem).toHaveBeenCalledWith(
        WALLET_FUNDING_INTENT_STORAGE_KEY
      );
    });

    it.each([
      ['//evil.com'],
      ['/auth/callback?returnTo=//evil.com'],
      ['/checkout?redirect=//evil.com'],
      ['/settings'],
      [undefined],
    ])('never stores %s, and clears any previously armed intent', async (value) => {
      await storeWalletFundingIntent({
        customerId: CUSTOMER_ID,
        returnTo: value,
      });

      expect(mockSetItem).not.toHaveBeenCalled();
      expect(mockRemoveItem).toHaveBeenCalledWith(
        WALLET_FUNDING_INTENT_STORAGE_KEY
      );
    });

    it('swallows storage write failures', async () => {
      mockSetItem.mockRejectedValue(new Error('disk full'));

      await expect(
        storeWalletFundingIntent({
          customerId: CUSTOMER_ID,
          returnTo: '/checkout',
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('consumeWalletFundingIntent', () => {
    it('returns the stored destination and clears it (single use)', async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify({
          customerId: CUSTOMER_ID,
          returnTo: '/checkout',
          savedAt: NOW - 1000,
        })
      );

      await expect(consumeWalletFundingIntent(CUSTOMER_ID)).resolves.toBe(
        '/checkout'
      );
      expect(mockRemoveItem).toHaveBeenCalledWith(
        WALLET_FUNDING_INTENT_STORAGE_KEY
      );
    });

    it('returns undefined when nothing is stored', async () => {
      await expect(
        consumeWalletFundingIntent(CUSTOMER_ID)
      ).resolves.toBeUndefined();
    });

    it('drops an intent older than the TTL', async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify({
          customerId: CUSTOMER_ID,
          returnTo: '/checkout',
          savedAt: NOW - WALLET_FUNDING_INTENT_TTL_MS - 1,
        })
      );

      await expect(
        consumeWalletFundingIntent(CUSTOMER_ID)
      ).resolves.toBeUndefined();
      expect(mockRemoveItem).toHaveBeenCalledWith(
        WALLET_FUNDING_INTENT_STORAGE_KEY
      );
    });

    it('keeps an intent that is exactly at the TTL boundary', async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify({
          customerId: CUSTOMER_ID,
          returnTo: '/imei-check',
          savedAt: NOW - WALLET_FUNDING_INTENT_TTL_MS,
        })
      );

      await expect(consumeWalletFundingIntent(CUSTOMER_ID)).resolves.toBe(
        '/imei-check'
      );
    });

    it('drops a future-dated intent', async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify({
          customerId: CUSTOMER_ID,
          returnTo: '/checkout',
          savedAt: NOW + 5000,
        })
      );

      await expect(
        consumeWalletFundingIntent(CUSTOMER_ID)
      ).resolves.toBeUndefined();
    });

    it('drops an unparseable record', async () => {
      mockGetItem.mockResolvedValue('{not-json');

      await expect(
        consumeWalletFundingIntent(CUSTOMER_ID)
      ).resolves.toBeUndefined();
      expect(mockRemoveItem).toHaveBeenCalledWith(
        WALLET_FUNDING_INTENT_STORAGE_KEY
      );
    });

    it('re-validates the stored value against the allowlist on read', async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify({
          customerId: CUSTOMER_ID,
          returnTo: '/auth/callback?returnTo=//evil.com',
          savedAt: NOW,
        })
      );

      await expect(
        consumeWalletFundingIntent(CUSTOMER_ID)
      ).resolves.toBeUndefined();
    });

    it('returns undefined when the read itself fails', async () => {
      mockGetItem.mockRejectedValue(new Error('storage unavailable'));

      await expect(
        consumeWalletFundingIntent(CUSTOMER_ID)
      ).resolves.toBeUndefined();
    });

    it("never resumes another customer's intent, and clears it", async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify({
          customerId: OTHER_CUSTOMER_ID,
          returnTo: '/checkout',
          savedAt: NOW - 1000,
        })
      );

      await expect(
        consumeWalletFundingIntent(CUSTOMER_ID)
      ).resolves.toBeUndefined();
      expect(mockRemoveItem).toHaveBeenCalledWith(
        WALLET_FUNDING_INTENT_STORAGE_KEY
      );
    });

    it('still resumes the same customer across a sign-out / sign-in cycle', async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify({
          customerId: CUSTOMER_ID,
          returnTo: '/checkout',
          savedAt: NOW - 1000,
        })
      );

      await expect(consumeWalletFundingIntent(CUSTOMER_ID)).resolves.toBe(
        '/checkout'
      );
    });

    it('consumes nothing when no customer is signed in, and clears the record', async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify({
          customerId: CUSTOMER_ID,
          returnTo: '/checkout',
          savedAt: NOW - 1000,
        })
      );

      await expect(
        consumeWalletFundingIntent(undefined)
      ).resolves.toBeUndefined();
      expect(mockRemoveItem).toHaveBeenCalledWith(
        WALLET_FUNDING_INTENT_STORAGE_KEY
      );
    });

    it('drops a legacy unscoped record left by a previous build', async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify({ returnTo: '/checkout', savedAt: NOW - 1000 })
      );

      await expect(
        consumeWalletFundingIntent(CUSTOMER_ID)
      ).resolves.toBeUndefined();
      expect(mockRemoveItem).toHaveBeenCalledWith(
        WALLET_FUNDING_INTENT_STORAGE_KEY
      );
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
