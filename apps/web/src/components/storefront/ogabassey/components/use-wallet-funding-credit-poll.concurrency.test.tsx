import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WALLET_FUNDING_POLL } from '@/config/wallet-funding-poll';
import { ready, renderPoll } from './use-wallet-funding-credit-poll.support';

// Request-concurrency / lifecycle half of the poll suite. Split from
// `use-wallet-funding-credit-poll.test.tsx` (fail-closed settlement lives there)
// so each file stays under the 300-line limit. `vi.mock`/`vi.hoisted` hoist
// per file, so the mock header is duplicated deliberately.
const mockPoll = vi.hoisted(() => vi.fn());
const mockCaptureClientEvent = vi.hoisted(() => vi.fn());

vi.mock('./wallet-funding-credit-api', () => ({
  walletFundingCreditApi: { poll: mockPoll },
}));

vi.mock('@/lib/posthog/capture-client-event', () => ({
  captureClientEvent: mockCaptureClientEvent,
}));

describe('useWalletFundingCreditPoll request concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockPoll.mockResolvedValue(ready([]));
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('times out at the absolute deadline even while requests keep succeeding slowly', async () => {
    // Every GET SUCCEEDS (a miss, no credit) but only after a long delay, so
    // the attempt count climbs at ~one request per 10s instead of the assumed
    // 5s. Far fewer than `maxAttempts` requests land inside the five-minute
    // window, yet the loop must still time out on the wall-clock deadline
    // instead of hanging in "checking" for ~ten minutes.
    mockPoll.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve(ready([])),
            WALLET_FUNDING_POLL.requestTimeoutMs - 1_000
          );
        })
    );
    const { onCredited, result } = renderPoll();

    await act(async () => {
      result.current.start();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        WALLET_FUNDING_POLL.deadlineMs + WALLET_FUNDING_POLL.requestTimeoutMs
      );
    });

    expect(result.current.status).toBe('timed_out');
    expect(result.current.creditedAmount).toBeNull();
    expect(onCredited).not.toHaveBeenCalled();
    // Proves the DEADLINE settled the loop, not the attempt cap: the slow
    // cadence means well under `maxAttempts` requests occurred by five minutes.
    expect(mockPoll.mock.calls.length).toBeLessThan(
      WALLET_FUNDING_POLL.maxAttempts
    );
  });

  it('aborts a request that stalls across the deadline and times out at ~the deadline', async () => {
    // Regression: a request launches just before the foreground deadline and then
    // STALLS (never resolves, ignoring its own abort). Every interval tick after
    // that returns through the `inFlight` guard, so before the deadline timer the
    // loop would hang in "checking" indefinitely. The deadline timer must abort
    // the in-flight request and settle timed_out AT the deadline.
    let sawAbort = false;
    mockPoll.mockImplementation(
      (_slug: string, signal?: AbortSignal) =>
        new Promise(() => {
          signal?.addEventListener('abort', () => {
            sawAbort = true;
          });
        })
    );
    const { onCredited, result } = renderPoll();

    await act(async () => {
      result.current.start();
    });
    // Just before the deadline the loop is still checking, waiting on the stall.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_FUNDING_POLL.deadlineMs - 1_000);
    });
    expect(result.current.status).toBe('checking');

    // Crossing the deadline aborts the stalled request and settles the loop —
    // without waiting on that request's own (never-firing) resolution.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(sawAbort).toBe(true);
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
