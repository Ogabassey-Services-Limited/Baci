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

import {
  promptReviewAfterDelivery,
  REVIEW_COOLDOWN_MS,
  REVIEW_STORAGE_KEY,
  useTrackAppOpen,
} from './useStoreReview';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockRemoveItem = AsyncStorage.removeItem as jest.Mock;
const mockIsAvailable = StoreReview.isAvailableAsync as jest.Mock;
const mockRequestReview = StoreReview.requestReview as jest.Mock;

function makeState(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    lastPromptedAt: null,
    completedOrders: 0,
    appOpens: 0,
    ...overrides,
  });
}

let consoleSpy: jest.SpyInstance | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
  mockRemoveItem.mockResolvedValue(undefined);
  mockIsAvailable.mockResolvedValue(true);
  mockRequestReview.mockResolvedValue(undefined);
});

afterEach(() => {
  consoleSpy?.mockRestore();
  consoleSpy = undefined;
});

describe('useTrackAppOpen', () => {
  it('increments appOpens from zero and persists state', async () => {
    renderHook(() => useTrackAppOpen());

    await waitFor(() => {
      expect(mockGetItem).toHaveBeenCalledWith(REVIEW_STORAGE_KEY);
    });
    await waitFor(() => {
      expect(mockSetItem).toHaveBeenCalledWith(
        REVIEW_STORAGE_KEY,
        expect.stringContaining('"appOpens":1')
      );
    });
  });

  it('increments existing appOpens count', async () => {
    mockGetItem.mockResolvedValue(makeState({ appOpens: 5 }));

    renderHook(() => useTrackAppOpen());

    await waitFor(() => {
      expect(mockSetItem).toHaveBeenCalledWith(
        REVIEW_STORAGE_KEY,
        expect.stringContaining('"appOpens":6')
      );
    });
  });

  it('handles AsyncStorage errors gracefully', async () => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockGetItem.mockRejectedValue(new Error('storage failure'));

    renderHook(() => useTrackAppOpen());

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[useStoreReview] Failed to track app open:',
        expect.any(Error)
      );
    });
  });
});

describe('getReviewState defensive parsing', () => {
  it('returns defaults for malformed JSON', async () => {
    mockGetItem.mockResolvedValue('not valid json');

    await promptReviewAfterDelivery();

    expect(mockRemoveItem).toHaveBeenCalledWith(REVIEW_STORAGE_KEY);
    expect(mockSetItem).toHaveBeenCalled();
  });

  it('returns defaults for invalid state shape', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ wrong: 'shape' }));

    await promptReviewAfterDelivery();

    expect(mockRemoveItem).toHaveBeenCalledWith(REVIEW_STORAGE_KEY);
    expect(mockSetItem).toHaveBeenCalled();
    const savedState = JSON.parse(mockSetItem.mock.calls.at(-1)?.[1] ?? '{}');
    expect(savedState.completedOrders).toBe(1);
    expect(savedState.appOpens).toBe(0);
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
    const oldTimestamp = Date.now() - REVIEW_COOLDOWN_MS - 1000;
    mockGetItem.mockResolvedValue(
      makeState({ completedOrders: 0, lastPromptedAt: oldTimestamp })
    );

    await promptReviewAfterDelivery();

    expect(mockRequestReview).toHaveBeenCalled();
  });

  it('handles getItem errors gracefully', async () => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockGetItem.mockRejectedValue(new Error('storage error'));

    await promptReviewAfterDelivery();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[useStoreReview] Failed to prompt review:',
      expect.any(Error)
    );
    expect(mockRequestReview).not.toHaveBeenCalled();
  });

  it('handles setItem errors gracefully', async () => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockGetItem.mockResolvedValue(makeState({ completedOrders: 0 }));
    mockSetItem.mockRejectedValue(new Error('write error'));

    await promptReviewAfterDelivery();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[useStoreReview] Failed to prompt review:',
      expect.any(Error)
    );
  });
});
