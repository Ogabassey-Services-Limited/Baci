import { describe, expect, it } from 'vitest';
import { WALLET_FUNDING_POLL } from './wallet-funding-poll';

describe('WALLET_FUNDING_POLL', () => {
  it('bounds the foreground checking loop at ~5 minutes with a 5s interval', () => {
    // Load-bearing timing for the funding-check loop: the interval matches the
    // proven USDT poll, and the deadline is the absolute ~5-minute foreground
    // wall-clock cap.
    expect(WALLET_FUNDING_POLL.intervalMs).toBe(5_000);
    expect(WALLET_FUNDING_POLL.deadlineMs).toBe(300_000);
    expect(WALLET_FUNDING_POLL.maxAttempts).toBe(60);
    expect(WALLET_FUNDING_POLL.requestTimeoutMs).toBe(10_000);
  });

  it('keeps a single request timeout well under the foreground deadline', () => {
    // One stalled request must never be able to hold the loop past its
    // wall-clock bound, so it has to abort long before the deadline.
    expect(WALLET_FUNDING_POLL.requestTimeoutMs).toBeLessThan(
      WALLET_FUNDING_POLL.deadlineMs
    );
  });
});
