import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';
import * as StoreReview from 'expo-store-review';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(),
  requestReview: jest.fn(),
}));

import { promptReviewAfterDelivery, useTrackAppOpen } from './useStoreReview';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockRemoveItem = AsyncStorage.removeItem as jest.Mock;
const mockIsAvailable = StoreReview.isAvailableAsync as jest.Mock;
const mockRequestReview = StoreReview.requestReview as jest.Mock;

const STORAGE_KEY = 'store_review_state';
const COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

function makeState(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    lastPromptedAt: null,
    completedOrders: 0,
    appOpens: 0,
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
  mockRemoveItem.mockResolvedValue(undefined);
  mockIsAvailable.mockResolvedValue(true);
  mockRequestReview.mockResolvedValue(undefined);
});

describe('useTrackAppOpen', () => {
  it('increments appOpens from zero and persists state', async () => {
    renderHook(() => useTrackAppOpen());

    await waitFor(() => {
      expect(mockGetItem).toHaveBeenCalledWith(STORAGE_KEY);
    });
    await waitFor(() => {
      expect(mockSetItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.stringContaining('"appOpens":1')
      );
    });
  });

  it('increments existing appOpens count', async () => {
    mockGetItem.mockResolvedValue(makeState({ appOpens: 5 }));

    renderHook(() => useTrackAppOpen());

    await waitFor(() => {
      expect(mockSetItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.stringContaining('"appOpens":6')
      );
    });
  });

  it('handles AsyncStorage errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockGetItem.mockRejectedValue(new Error('storage failure'));

    renderHook(() => useTrackAppOpen());

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[useStoreReview] Failed to track app open:',
        expect.any(Error)
      );
    });
    consoleSpy.mockRestore();
  });
});

describe('getReviewState defensive parsing', () => {
  it('returns defaults for malformed JSON', async () => {
    mockGetItem.mockResolvedValue('not valid json');

    await promptReviewAfterDelivery();

    expect(mockRemoveItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(mockSetItem).toHaveBeenCalled();
  });

  it('returns defaults for invalid state shape', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ wrong: 'shape' }));

    await promptReviewAfterDelivery();

    expect(mockRemoveItem).toHaveBeenCalledWith(STORAGE_KEY);
  });
});

describe('promptReviewAfterDelivery', () => {
  it('does nothing when StoreReview is unavailable', async () => {
    mockIsAvailable.mockResolvedValue(false);

    await promptReviewAfterDelivery();

    expect(mockSetItem).not.toHaveBeenCalled();
    expect(mockRequestReview).not.toHaveBeenCalled();
  });

  it('triggers review on 1st completed order', async () => {
    mockGetItem.mockResolvedValue(makeState({ completedOrders: 0 }));

    await promptReviewAfterDelivery();

    expect(mockRequestReview).toHaveBeenCalled();
    const savedState = JSON.parse(mockSetItem.mock.calls.at(-1)?.[1] ?? '{}');
    expect(savedState.completedOrders).toBe(1);
    expect(savedState.lastPromptedAt).toBeGreaterThan(0);
  });

  it('triggers review on 3rd completed order', async () => {
    mockGetItem.mockResolvedValue(makeState({ completedOrders: 2 }));

    await promptReviewAfterDelivery();

    expect(mockRequestReview).toHaveBeenCalled();
  });

  it('triggers review on every 10th order', async () => {
    mockGetItem.mockResolvedValue(makeState({ completedOrders: 19 }));

    await promptReviewAfterDelivery();

    expect(mockRequestReview).toHaveBeenCalled();
  });

  it('does not trigger review on non-milestone orders', async () => {
    mockGetItem.mockResolvedValue(makeState({ completedOrders: 4 }));

    await promptReviewAfterDelivery();

    expect(mockRequestReview).not.toHaveBeenCalled();
    expect(mockSetItem).toHaveBeenCalled();
  });

  it('respects cooldown period', async () => {
    const recentTimestamp = Date.now() - 1000;
    mockGetItem.mockResolvedValue(
      makeState({ completedOrders: 0, lastPromptedAt: recentTimestamp })
    );

    await promptReviewAfterDelivery();

    expect(mockRequestReview).not.toHaveBeenCalled();
    const savedState = JSON.parse(mockSetItem.mock.calls.at(-1)?.[1] ?? '{}');
    expect(savedState.completedOrders).toBe(1);
  });

  it('allows review after cooldown expires', async () => {
    const oldTimestamp = Date.now() - COOLDOWN_MS - 1000;
    mockGetItem.mockResolvedValue(
      makeState({ completedOrders: 0, lastPromptedAt: oldTimestamp })
    );

    await promptReviewAfterDelivery();

    expect(mockRequestReview).toHaveBeenCalled();
  });

  it('handles errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockIsAvailable.mockResolvedValue(true);
    mockGetItem.mockRejectedValue(new Error('storage error'));

    await promptReviewAfterDelivery();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[useStoreReview] Failed to prompt review:',
      expect.any(Error)
    );
    expect(mockRequestReview).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
