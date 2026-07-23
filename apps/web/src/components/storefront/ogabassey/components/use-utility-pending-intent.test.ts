import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  UTILITY_PENDING_INTENT_STORAGE_KEY,
  useUtilityPendingIntent,
} from './use-utility-pending-intent';

const draft = {
  amount: '500',
  networkProvider: 'MTN',
  phoneNumber: '08012345678',
  tab: 'airtime' as const,
};

describe('useUtilityPendingIntent', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    sessionStorage.clear();
  });

  describe('with the dark-launch flag off', () => {
    it('never writes an intent and never reads one back', () => {
      sessionStorage.setItem(
        UTILITY_PENDING_INTENT_STORAGE_KEY,
        JSON.stringify(draft)
      );

      const { result } = renderHook(() => useUtilityPendingIntent());
      act(() => {
        result.current.saveIntent({ ...draft, amount: '900' });
        vi.advanceTimersByTime(1_000);
      });

      expect(result.current.intent).toBeNull();
      expect(
        JSON.parse(
          sessionStorage.getItem(UTILITY_PENDING_INTENT_STORAGE_KEY) ?? 'null'
        )
      ).toEqual(draft);
    });
  });

  describe('with the dark-launch flag on', () => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_WALLET_FUNDING_CHECK_LOOP_ENABLED', 'true');
    });

    it('persists the draft to sessionStorage so it survives a tab eviction', () => {
      const { result } = renderHook(() => useUtilityPendingIntent());

      act(() => {
        result.current.saveIntent(draft);
      });
      // Second act: the debounced write is scheduled by an effect, which only
      // runs once the state update above has been committed.
      act(() => {
        vi.advanceTimersByTime(1_000);
      });

      expect(result.current.intent).toEqual(draft);
      expect(
        JSON.parse(
          sessionStorage.getItem(UTILITY_PENDING_INTENT_STORAGE_KEY) ?? 'null'
        )
      ).toEqual(draft);
    });

    it('restores a previously stored intent on a fresh mount', () => {
      sessionStorage.setItem(
        UTILITY_PENDING_INTENT_STORAGE_KEY,
        JSON.stringify(draft)
      );

      const { result } = renderHook(() => useUtilityPendingIntent());

      expect(result.current.intent).toEqual(draft);
    });

    it('ignores a malformed stored intent instead of prefilling a money form with it', () => {
      sessionStorage.setItem(
        UTILITY_PENDING_INTENT_STORAGE_KEY,
        JSON.stringify({ amount: 500, tab: 'power' })
      );

      const { result } = renderHook(() => useUtilityPendingIntent());

      expect(result.current.intent).toBeNull();
    });

    it('clears the intent once the purchase completes', () => {
      sessionStorage.setItem(
        UTILITY_PENDING_INTENT_STORAGE_KEY,
        JSON.stringify(draft)
      );
      const { result } = renderHook(() => useUtilityPendingIntent());

      act(() => {
        result.current.clearIntent();
        vi.advanceTimersByTime(1_000);
      });

      expect(result.current.intent).toBeNull();
    });
  });
});
