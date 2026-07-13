import { jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';
import type { OfflineQueueState } from './offline-queue.types';
import { useOfflineQueue } from './use-offline-queue';

const mockEnqueue = jest.fn();
const mockGetPendingCount = jest.fn();
const mockSubscribe = jest.fn();

let mockState: OfflineQueueState = {
  isProcessing: false,
  lastSyncAt: null,
  queue: [],
};

jest.mock('./offline-queue', () => ({
  offlineQueue: {
    enqueue: (...args: unknown[]) => mockEnqueue(...args),
    getPendingCount: (...args: unknown[]) => mockGetPendingCount(...args),
    getState: () => mockState,
    subscribe: (...args: unknown[]) => mockSubscribe(...args),
  },
}));

describe('useOfflineQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState = {
      isProcessing: true,
      lastSyncAt: 1000,
      queue: [
        {
          id: 'create_order_1',
          payload: '{}',
          queuedAt: 500,
          retryCount: 0,
          type: 'create_order',
        },
      ],
    };
    mockSubscribe.mockReturnValue(jest.fn());
  });

  it('returns queue state and bound queue actions', () => {
    const { result } = renderHook(() => useOfflineQueue());

    expect(result.current.queue).toEqual(mockState.queue);
    expect(result.current.pendingCount).toBe(1);
    expect(result.current.isProcessing).toBe(true);
    expect(result.current.lastSyncAt).toBe(1000);
    expect(result.current.enqueue).toEqual(expect.any(Function));
    expect(result.current.getPendingCount).toEqual(expect.any(Function));
    expect(mockSubscribe).toHaveBeenCalledWith(expect.any(Function));
  });
});
