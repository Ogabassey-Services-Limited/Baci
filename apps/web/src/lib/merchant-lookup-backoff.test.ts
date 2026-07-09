import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitForMerchantLookupRetryBackoff } from '@/lib/merchant-lookup-backoff';

describe('waitForMerchantLookupRetryBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('waits the minimum 200ms when jitter rolls zero', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    let resolved = false;

    const pending = waitForMerchantLookupRetryBackoff().then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(199);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(resolved).toBe(true);
  });

  it('caps the wait at 300ms when jitter rolls maximum', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    let resolved = false;

    const pending = waitForMerchantLookupRetryBackoff().then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(300);
    await pending;
    expect(resolved).toBe(true);
  });
});
