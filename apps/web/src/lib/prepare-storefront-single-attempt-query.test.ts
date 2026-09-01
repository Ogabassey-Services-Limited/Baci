import { describe, expect, it, vi } from 'vitest';
import { prepareStorefrontSingleAttemptQuery } from './prepare-storefront-single-attempt-query';

describe('prepareStorefrontSingleAttemptQuery', () => {
  it('composes the abort signal and disables SDK retries', async () => {
    const result = { data: [], error: null };
    const query = Object.assign(Promise.resolve(result), {
      abortSignal: vi.fn(),
      retry: vi.fn(),
    });
    query.abortSignal.mockReturnValue(query);
    query.retry.mockReturnValue(query);
    const signal = new AbortController().signal;

    await prepareStorefrontSingleAttemptQuery(query, signal);

    expect(query.abortSignal).toHaveBeenCalledWith(signal);
    expect(query.retry).toHaveBeenCalledWith(false);
  });
});
