import { describe, expect, it, vi } from 'vitest';
import { runBoundedAutocompleteRequest } from './storefront-search-autocomplete-request';

describe('runBoundedAutocompleteRequest', () => {
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
});
