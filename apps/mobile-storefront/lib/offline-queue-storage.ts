import { asyncStorage as AsyncStorage } from '@/lib/storage';
import type { OfflineQueueState } from './offline-queue.types';

export const QUEUE_STORAGE_KEY = 'baci_offline_mutation_queue';

export interface PersistedOfflineQueueState {
  lastSyncAt: OfflineQueueState['lastSyncAt'];
  queue: OfflineQueueState['queue'];
}

export async function readPersistedOfflineQueueState(): Promise<PersistedOfflineQueueState> {
  const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
  if (!stored) {
    return { lastSyncAt: null, queue: [] };
  }

  const parsed = JSON.parse(stored) as Partial<PersistedOfflineQueueState>;
  return {
    lastSyncAt: parsed.lastSyncAt ?? null,
    queue: Array.isArray(parsed.queue) ? parsed.queue : [],
  };
}

export async function writePersistedOfflineQueueState({
  lastSyncAt,
  queue,
}: PersistedOfflineQueueState): Promise<void> {
  await AsyncStorage.setItem(
    QUEUE_STORAGE_KEY,
    JSON.stringify({
      lastSyncAt,
      queue,
    })
  );
}
