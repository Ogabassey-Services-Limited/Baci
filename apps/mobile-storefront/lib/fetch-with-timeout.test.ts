import { describe, expect, it, jest } from '@jest/globals';
import { fetchWithTimeout } from './fetch-with-timeout';

describe('fetchWithTimeout cancellation', () => {
  it('preserves caller aborts instead of reporting a request timeout', async () => {
    const controller = new AbortController();
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockImplementation((_input, init) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              const error = new Error('Cancelled by caller');
              error.name = 'AbortError';
              reject(error);
            },
            { once: true }
          );
        });
      });

    try {
      const request = fetchWithTimeout('https://usebaci.com/api/test', {
        signal: controller.signal,
      });
      controller.abort();

      await expect(request).rejects.toMatchObject({
        message: 'Cancelled by caller',
        name: 'AbortError',
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
