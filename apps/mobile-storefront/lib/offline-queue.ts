/**
 * Offline Mutation Queue
 *
 * 2026 Best Practices for Offline-First Mobile Apps:
 * - Queue critical mutations (orders, cart updates) when offline
 * - Persist queue to AsyncStorage for app restart resilience
 * - Process queue automatically when network is restored
 * - Provide UI feedback for pending operations
 * - Handle retry with exponential backoff
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/mutations#mutation-side-effects
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { createLogger } from './logger';

const log = createLogger('OfflineQueue');

const QUEUE_STORAGE_KEY = 'baci_offline_mutation_queue';

export type MutationType = 'create_order' | 'update_cart' | 'submit_review';

export interface QueuedMutation {
  /** Unique identifier for this mutation */
  id: string;
  /** Type of mutation */
  type: MutationType;
  /** Serialized payload data */
  payload: string;
  /** Timestamp when mutation was queued */
  queuedAt: number;
  /** Number of retry attempts */
  retryCount: number;
  /** Last error message if any */
  lastError?: string;
}

export interface OfflineQueueState {
  /** All queued mutations */
  queue: QueuedMutation[];
  /** Whether queue is currently processing */
  isProcessing: boolean;
  /** Last sync timestamp */
  lastSyncAt: number | null;
}

type MutationHandler = (payload: unknown) => Promise<unknown>;

/**
 * Offline Mutation Queue Manager
 *
 * @example
 * ```ts
 * // Initialize at app start
 * await offlineQueue.initialize();
 *
 * // Queue a mutation when offline
 * await offlineQueue.enqueue('create_order', orderData);
 *
 * // Register handlers for mutation types
 * offlineQueue.registerHandler('create_order', async (data) => {
 *   return await createOrder(data);
 * });
 * ```
 */
class OfflineQueueManager {
  private state: OfflineQueueState = {
    queue: [],
    isProcessing: false,
    lastSyncAt: null,
  };

  private handlers: Map<MutationType, MutationHandler> = new Map();
  private listeners: Set<(state: OfflineQueueState) => void> = new Set();
  private unsubscribeNetInfo: (() => void) | null = null;
  // BUG-4-002 FIX: Prevent duplicate initialization with promise deduplication
  private initPromise: Promise<void> | null = null;
  private failedMutations: QueuedMutation[] = [];
  private errorCallback: ((mutation: QueuedMutation) => void) | null = null;

  /**
   * Initialize the queue manager
   * Call this at app startup
   * BUG-4-002 FIX: Safe to call multiple times - returns existing promise if already initializing
   */
  async initialize(): Promise<void> {
    // Return existing promise if initialization is in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Create new initialization promise
    this.initPromise = this._doInitialize();

    try {
      await this.initPromise;
    } catch (error) {
      // Clear promise on failure so initialization can be retried
      this.initPromise = null;
      throw error;
    }
  }

  /**
   * Internal initialization logic
   */
  private async _doInitialize(): Promise<void> {
    // Clean up any existing listener first
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }

    // Load persisted queue
    await this.loadQueue();

    // Listen for network changes
    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const isOnline =
        state.isConnected === true && state.isInternetReachable !== false;

      if (isOnline && this.state.queue.length > 0 && !this.state.isProcessing) {
        // Network restored - process queue
        this.processQueue();
      }
    });

    // Initial check - process if online and queue has items
    const netState = await NetInfo.fetch();
    const isOnline =
      netState.isConnected === true && netState.isInternetReachable !== false;

    if (isOnline && this.state.queue.length > 0) {
      this.processQueue();
    }
  }

  /**
   * Clean up listeners
   */
  destroy(): void {
    this.unsubscribeNetInfo?.();
    this.listeners.clear();
    this.initPromise = null;
  }

  /**
   * BUG-4-008 FIX: Set callback for failed mutations after max retries
   */
  setErrorCallback(callback: (mutation: QueuedMutation) => void): void {
    this.errorCallback = callback;
  }

  /**
   * BUG-4-008 FIX: Get all failed mutations
   */
  getFailedMutations(): QueuedMutation[] {
    return [...this.failedMutations];
  }

  /**
   * BUG-4-008 FIX: Clear failed mutations (after user reviews them)
   */
  clearFailedMutations(): void {
    this.failedMutations = [];
  }

  /**
   * Register a handler for a mutation type
   */
  registerHandler(type: MutationType, handler: MutationHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Add a mutation to the queue
   */
  async enqueue<T>(type: MutationType, payload: T): Promise<string> {
    const id = `${type}_${Date.now()}_${Crypto.randomUUID().replace(/-/g, '').substring(0, 9)}`;

    const mutation: QueuedMutation = {
      id,
      type,
      payload: JSON.stringify(payload),
      queuedAt: Date.now(),
      retryCount: 0,
    };

    this.state.queue.push(mutation);
    await this.persistQueue();
    this.notifyListeners();

    log.info(`Queued mutation: ${type} (${id})`);

    // Try to process immediately if online
    const netState = await NetInfo.fetch();
    const isOnline =
      netState.isConnected === true && netState.isInternetReachable !== false;

    if (isOnline && !this.state.isProcessing) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Remove a mutation from the queue
   */
  async remove(id: string): Promise<void> {
    this.state.queue = this.state.queue.filter((m) => m.id !== id);
    await this.persistQueue();
    this.notifyListeners();
  }

  /**
   * Get current queue state
   */
  getState(): OfflineQueueState {
    return { ...this.state };
  }

  /**
   * Get pending count for a specific mutation type
   */
  getPendingCount(type?: MutationType): number {
    if (type) {
      return this.state.queue.filter((m) => m.type === type).length;
    }
    return this.state.queue.length;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: OfflineQueueState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Process all queued mutations
   */
  private async processQueue(): Promise<void> {
    if (this.state.isProcessing || this.state.queue.length === 0) {
      return;
    }

    this.state.isProcessing = true;
    this.notifyListeners();

    log.info(`Processing ${this.state.queue.length} queued mutations`);

    // Process mutations in order (FIFO), draining the live queue
    // so items enqueued mid-flight are picked up in the same pass
    while (this.state.queue.length > 0) {
      const mutation = this.state.queue[0];
      const handler = this.handlers.get(mutation.type);

      if (!handler) {
        log.warn(`No handler for mutation type: ${mutation.type}`);
        await this.remove(mutation.id);
        continue;
      }

      try {
        const payload = JSON.parse(mutation.payload);
        await handler(payload);

        // Success - remove from queue
        await this.remove(mutation.id);
        log.info(`Successfully processed: ${mutation.id}`);
      } catch (error) {
        // Failed - update retry count
        mutation.retryCount++;
        mutation.lastError =
          error instanceof Error ? error.message : 'Unknown error';

        log.error(`Failed to process ${mutation.id}:`, error);

        // BUG-4-008 FIX: Store failed mutations and notify callback instead of silently removing
        if (mutation.retryCount >= 5) {
          log.warn(
            `Max retries exceeded for ${mutation.id}, moving to failed list`
          );

          // Store in failed mutations for UI review
          this.failedMutations.push({ ...mutation });

          // Notify error callback if registered
          if (this.errorCallback) {
            this.errorCallback({ ...mutation });
          }

          await this.remove(mutation.id);
        } else {
          await this.persistQueue();
        }

        // Check if still online before continuing
        const netState = await NetInfo.fetch();
        const isOnline =
          netState.isConnected === true &&
          netState.isInternetReachable !== false;

        if (!isOnline) {
          log.info('Network lost during processing, stopping');
          break;
        }

        // Exponential backoff before next retry
        const delay = Math.min(1000 * 2 ** mutation.retryCount, 30000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    this.state.isProcessing = false;
    this.state.lastSyncAt = Date.now();
    await this.persistQueue();
    this.notifyListeners();
  }

  /**
   * Load queue from AsyncStorage
   */
  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.state.queue = parsed.queue || [];
        this.state.lastSyncAt = parsed.lastSyncAt || null;
      }
    } catch (error) {
      log.warn('Failed to load queue:', error);
    }
  }

  /**
   * Persist queue to AsyncStorage
   */
  private async persistQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        QUEUE_STORAGE_KEY,
        JSON.stringify({
          queue: this.state.queue,
          lastSyncAt: this.state.lastSyncAt,
        })
      );
    } catch (error) {
      log.warn('Failed to persist queue:', error);
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }
}

// Export singleton instance
export const offlineQueue = new OfflineQueueManager();

/**
 * Hook for React components to access offline queue state
 *
 * @example
 * ```tsx
 * function OrderButton() {
 *   const { pendingCount, isProcessing } = useOfflineQueue();
 *
 *   if (pendingCount > 0) {
 *     return <Text>Syncing {pendingCount} orders...</Text>;
 *   }
 *
 *   return <Button>Place Order</Button>;
 * }
 * ```
 */
import { useEffect, useState } from 'react';

export function useOfflineQueue() {
  const [state, setState] = useState<OfflineQueueState>(
    offlineQueue.getState()
  );

  useEffect(() => {
    return offlineQueue.subscribe(setState);
  }, []);

  return {
    queue: state.queue,
    pendingCount: state.queue.length,
    isProcessing: state.isProcessing,
    lastSyncAt: state.lastSyncAt,
    enqueue: offlineQueue.enqueue.bind(offlineQueue),
    getPendingCount: offlineQueue.getPendingCount.bind(offlineQueue),
  };
}
