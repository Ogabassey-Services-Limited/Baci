import { RetryExhaustedError } from './api-core';
import { withRetry, withSupabaseRetry } from './api-supabase-retry';

describe('api Supabase retry helpers', () => {
  it('retries thrown network-like errors before succeeding', async () => {
    const operation = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce('ok');
    const onRetry = jest.fn();

    await expect(
      withRetry(operation, {
        baseDelay: 0,
        checkNetwork: false,
        maxDelay: 0,
        onRetry,
      })
    ).resolves.toBe('ok');

    expect(operation).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ message: 'Network request failed' }),
      0
    );
  });

  it('throws RetryExhaustedError when thrown retryable errors are exhausted', async () => {
    const operation = jest
      .fn<Promise<string>, []>()
      .mockRejectedValue(new Error('Network request failed'));

    await expect(
      withRetry(operation, {
        baseDelay: 0,
        checkNetwork: false,
        maxDelay: 0,
        maxRetries: 1,
      })
    ).rejects.toBeInstanceOf(RetryExhaustedError);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('retries Supabase network result errors and returns the success result', async () => {
    type SupabaseResult = {
      data: { id: string } | null;
      error: { message: string } | null;
    };
    const operation = jest
      .fn<Promise<SupabaseResult>, []>()
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Network request failed' },
      })
      .mockResolvedValueOnce({
        data: { id: 'product-1' },
        error: null,
      });

    await expect(
      withSupabaseRetry(operation, {
        baseDelay: 0,
        checkNetwork: false,
        maxDelay: 0,
      })
    ).resolves.toEqual({
      data: { id: 'product-1' },
      error: null,
    });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry client validation errors from Supabase', async () => {
    const operation = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Invalid product id' },
    });

    await expect(
      withSupabaseRetry(operation, { checkNetwork: false })
    ).resolves.toEqual({
      data: null,
      error: { message: 'Invalid product id' },
    });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('propagates thrown Supabase operation errors when retries are exhausted', async () => {
    const operation = jest
      .fn()
      .mockRejectedValue(new Error('Unexpected parser failure'));

    await expect(
      withSupabaseRetry(operation, { checkNetwork: false, maxRetries: 0 })
    ).rejects.toThrow('Unexpected parser failure');
  });
});
