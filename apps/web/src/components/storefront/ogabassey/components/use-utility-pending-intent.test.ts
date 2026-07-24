import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  UTILITY_PENDING_INTENT_STORAGE_KEY,
  useUtilityPendingIntent,
} from './use-utility-pending-intent';

const CUSTOMER_A = 'customer-a';
const CUSTOMER_B = 'customer-b';

const draft = {
  amount: '500',
  networkProvider: 'MTN',
  phoneNumber: '08012345678',
  tab: 'airtime' as const,
};

const storedFor = (customerId: string) => ({ ...draft, customerId });

function readStored(): unknown {
  return JSON.parse(
    sessionStorage.getItem(UTILITY_PENDING_INTENT_STORAGE_KEY) ?? 'null'
  );
}

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
        JSON.stringify(storedFor(CUSTOMER_A))
      );

      const { result } = renderHook(() =>
        useUtilityPendingIntent(CUSTOMER_A)
      );
      act(() => {
        result.current.saveIntent({ ...draft, amount: '900' });
        vi.advanceTimersByTime(1_000);
      });

      expect(result.current.intent).toBeNull();
      expect(readStored()).toEqual(storedFor(CUSTOMER_A));
    });
  });

  describe('with the dark-launch flag on', () => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_WALLET_FUNDING_CHECK_LOOP_ENABLED', 'true');
    });

    it('persists the draft stamped with the active customer id', () => {
      const { result } = renderHook(() =>
        useUtilityPendingIntent(CUSTOMER_A)
      );

      act(() => {
        result.current.saveIntent(draft);
      });
      // Second act: the debounced write is scheduled by an effect, which only
      // runs once the state update above has been committed.
      act(() => {
        vi.advanceTimersByTime(1_000);
      });

      expect(result.current.intent).toEqual(draft);
      expect(readStored()).toEqual(storedFor(CUSTOMER_A));
    });

    it('restores a previously stored intent for the same customer', () => {
      sessionStorage.setItem(
        UTILITY_PENDING_INTENT_STORAGE_KEY,
        JSON.stringify(storedFor(CUSTOMER_A))
      );

      const { result } = renderHook(() =>
        useUtilityPendingIntent(CUSTOMER_A)
      );

      expect(result.current.intent).toEqual(draft);
    });

    it('never consumes another customer\'s intent and clears it on read', () => {
      sessionStorage.setItem(
        UTILITY_PENDING_INTENT_STORAGE_KEY,
        JSON.stringify(storedFor(CUSTOMER_A))
      );

      // Customer B is now the active customer in the same tab.
      const { result } = renderHook(() =>
        useUtilityPendingIntent(CUSTOMER_B)
      );

      // A's draft must never prefill B's money form...
      expect(result.current.intent).toBeNull();
      // ...and the foreign record is cleared rather than left armed.
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(readStored()).toBeNull();
    });

    it('does not destroy the record while the active customer is unresolved', () => {
      sessionStorage.setItem(
        UTILITY_PENDING_INTENT_STORAGE_KEY,
        JSON.stringify(storedFor(CUSTOMER_A))
      );

      const { result } = renderHook(() =>
        useUtilityPendingIntent(undefined)
      );

      // Auth still hydrating: fail-closed (no prefill) but keep the record so
      // the same customer can resume once their id resolves.
      expect(result.current.intent).toBeNull();
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(readStored()).toEqual(storedFor(CUSTOMER_A));
    });

    it('ignores a malformed stored intent and clears it', () => {
      sessionStorage.setItem(
        UTILITY_PENDING_INTENT_STORAGE_KEY,
        JSON.stringify({ amount: 500, tab: 'power' })
      );

      const { result } = renderHook(() =>
        useUtilityPendingIntent(CUSTOMER_A)
      );

      expect(result.current.intent).toBeNull();
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(readStored()).toBeNull();
    });

    it('ignores a legacy owner-less intent (no customer id) and clears it', () => {
      sessionStorage.setItem(
        UTILITY_PENDING_INTENT_STORAGE_KEY,
        JSON.stringify(draft)
      );

      const { result } = renderHook(() =>
        useUtilityPendingIntent(CUSTOMER_A)
      );

      expect(result.current.intent).toBeNull();
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(readStored()).toBeNull();
    });

    it('clears the intent once the purchase completes', () => {
      sessionStorage.setItem(
        UTILITY_PENDING_INTENT_STORAGE_KEY,
        JSON.stringify(storedFor(CUSTOMER_A))
      );
      const { result } = renderHook(() =>
        useUtilityPendingIntent(CUSTOMER_A)
      );

      act(() => {
        result.current.clearIntent();
        vi.advanceTimersByTime(1_000);
      });

      expect(result.current.intent).toBeNull();
    });
  });
});
