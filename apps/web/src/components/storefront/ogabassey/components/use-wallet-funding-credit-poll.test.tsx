import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WALLET_FUNDING_POLL } from '@/config/wallet-funding-poll';
import {
  ready,
  renderPoll,
  topUpCredit,
} from './use-wallet-funding-credit-poll.support';

const mockPoll = vi.hoisted(() => vi.fn());
const mockCaptureClientEvent = vi.hoisted(() => vi.fn());

vi.mock('./wallet-funding-credit-api', () => ({
  walletFundingCreditApi: { poll: mockPoll },
}));

vi.mock('@/lib/posthog/capture-client-event', () => ({
  captureClientEvent: mockCaptureClientEvent,
}));

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

  it('aborts a stalled request and still times out (never a false credit)', async () => {
    // A degraded connection: each GET hangs until its per-request timeout
    // aborts it, at which point the real api resolves `{ kind: 'error' }`.
    // Without bounding, the interval would pile up unresolved requests and the
    // loop would never settle.
    let launched = 0;
    let aborted = 0;
    mockPoll.mockImplementation(
      (_slug: string, signal?: AbortSignal) =>
        new Promise((resolve) => {
          launched += 1;
          signal?.addEventListener('abort', () => {
            aborted += 1;
            resolve({ kind: 'error' });
          });
        })
    );
    const { onCredited, result } = renderPoll();

    await act(async () => {
      result.current.start();
    });
    // Drive well past the full attempt budget. Each stalled request only
    // settles once its per-request timeout aborts it, so the worst-case cadence
    // is one attempt per (requestTimeout + interval); budget generously.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        (WALLET_FUNDING_POLL.requestTimeoutMs +
          WALLET_FUNDING_POLL.intervalMs) *
          (WALLET_FUNDING_POLL.maxAttempts + 5)
      );
    });

    expect(aborted).toBeGreaterThan(0);
    // Never overlapping: a request is only launched once the prior one settled.
    expect(launched).toBeLessThanOrEqual(WALLET_FUNDING_POLL.maxAttempts);
    expect(result.current.status).toBe('timed_out');
    expect(result.current.creditedAmount).toBeNull();
    expect(onCredited).not.toHaveBeenCalled();
  });

  it('does not launch a new poll while one is still in flight', async () => {
    let resolvePoll: ((value: unknown) => void) | undefined;
    mockPoll.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePoll = resolve;
        })
    );
    const { result } = renderPoll();

    await act(async () => {
      result.current.start();
    });
    // First poll launched and still pending.
    expect(mockPoll).toHaveBeenCalledTimes(1);

    // Several interval ticks fire while the first request is unresolved.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_FUNDING_POLL.intervalMs * 3);
    });
    expect(mockPoll).toHaveBeenCalledTimes(1);

    // Once it settles, the loop is free to poll again.
    await act(async () => {
      resolvePoll?.({ balance: 0, kind: 'ready', transactions: [] });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_FUNDING_POLL.intervalMs);
    });
    expect(mockPoll.mock.calls.length).toBeGreaterThan(1);
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
