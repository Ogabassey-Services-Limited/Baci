import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { asyncStorage } from '@/lib/storage';
import {
  consumeWalletFundingIntent,
  WALLET_FUNDING_INTENT_STORAGE_KEY,
} from './wallet-funding-intent';

jest.mock('@/lib/storage', () => ({
  asyncStorage: {
    getItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const getItem = asyncStorage.getItem as jest.MockedFunction<
  typeof asyncStorage.getItem
>;
const removeItem = asyncStorage.removeItem as jest.MockedFunction<
  typeof asyncStorage.removeItem
>;

describe('consumeWalletFundingIntent cancellation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getItem.mockResolvedValue(
      JSON.stringify({
        customerId: 'customer-1',
        returnTo: '/checkout',
        savedAt: Date.now(),
      })
    );
  });

  it('leaves the single-use intent for a newer tap when consumption is stale', async () => {
    await expect(
      consumeWalletFundingIntent('customer-1', () => false)
    ).resolves.toBeUndefined();

    expect(getItem).toHaveBeenCalledWith(WALLET_FUNDING_INTENT_STORAGE_KEY);
    expect(removeItem).not.toHaveBeenCalled();
  });
});
