import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { useEffect } from 'react';

const REVIEW_STORAGE_KEY = 'store_review_state';
const REVIEW_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

interface ReviewState {
  lastPromptedAt: number | null;
  completedOrders: number;
  appOpens: number;
}

const DEFAULT_STATE: ReviewState = {
  lastPromptedAt: null,
  completedOrders: 0,
  appOpens: 0,
};

// Module-level promise chain to serialize read-modify-write operations
let pendingOp = Promise.resolve();
function withStorageLock<T>(fn: () => Promise<T>): Promise<T> {
  const op = pendingOp.then(fn, fn);
  pendingOp = op.then(
    () => {},
    () => {}
  );
  return op;
}

function isValidReviewState(value: unknown): value is ReviewState {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    (obj.lastPromptedAt === null || typeof obj.lastPromptedAt === 'number') &&
    typeof obj.completedOrders === 'number' &&
    typeof obj.appOpens === 'number'
  );
}

async function getReviewState(): Promise<ReviewState> {
  const raw = await AsyncStorage.getItem(REVIEW_STORAGE_KEY);
  if (!raw) return { ...DEFAULT_STATE };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValidReviewState(parsed)) return parsed;
    await AsyncStorage.removeItem(REVIEW_STORAGE_KEY);
    return { ...DEFAULT_STATE };
  } catch {
    await AsyncStorage.removeItem(REVIEW_STORAGE_KEY);
    return { ...DEFAULT_STATE };
  }
}

async function setReviewState(state: ReviewState): Promise<void> {
  await AsyncStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(state));
}

/**
 * Tracks app opens for review prompt eligibility.
 */
export function useTrackAppOpen(): void {
  useEffect(() => {
    withStorageLock(async () => {
      try {
        const state = await getReviewState();
        state.appOpens += 1;
        await setReviewState(state);
      } catch (error) {
        console.error('[useStoreReview] Failed to track app open:', error);
      }
    });
  }, []);
}

/**
 * Call after a successful order delivery to potentially trigger a review prompt.
 * Triggers after: 1st completed order, 3rd order, or every 10th order thereafter.
 */
export async function promptReviewAfterDelivery(): Promise<void> {
  return withStorageLock(async () => {
    try {
      const isAvailable = await StoreReview.isAvailableAsync();
      if (!isAvailable) return;

      const state = await getReviewState();
      state.completedOrders += 1;

      const shouldPrompt =
        state.completedOrders === 1 ||
        state.completedOrders === 3 ||
        state.completedOrders % 10 === 0;

      if (!shouldPrompt) {
        await setReviewState(state);
        return;
      }

      // Enforce cooldown
      if (
        state.lastPromptedAt &&
        Date.now() - state.lastPromptedAt < REVIEW_COOLDOWN_MS
      ) {
        await setReviewState(state);
        return;
      }

      state.lastPromptedAt = Date.now();
      await setReviewState(state);
      await StoreReview.requestReview();
    } catch (error) {
      console.error('[useStoreReview] Failed to prompt review:', error);
    }
  });
}
