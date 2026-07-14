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
import type { WalletTopUpCandidate } from './wallet-top-up-credit';

const RETURN_TO = '/utilities/airtime?repeatAmount=1000' as WalletReturnHref;

function topUp(
  id: string,
  amount: number,
  createdAt: string
): WalletTopUpCandidate {
  return {
    amount,
    created_at: createdAt,
    id,
    source_type: 'wallet_topup',
    type: 'credit',
  };
}

const OLD_TOP_UP = topUp('tx-old', 1000, '2026-07-01T09:00:00.000Z');
const NEW_TOP_UP = topUp('tx-new', 2500, '2026-07-13T09:00:00.000Z');
const LATER_TOP_UP = topUp('tx-later', 500, '2026-07-13T10:00:00.000Z');
const CASHBACK: WalletTopUpCandidate = {
  amount: 4000,
  created_at: '2026-07-13T08:30:00.000Z',
  id: 'tx-cashback',
  source_type: 'vtu_transaction',
  type: 'cashback',
};
const REVERSAL_CREDIT: WalletTopUpCandidate = {
  amount: 7000,
  created_at: '2026-07-13T08:45:00.000Z',
  id: 'tx-reversal',
  source_type: 'order_reversal',
  type: 'credit',
};

type Props = { transactions: readonly WalletTopUpCandidate[] | undefined };

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
      useWalletCreditWatch({ refetch: jest.fn(), transactions: [OLD_TOP_UP] })
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.creditedAmount).toBeNull();
    expect(result.current.returnCtaHref).toBeUndefined();
  });

  it('detects a top-up that landed BEFORE the customer tapped (pre-arm snapshot)', () => {
    const refetch = jest.fn();
    const { result, rerender } = renderHook(
      ({ transactions }: Props) =>
        useWalletCreditWatch({ refetch, returnTo: RETURN_TO, transactions }),
      { initialProps: { transactions: [OLD_TOP_UP] } as Props }
    );

    // The customer transfers from their bank app; realtime credits the wallet
    // while the app is backgrounded — BEFORE they tap "I've transferred".
    rerender({ transactions: [NEW_TOP_UP, OLD_TOP_UP] });

    act(() => {
      result.current.armCheck();
    });

    // The idle snapshot (tx-old) survives as the baseline, so the pre-tap
    // top-up reads as an immediate hit instead of timing out.
    expect(result.current.status).toBe('credited');
    expect(result.current.creditedAmount).toBe(2500);
    expect(result.current.returnCtaHref).toBe(RETURN_TO);
  });

  it('ignores cashback and reversal credits that land while idle', () => {
    const refetch = jest.fn();
    const { result, rerender } = renderHook(
      ({ transactions }: Props) =>
        useWalletCreditWatch({ refetch, transactions }),
      { initialProps: { transactions: [OLD_TOP_UP] } as Props }
    );

    // Unrelated balance-raising ledger rows arrive while the panel is idle:
    // VTU cashback and an order reversal both credit the spendable balance.
    rerender({ transactions: [REVERSAL_CREDIT, CASHBACK, OLD_TOP_UP] });

    act(() => {
      result.current.armCheck();
    });

    // Neither is a bank transfer, so the watch keeps waiting instead of sending
    // the customer back to a purchase they still cannot afford.
    expect(result.current.status).toBe('checking');
    expect(result.current.creditedAmount).toBeNull();
    expect(result.current.returnCtaHref).toBeUndefined();

    // The real transfer landing afterwards still credits, with the top-up's own
    // amount (2500) rather than a balance delta polluted by the cashback.
    rerender({
      transactions: [NEW_TOP_UP, REVERSAL_CREDIT, CASHBACK, OLD_TOP_UP],
    });
    expect(result.current.status).toBe('credited');
    expect(result.current.creditedAmount).toBe(2500);
  });

  it('resets to idle and can arm a fresh check for a second transfer', () => {
    const refetch = jest.fn();
    const { result, rerender } = renderHook(
      ({ transactions }: Props) =>
        useWalletCreditWatch({ refetch, transactions }),
      { initialProps: { transactions: [OLD_TOP_UP] } as Props }
    );

    act(() => {
      result.current.armCheck();
    });
    rerender({ transactions: [NEW_TOP_UP, OLD_TOP_UP] });
    expect(result.current.status).toBe('credited');
    expect(result.current.creditedAmount).toBe(2500);

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.creditedAmount).toBeNull();

    // The second cycle baselines on the acknowledged top-up (tx-new).
    act(() => {
      result.current.armCheck();
    });
    expect(result.current.status).toBe('checking');
    rerender({ transactions: [LATER_TOP_UP, NEW_TOP_UP, OLD_TOP_UP] });
    expect(result.current.status).toBe('credited');
    expect(result.current.creditedAmount).toBe(500);
  });

  it('refuses to arm while the wallet ledger is still loading', () => {
    const refetch = jest.fn();
    const { result, rerender } = renderHook(
      ({ transactions }: Props) =>
        useWalletCreditWatch({ refetch, transactions }),
      { initialProps: { transactions: undefined } as Props }
    );

    act(() => {
      result.current.armCheck();
    });

    // No baseline exists yet, so arming is a no-op...
    expect(result.current.status).toBe('idle');
    expect(refetch).not.toHaveBeenCalled();

    // ...and the customer's pre-existing top-up history loading in later must
    // NOT read as a fresh credit.
    rerender({ transactions: [OLD_TOP_UP] });
    expect(result.current.status).toBe('idle');
    expect(result.current.creditedAmount).toBeNull();
  });

  it('moves idle → checking on arm and credited when the top-up lands', () => {
    const refetch = jest.fn();
    const { result, rerender } = renderHook(
      ({ transactions }: Props) =>
        useWalletCreditWatch({ refetch, returnTo: RETURN_TO, transactions }),
      { initialProps: { transactions: [] } as Props }
    );

    act(() => {
      result.current.armCheck();
    });
    expect(result.current.status).toBe('checking');

    // Simulate the existing wallet channel invalidating → refetch → the new
    // ledger row arriving as a prop, WITHOUT advancing the fallback interval.
    rerender({ transactions: [NEW_TOP_UP] });

    expect(result.current.status).toBe('credited');
    expect(result.current.creditedAmount).toBe(2500);
    expect(result.current.returnCtaHref).toBe(RETURN_TO);
  });

  it('pokes refetch on the fallback interval while checking (realtime down)', () => {
    const refetch = jest.fn();
    const { result, rerender } = renderHook(
      ({ transactions }: Props) =>
        useWalletCreditWatch({ refetch, transactions }),
      { initialProps: { transactions: [OLD_TOP_UP] } as Props }
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
    rerender({ transactions: [NEW_TOP_UP, OLD_TOP_UP] });
    expect(result.current.status).toBe('credited');
    expect(result.current.creditedAmount).toBe(2500);
  });

  it('times out without claiming credited when no credit arrives', () => {
    const { result } = renderHook(() =>
      useWalletCreditWatch({ refetch: jest.fn(), transactions: [OLD_TOP_UP] })
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
      ({ transactions }: Props) =>
        useWalletCreditWatch({ refetch, transactions }),
      { initialProps: { transactions: [OLD_TOP_UP] } as Props }
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
    rerender({ transactions: [NEW_TOP_UP, OLD_TOP_UP] });
    act(() => {
      result.current.armCheck();
    });
    expect(result.current.status).toBe('credited');
    expect(result.current.creditedAmount).toBe(2500);

    // After acknowledging, the next cycle measures from the new ledger head.
    act(() => {
      result.current.reset();
    });
    act(() => {
      result.current.armCheck();
    });
    expect(result.current.status).toBe('checking');
    rerender({ transactions: [LATER_TOP_UP, NEW_TOP_UP, OLD_TOP_UP] });
    expect(result.current.status).toBe('credited');
    expect(result.current.creditedAmount).toBe(500);
  });

  it('stays idle when the dark-launch flag is off (armCheck is a no-op)', () => {
    mockFlagEnabled = false;
    const refetch = jest.fn();
    const { result, rerender } = renderHook(
      ({ transactions }: Props) =>
        useWalletCreditWatch({ refetch, transactions }),
      { initialProps: { transactions: [OLD_TOP_UP] } as Props }
    );

    act(() => {
      result.current.armCheck();
    });

    expect(result.current.status).toBe('idle');
    expect(refetch).not.toHaveBeenCalled();

    rerender({ transactions: [NEW_TOP_UP, OLD_TOP_UP] });
    expect(result.current.status).toBe('idle');
  });

  it('does not flip to credited when no new top-up row appears', () => {
    const { result, rerender } = renderHook(
      ({ transactions }: Props) =>
        useWalletCreditWatch({ refetch: jest.fn(), transactions }),
      { initialProps: { transactions: [OLD_TOP_UP] } as Props }
    );

    act(() => {
      result.current.armCheck();
    });

    // A concurrent debit only removes money — never treat that as a credit.
    rerender({
      transactions: [
        {
          amount: 40,
          created_at: '2026-07-13T09:15:00.000Z',
          id: 'tx-debit',
          source_type: 'vtu_wallet_payment',
          type: 'debit',
        },
        OLD_TOP_UP,
      ],
    });
    expect(result.current.status).toBe('checking');
  });
});
