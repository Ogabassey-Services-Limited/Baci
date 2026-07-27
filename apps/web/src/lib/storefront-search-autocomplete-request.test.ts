import { afterEach, describe, expect, it, vi } from 'vitest';
import { runBoundedAutocompleteRequest } from './storefront-search-autocomplete-request';

describe('runBoundedAutocompleteRequest', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces a key and releases its slot after success', async () => {
    const inFlight = new Map<string, Promise<string>>();
    let resolveOperation: ((value: string) => void) | undefined;
    const operation = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveOperation = resolve;
        })
    );
    const options = {
      cacheKey: 'merchant:phone',
      createSaturationError: () => new Error('saturated'),
      inFlight,
      maxEntries: 1,
      onSuccess: vi.fn(),
      operation,
      timeoutMs: 5_000,
    };

    const first = runBoundedAutocompleteRequest(options);
    const coalesced = runBoundedAutocompleteRequest(options);
    resolveOperation?.('complete');

    await expect(Promise.all([first, coalesced])).resolves.toEqual([
      'complete',
      'complete',
    ]);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(inFlight.size).toBe(0);
  });

  it('rejects a new key while capacity is occupied', async () => {
    const inFlight = new Map([
      ['occupied', new Promise<string>(() => undefined)],
    ]);

    await expect(
      runBoundedAutocompleteRequest({
        cacheKey: 'overflow',
        createSaturationError: () => new Error('saturated'),
        inFlight,
        maxEntries: 1,
        onSuccess: vi.fn(),
        operation: vi.fn(() => Promise.resolve('unused')),
        timeoutMs: 5_000,
      })
    ).rejects.toThrow('saturated');
  });

  it('retains a timed-out slot until its non-cooperative operation settles', async () => {
    vi.useFakeTimers();
    const inFlight = new Map<string, Promise<string>>();
    let resolveOperation: ((value: string) => void) | undefined;
    const pending = runBoundedAutocompleteRequest({
      cacheKey: 'merchant:hanging-phone',
      createSaturationError: () => new Error('saturated'),
      inFlight,
      maxEntries: 1,
      onSuccess: vi.fn(),
      operation: () =>
        new Promise<string>((resolve) => {
          resolveOperation = resolve;
        }),
      timeoutMs: 5_000,
    });
    const result = pending.then(
      () => undefined,
      (error: unknown) => error
    );

    await vi.advanceTimersByTimeAsync(5_001);

    await expect(result).resolves.toMatchObject({ code: '57014' });
    expect(inFlight.has('merchant:hanging-phone')).toBe(true);

    resolveOperation?.('late completion');
    await vi.advanceTimersByTimeAsync(0);

    expect(inFlight.has('merchant:hanging-phone')).toBe(false);
  });

  it('releases a timed-out slot when its non-cooperative operation rejects late', async () => {
    vi.useFakeTimers();
    const inFlight = new Map<string, Promise<string>>();
    let rejectOperation: ((reason?: unknown) => void) | undefined;
    const pending = runBoundedAutocompleteRequest({
      cacheKey: 'merchant:failing-phone',
      createSaturationError: () => new Error('saturated'),
      inFlight,
      maxEntries: 1,
      onSuccess: vi.fn(),
      operation: () =>
        new Promise<string>((_resolve, reject) => {
          rejectOperation = reject;
        }),
      timeoutMs: 5_000,
    });
    const result = pending.then(
      () => undefined,
      (error: unknown) => error
    );

    await vi.advanceTimersByTimeAsync(5_001);

    await expect(result).resolves.toMatchObject({ code: '57014' });
    expect(inFlight.has('merchant:failing-phone')).toBe(true);

    rejectOperation?.(new Error('late failure'));
    await vi.advanceTimersByTimeAsync(0);

    expect(inFlight.has('merchant:failing-phone')).toBe(false);
  });
});
