import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearPendingLoyaltyRedemptionId,
  getOrCreatePendingLoyaltyRedemptionId,
  getReusablePendingLoyaltyRedemptionId,
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
      attemptId: 'attempt-1',
      createId: () => 'redemption-id-1',
      customerId: 'customer-1',
      currentPoints: 1000,
      merchantId: 'merchant-1',
      now: () => 1_000,
      points: 200,
    });

    expect(result).toEqual({
      key: 'loyalty-redemption:customer-1:merchant-1:200',
      redemptionId: 'redemption-id-1',
    });
    expect(mockSetItem).toHaveBeenCalledWith(
      'loyalty-redemption:customer-1:merchant-1:200',
      JSON.stringify({
        attemptId: 'attempt-1',
        createdAt: 1_000,
        pointsBeforeRedeem: 1000,
        redemptionId: 'redemption-id-1',
        version: 2,
      })
    );
  });

  it('reuses a persisted redemption id for the same balance snapshot', async () => {
    mockGetItem.mockResolvedValueOnce(
      JSON.stringify({
        attemptId: 'attempt-1',
        createdAt: 1_000,
        pointsBeforeRedeem: 1000,
        redemptionId: 'persisted-redemption-id',
        version: 2,
      })
    );

    const result = await getOrCreatePendingLoyaltyRedemptionId({
      attemptId: 'attempt-1',
      createId: () => 'new-redemption-id',
      customerId: 'customer-1',
      currentPoints: 1000,
      merchantId: 'merchant-1',
      now: () => 1_500,
      points: 200,
    });

    expect(result.redemptionId).toBe('persisted-redemption-id');
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('rotates the redemption id when the attempt changes even if the balance snapshot matches', async () => {
    mockGetItem.mockResolvedValueOnce(
      JSON.stringify({
        attemptId: 'previous-attempt',
        createdAt: 1_000,
        pointsBeforeRedeem: 1000,
        redemptionId: 'persisted-redemption-id',
        version: 2,
      })
    );

    const result = await getOrCreatePendingLoyaltyRedemptionId({
      attemptId: 'current-attempt',
      createId: () => 'new-redemption-id',
      customerId: 'customer-1',
      currentPoints: 1000,
      merchantId: 'merchant-1',
      now: () => 1_500,
      points: 200,
    });

    expect(result.redemptionId).toBe('new-redemption-id');
    expect(mockRemoveItem).toHaveBeenCalledWith(
      'loyalty-redemption:customer-1:merchant-1:200'
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      'loyalty-redemption:customer-1:merchant-1:200',
      JSON.stringify({
        attemptId: 'current-attempt',
        createdAt: 1_500,
        pointsBeforeRedeem: 1000,
        redemptionId: 'new-redemption-id',
        version: 2,
      })
    );
  });

  it('reuses a live-attempt redemption id even when balance refreshes before retry', async () => {
    mockGetItem.mockResolvedValueOnce(
      JSON.stringify({
        attemptId: 'attempt-1',
        createdAt: 1_000,
        pointsBeforeRedeem: 1000,
        redemptionId: 'pending-redemption-id',
        version: 2,
      })
    );

    const result = await getOrCreatePendingLoyaltyRedemptionId({
      attemptId: 'attempt-1',
      createId: () => 'new-redemption-id',
      customerId: 'customer-1',
      currentPoints: 800,
      merchantId: 'merchant-1',
      now: () => 2_000,
      points: 200,
    });

    expect(result.redemptionId).toBe('pending-redemption-id');
    expect(mockRemoveItem).not.toHaveBeenCalled();
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('finds a reusable live-attempt redemption id without creating a new record', async () => {
    mockGetItem.mockResolvedValueOnce(
      JSON.stringify({
        attemptId: 'attempt-1',
        createdAt: 1_000,
        pointsBeforeRedeem: 200,
        redemptionId: 'pending-redemption-id',
        version: 2,
      })
    );

    const result = await getReusablePendingLoyaltyRedemptionId({
      attemptId: 'attempt-1',
      customerId: 'customer-1',
      merchantId: 'merchant-1',
      now: () => 1_500,
      points: 200,
    });

    expect(result).toEqual({
      key: 'loyalty-redemption:customer-1:merchant-1:200',
      pointsBeforeRedeem: 200,
      redemptionId: 'pending-redemption-id',
    });
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('does not reuse an expired live-attempt redemption id', async () => {
    mockGetItem.mockResolvedValueOnce(
      JSON.stringify({
        attemptId: 'attempt-1',
        createdAt: 1_000,
        pointsBeforeRedeem: 200,
        redemptionId: 'expired-redemption-id',
        version: 2,
      })
    );

    const result = await getReusablePendingLoyaltyRedemptionId({
      attemptId: 'attempt-1',
      customerId: 'customer-1',
      merchantId: 'merchant-1',
      now: () => 1_801_001,
      points: 200,
    });

    expect(result).toBeNull();
    expect(mockRemoveItem).toHaveBeenCalledWith(
      'loyalty-redemption:customer-1:merchant-1:200'
    );
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('replaces expired pending redemption ids even when the balance matches', async () => {
    mockGetItem.mockResolvedValueOnce(
      JSON.stringify({
        attemptId: 'attempt-1',
        createdAt: 1_000,
        pointsBeforeRedeem: 1000,
        redemptionId: 'expired-redemption-id',
        version: 2,
      })
    );

    const result = await getOrCreatePendingLoyaltyRedemptionId({
      attemptId: 'attempt-1',
      createId: () => 'new-redemption-id',
      customerId: 'customer-1',
      currentPoints: 1000,
      merchantId: 'merchant-1',
      now: () => 1_801_001,
      points: 200,
    });

    expect(result.redemptionId).toBe('new-redemption-id');
    expect(mockRemoveItem).toHaveBeenCalledWith(
      'loyalty-redemption:customer-1:merchant-1:200'
    );
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
