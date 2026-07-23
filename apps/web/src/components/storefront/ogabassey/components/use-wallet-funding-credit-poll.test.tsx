import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WALLET_FUNDING_POLL } from '@/config/wallet-funding-poll';
import { useWalletFundingCreditPoll } from './use-wallet-funding-credit-poll';

const mockPoll = vi.hoisted(() => vi.fn());
const mockCaptureClientEvent = vi.hoisted(() => vi.fn());

vi.mock('./wallet-funding-credit-api', () => ({
  walletFundingCreditApi: { poll: mockPoll },
}));

vi.mock('@/lib/posthog/capture-client-event', () => ({
  captureClientEvent: mockCaptureClientEvent,
}));

const topUpCredit = {
  amount: 5000,
  id: 'txn-topup',
  source_type: 'wallet_topup',
  type: 'credit',
};

function ready(transactions: unknown[]) {
  return { balance: 5000, kind: 'ready', transactions };
}

function renderPoll(overrides: Record<string, unknown> = {}) {
  const onCredited = vi.fn();
  const view = renderHook(() =>
    useWalletFundingCreditPoll({
      customerId: 'customer-1',
      enabled: true,
      knownTransactionIds: ['txn-old'],
      merchantSlug: 'ogabassey',
      onCredited,
      surface: 'wallet_page',
      ...overrides,
    })
  );
  return { onCredited, ...view };
}

function eventNames(): string[] {
  return mockCaptureClientEvent.mock.calls.map(([name]) => String(name));
}

describe('useWalletFundingCreditPoll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockPoll.mockResolvedValue(ready([]));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays idle and never polls until the customer arms it', () => {
    const { result } = renderPoll();

    expect(result.current.status).toBe('idle');
    expect(mockPoll).not.toHaveBeenCalled();
  });

  it('arms, checks, and settles as credited on a NEW wallet_topup credit', async () => {
    mockPoll.mockResolvedValue(ready([topUpCredit]));
    const { onCredited, result } = renderPoll();

    await act(async () => {
      result.current.start();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe('credited');
    expect(result.current.creditedAmount).toBe(5000);
    expect(onCredited).toHaveBeenCalledWith({ amount: 5000, id: 'txn-topup' });
    expect(eventNames()).toEqual([
      'wallet_funding_transfer_check_started',
      'wallet_funding_transfer_check_settled',
    ]);
    expect(mockCaptureClientEvent).toHaveBeenLastCalledWith(
      'wallet_funding_transfer_check_settled',
      expect.objectContaining({ outcome: 'credited', surface: 'wallet_page' })
    );
    // The server owns `wallet_funding_transfer_credited` (deterministic dedupe
    // uuid); the client must never re-fire it.
    expect(eventNames()).not.toContain('wallet_funding_transfer_credited');
  });

  it('does NOT credit on cashback or a refund — it keeps checking', async () => {
    mockPoll.mockResolvedValue(
      ready([
        { amount: 500, id: 'txn-cashback', source_type: 'cashback', type: 'credit' },
        { amount: 2000, id: 'txn-refund', source_type: 'order_refund', type: 'credit' },
      ])
    );
    const { onCredited, result } = renderPoll();

    await act(async () => {
      result.current.start();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_FUNDING_POLL.intervalMs * 3);
    });

    expect(result.current.status).toBe('checking');
    expect(result.current.creditedAmount).toBeNull();
    expect(onCredited).not.toHaveBeenCalled();
  });

  it('does NOT credit on a top-up that already existed before arming', async () => {
    mockPoll.mockResolvedValue(
      ready([{ ...topUpCredit, id: 'txn-old' }])
    );
    const { onCredited, result } = renderPoll();

    await act(async () => {
      result.current.start();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_FUNDING_POLL.intervalMs * 2);
    });

    expect(result.current.status).toBe('checking');
    expect(onCredited).not.toHaveBeenCalled();
  });

  it('times out without ever claiming credited, and can be re-armed', async () => {
    const { onCredited, result } = renderPoll();

    await act(async () => {
      result.current.start();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        WALLET_FUNDING_POLL.intervalMs * WALLET_FUNDING_POLL.maxAttempts
      );
    });

    expect(result.current.status).toBe('timed_out');
    expect(result.current.creditedAmount).toBeNull();
    expect(onCredited).not.toHaveBeenCalled();
    expect(mockCaptureClientEvent).toHaveBeenLastCalledWith(
      'wallet_funding_transfer_check_settled',
      expect.objectContaining({ outcome: 'timed_out' })
    );
    expect(mockPoll).toHaveBeenCalledTimes(WALLET_FUNDING_POLL.maxAttempts);

    // "Check again" re-arms the same loop.
    mockPoll.mockResolvedValue(ready([topUpCredit]));
    await act(async () => {
      result.current.start();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe('credited');
  });

  it('keeps polling (never credits) when the API keeps erroring', async () => {
    mockPoll.mockResolvedValue({ kind: 'error' });
    const { onCredited, result } = renderPoll();

    await act(async () => {
      result.current.start();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_FUNDING_POLL.intervalMs * 4);
    });

    expect(result.current.status).toBe('checking');
    expect(onCredited).not.toHaveBeenCalled();
  });

  it('does not burn the attempt budget while the tab is hidden', async () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden');
    const { result } = renderPoll();

    await act(async () => {
      result.current.start();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_FUNDING_POLL.intervalMs * 5);
    });

    expect(mockPoll).not.toHaveBeenCalled();

    // Returning from the bank app checks immediately.
    visibility.mockReturnValue('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(mockPoll).toHaveBeenCalledTimes(1);
    visibility.mockRestore();
  });

  it('is a no-op when the dark-launch flag is off', async () => {
    const { result } = renderPoll({ enabled: false });

    await act(async () => {
      result.current.start();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_FUNDING_POLL.intervalMs * 3);
    });

    expect(result.current.status).toBe('idle');
    expect(mockPoll).not.toHaveBeenCalled();
    expect(mockCaptureClientEvent).not.toHaveBeenCalled();
  });

  it('stops polling on unmount', async () => {
    const { result, unmount } = renderPoll();

    await act(async () => {
      result.current.start();
    });
    expect(mockPoll).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_FUNDING_POLL.intervalMs * 3);
    });

    expect(mockPoll).toHaveBeenCalledTimes(1);
  });
});
