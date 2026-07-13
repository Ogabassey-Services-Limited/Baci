import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

let mockFlagEnabled = true;

jest.mock('@/constants/wallet-funding', () => ({
  get WALLET_FUNDING_CHECKING_STATE_ENABLED() {
    return mockFlagEnabled;
  },
  WALLET_FUNDING_POLLING: { INTERVAL_MS: 5000, TIMEOUT_MS: 120000 },
}));

import { WALLET_FUNDING_POLLING } from '@/constants/wallet-funding';
import type { WalletReturnHref } from '@/lib/sanitize-wallet-return-to';
import { useWalletCreditWatch } from './use-wallet-credit-watch';

const RETURN_TO = '/utilities/airtime?repeatAmount=1000' as WalletReturnHref;

describe('useWalletCreditWatch', () => {
  beforeEach(() => {
    mockFlagEnabled = true;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('starts idle and exposes no CTA before arming', () => {
    const { result } = renderHook(() =>
      useWalletCreditWatch({ balance: 100, refetch: jest.fn() })
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.creditedAmount).toBeNull();
    expect(result.current.returnCtaHref).toBeUndefined();
  });

  it('detects a credit that landed BEFORE the customer tapped (pre-arm snapshot)', () => {
    const refetch = jest.fn();
    const { result, rerender } = renderHook(
      ({ balance }: { balance: number }) =>
        useWalletCreditWatch({ balance, refetch, returnTo: RETURN_TO }),
      { initialProps: { balance: 100 } }
    );

    // The customer transfers from their bank app; realtime credits the wallet
    // while the app is backgrounded — BEFORE they tap "I've transferred".
    rerender({ balance: 2600 });

    act(() => {
      result.current.armCheck();
    });

    // The idle snapshot (100) survives as the baseline, so the pre-tap credit
    // reads as an immediate delta instead of timing out.
    expect(result.current.status).toBe('credited');
    expect(result.current.creditedAmount).toBe(2500);
    expect(result.current.returnCtaHref).toBe(RETURN_TO);
  });

  it('resets to idle and can arm a fresh check for a second transfer', () => {
    const refetch = jest.fn();
    const { result, rerender } = renderHook(
      ({ balance }: { balance: number }) =>
        useWalletCreditWatch({ balance, refetch }),
      { initialProps: { balance: 100 } }
    );

    act(() => {
      result.current.armCheck();
    });
    rerender({ balance: 2600 });
    expect(result.current.status).toBe('credited');

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.creditedAmount).toBeNull();

    // Second cycle measures only from the post-reset balance (2600).
    act(() => {
      result.current.armCheck();
    });
    expect(result.current.status).toBe('checking');
    rerender({ balance: 3100 });
    expect(result.current.status).toBe('credited');
    expect(result.current.creditedAmount).toBe(500);
  });

  it('refuses to arm while the balance is still loading (no zero baseline)', () => {
    const refetch = jest.fn();
    const { result, rerender } = renderHook(
      ({ balance }: { balance: number | undefined }) =>
        useWalletCreditWatch({ balance, refetch }),
      { initialProps: { balance: undefined as number | undefined } }
    );

    act(() => {
      result.current.armCheck();
    });

    // No baseline exists yet, so arming is a no-op...
    expect(result.current.status).toBe('idle');
    expect(refetch).not.toHaveBeenCalled();

    // ...and the initial balance loading later must NOT read as a credit.
    rerender({ balance: 5000 });
    expect(result.current.status).toBe('idle');
    expect(result.current.creditedAmount).toBeNull();
  });

  it('moves idle → checking on arm and credited when the balance grows (realtime)', () => {
    const refetch = jest.fn();
    const { result, rerender } = renderHook(
      ({ balance }: { balance: number }) =>
        useWalletCreditWatch({ balance, refetch, returnTo: RETURN_TO }),
      { initialProps: { balance: 100 } }
    );

    act(() => {
      result.current.armCheck();
    });
    expect(result.current.status).toBe('checking');

    // Simulate the existing wallet channel invalidating → refetch → new balance
    // arriving as a prop, WITHOUT advancing the fallback interval.
    rerender({ balance: 2600 });

    expect(result.current.status).toBe('credited');
    expect(result.current.creditedAmount).toBe(2500);
    expect(result.current.returnCtaHref).toBe(RETURN_TO);
  });

  it('pokes refetch on the fallback interval while checking (realtime down)', () => {
    const refetch = jest.fn();
    const { result, rerender } = renderHook(
      ({ balance }: { balance: number }) =>
        useWalletCreditWatch({ balance, refetch }),
      { initialProps: { balance: 100 } }
    );

    act(() => {
      result.current.armCheck();
    });
    refetch.mockClear();

    act(() => {
      jest.advanceTimersByTime(WALLET_FUNDING_POLLING.INTERVAL_MS);
    });
    expect(refetch).toHaveBeenCalledTimes(1);

    // The poll's refetch resolves with a credit that lands as a prop update.
    rerender({ balance: 900 });
    expect(result.current.status).toBe('credited');
    expect(result.current.creditedAmount).toBe(800);
  });

  it('times out without claiming credited when no credit arrives', () => {
    const { result } = renderHook(() =>
      useWalletCreditWatch({ balance: 100, refetch: jest.fn() })
    );

    act(() => {
      result.current.armCheck();
    });

    act(() => {
      jest.advanceTimersByTime(WALLET_FUNDING_POLLING.TIMEOUT_MS);
    });

    expect(result.current.status).toBe('timedOut');
    expect(result.current.creditedAmount).toBeNull();
    expect(result.current.returnCtaHref).toBeUndefined();
  });

  it('surfaces a credit that landed during the timeout window on re-arm', () => {
    const refetch = jest.fn();
    const { result, rerender } = renderHook(
      ({ balance }: { balance: number }) =>
        useWalletCreditWatch({ balance, refetch }),
      { initialProps: { balance: 100 } }
    );

    act(() => {
      result.current.armCheck();
    });
    act(() => {
      jest.advanceTimersByTime(WALLET_FUNDING_POLLING.TIMEOUT_MS);
    });
    expect(result.current.status).toBe('timedOut');

    // The transfer settled late — after the watch already timed out. Tapping
    // "Check again" must credit immediately against the pre-transfer snapshot
    // instead of silently absorbing the late credit into a fresh baseline.
    rerender({ balance: 500 });
    act(() => {
      result.current.armCheck();
    });
    expect(result.current.status).toBe('credited');
    expect(result.current.creditedAmount).toBe(400);

    // After acknowledging, the next cycle measures from the new balance.
    act(() => {
      result.current.reset();
    });
    act(() => {
      result.current.armCheck();
    });
    expect(result.current.status).toBe('checking');
    rerender({ balance: 1500 });
    expect(result.current.status).toBe('credited');
    expect(result.current.creditedAmount).toBe(1000);
  });

  it('stays idle when the dark-launch flag is off (armCheck is a no-op)', () => {
    mockFlagEnabled = false;
    const refetch = jest.fn();
    const { result, rerender } = renderHook(
      ({ balance }: { balance: number }) =>
        useWalletCreditWatch({ balance, refetch }),
      { initialProps: { balance: 100 } }
    );

    act(() => {
      result.current.armCheck();
    });

    expect(result.current.status).toBe('idle');
    expect(refetch).not.toHaveBeenCalled();

    rerender({ balance: 5000 });
    expect(result.current.status).toBe('idle');
  });

  it('does not flip to credited when the balance never exceeds the baseline', () => {
    const { result, rerender } = renderHook(
      ({ balance }: { balance: number }) =>
        useWalletCreditWatch({ balance, refetch: jest.fn() }),
      { initialProps: { balance: 100 } }
    );

    act(() => {
      result.current.armCheck();
    });

    // A concurrent debit dropped the balance — never treat that as a credit.
    rerender({ balance: 40 });
    expect(result.current.status).toBe('checking');
  });
});
