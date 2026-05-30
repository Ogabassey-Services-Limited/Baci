export type MutationType = 'create_order' | 'update_cart' | 'submit_review';

export interface QueuedMutation {
  id: string;
  type: MutationType;
  payload: string;
  queuedAt: number;
  retryCount: number;
  lastError?: string;
}

export interface OfflineQueueState {
  queue: QueuedMutation[];
  isProcessing: boolean;
  lastSyncAt: number | null;
}
