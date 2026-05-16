import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearPendingLoyaltyRedemptionId,
  getOrCreatePendingLoyaltyRedemptionId,
} from './loyalty-redemption-idempotency';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    clear: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<
  typeof AsyncStorage.getItem
>;
const mockSetItem = AsyncStorage.setItem as jest.MockedFunction<
  typeof AsyncStorage.setItem
>;
const mockRemoveItem = AsyncStorage.removeItem as jest.MockedFunction<
  typeof AsyncStorage.removeItem
>;

describe('loyalty redemption idempotency', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('creates and persists a redemption id for a scoped redemption', async () => {
    const result = await getOrCreatePendingLoyaltyRedemptionId({
      createId: () => 'redemption-id-1',
      customerId: 'customer-1',
      merchantId: 'merchant-1',
      points: 200,
    });

    expect(result).toEqual({
      key: 'loyalty-redemption:customer-1:merchant-1:200',
      redemptionId: 'redemption-id-1',
    });
    expect(mockSetItem).toHaveBeenCalledWith(
      'loyalty-redemption:customer-1:merchant-1:200',
      'redemption-id-1'
    );
  });

  it('reuses a persisted redemption id after remount or app restart', async () => {
    mockGetItem.mockResolvedValueOnce('persisted-redemption-id');

    const result = await getOrCreatePendingLoyaltyRedemptionId({
      createId: () => 'new-redemption-id',
      customerId: 'customer-1',
      merchantId: 'merchant-1',
      points: 200,
    });

    expect(result.redemptionId).toBe('persisted-redemption-id');
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('clears the pending key after a confirmed successful redemption', async () => {
    await clearPendingLoyaltyRedemptionId(
      'loyalty-redemption:customer-1:merchant-1:200'
    );

    expect(mockRemoveItem).toHaveBeenCalledWith(
      'loyalty-redemption:customer-1:merchant-1:200'
    );
  });
});
