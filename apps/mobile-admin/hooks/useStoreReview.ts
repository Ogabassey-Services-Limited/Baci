import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { useEffect } from 'react';

const REVIEW_STORAGE_KEY = 'baci_review_state';
const REVIEW_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

interface ReviewState {
  lastPromptedAt: number | null;
  totalSales: number;
  appOpens: number;
}

async function getReviewState(): Promise<ReviewState> {
  const raw = await AsyncStorage.getItem(REVIEW_STORAGE_KEY);
  if (!raw) return { lastPromptedAt: null, totalSales: 0, appOpens: 0 };
  return JSON.parse(raw) as ReviewState;
}

async function setReviewState(state: ReviewState): Promise<void> {
  await AsyncStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(state));
}

/**
 * Tracks app opens and triggers a store review prompt at moments of delight.
 * Apple limits to 3 prompts per 365 days; we enforce a 90-day cooldown.
 */
export function useTrackAppOpen(): void {
  useEffect(() => {
    (async () => {
      const state = await getReviewState();
      state.appOpens += 1;
      await setReviewState(state);
    })();
  }, []);
}

/**
 * Call after a successful sale to potentially trigger a review prompt.
 * Triggers after: first sale, 10th sale, or every 50th sale thereafter.
 */
export async function promptReviewAfterSale(): Promise<void> {
  const isAvailable = await StoreReview.isAvailableAsync();
  if (!isAvailable) return;

  const state = await getReviewState();
  state.totalSales += 1;

  const shouldPrompt =
    state.totalSales === 1 ||
    state.totalSales === 10 ||
    state.totalSales % 50 === 0;

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
}
