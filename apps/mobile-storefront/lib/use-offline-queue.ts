import { useEffect, useState } from 'react';
import { offlineQueue } from './offline-queue';
import type { OfflineQueueState } from './offline-queue.types';

export function useOfflineQueue() {
  const [state, setState] = useState<OfflineQueueState>(
    offlineQueue.getState()
  );

  useEffect(() => {
    return offlineQueue.subscribe(setState);
  }, []);

  return {
    enqueue: offlineQueue.enqueue.bind(offlineQueue),
    getPendingCount: offlineQueue.getPendingCount.bind(offlineQueue),
    isProcessing: state.isProcessing,
    lastSyncAt: state.lastSyncAt,
    pendingCount: state.queue.length,
    queue: state.queue,
  };
}
