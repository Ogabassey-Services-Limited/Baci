import { describe, expect, it, vi } from 'vitest';
import { createStorefrontBuildReadFetch } from './storefront-build-read-fetch';

describe('createStorefrontBuildReadFetch', () => {
  it('serializes reads created by separate public clients', async () => {
    let releaseFirst: (() => void) | undefined;
    const firstPending = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const upstream = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => {
        await firstPending;
        return new Response('first');
      })
      .mockResolvedValueOnce(new Response('second'));
    const firstClientFetch = createStorefrontBuildReadFetch(upstream);
    const secondClientFetch = createStorefrontBuildReadFetch(upstream);

    const first = firstClientFetch('https://example.com/first');
    await vi.waitFor(() => expect(upstream).toHaveBeenCalledTimes(1));
    const second = secondClientFetch('https://example.com/second');
    await Promise.resolve();

    expect(upstream).toHaveBeenCalledTimes(1);
    releaseFirst?.();
    await expect(first).resolves.toBeInstanceOf(Response);
    await expect(second).resolves.toBeInstanceOf(Response);
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it('releases the next read when the active read rejects', async () => {
    const upstream = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(new Response('recovered'));
    const limitedFetch = createStorefrontBuildReadFetch(upstream);

    await expect(limitedFetch('https://example.com/first')).rejects.toThrow(
      'timeout'
    );
    await expect(
      limitedFetch('https://example.com/second')
    ).resolves.toBeInstanceOf(Response);
  });
});
