import { jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueuedMutation } from './offline-queue.types';
import {
  QUEUE_STORAGE_KEY,
  readPersistedOfflineQueueState,
  writePersistedOfflineQueueState,
} from './offline-queue-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<
  typeof AsyncStorage.getItem
>;
const mockSetItem = AsyncStorage.setItem as jest.MockedFunction<
  typeof AsyncStorage.setItem
>;

const MUTATION: QueuedMutation = {
  id: 'create_order_1',
  lastError: 'timeout',
  payload: '{"orderId":"order-1"}',
  queuedAt: 1000,
  retryCount: 1,
  type: 'create_order',
};

describe('offline queue storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty persisted state when storage is empty', async () => {
    mockGetItem.mockResolvedValue(null);

    await expect(readPersistedOfflineQueueState()).resolves.toEqual({
      lastSyncAt: null,
      queue: [],
    });
    expect(mockGetItem).toHaveBeenCalledWith(QUEUE_STORAGE_KEY);
  });

  it('normalizes malformed persisted queue data', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ lastSyncAt: 2000 }));

    await expect(readPersistedOfflineQueueState()).resolves.toEqual({
      lastSyncAt: 2000,
      queue: [],
    });
  });

  it('writes queue and sync timestamp to AsyncStorage', async () => {
    mockSetItem.mockResolvedValue(undefined);

    await writePersistedOfflineQueueState({
      lastSyncAt: 3000,
      queue: [MUTATION],
    });

    expect(mockSetItem).toHaveBeenCalledWith(
      QUEUE_STORAGE_KEY,
      JSON.stringify({ lastSyncAt: 3000, queue: [MUTATION] })
    );
  });
});
