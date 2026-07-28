import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStorefrontPublicReadFetch } from './storefront-public-read-fetch';

describe('createStorefrontPublicReadFetch', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('starts each queued build request with a full 30-second transport budget', async () => {
    vi.stubEnv('BACI_STOREFRONT_BUILD_READS', 'bounded');
    const releases: Array<() => void> = [];
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => new AbortController().signal);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Promise<Response>((resolve) => {
          releases.push(() => resolve(new Response('ok')));
        })
    );
    const publicFetch = createStorefrontPublicReadFetch();
    const reads = Array.from({ length: 4 }, (_, index) =>
      publicFetch(`https://example.com/${index}`)
    );

    try {
      await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3));
      expect(timeout).toHaveBeenCalledTimes(3);
      expect(timeout).toHaveBeenLastCalledWith(30_000);

      releases.shift()?.();
      await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(4));
      expect(timeout).toHaveBeenCalledTimes(4);
      expect(timeout).toHaveBeenLastCalledWith(30_000);
    } finally {
      for (const release of releases) release();
    }

    await expect(Promise.all(reads)).resolves.toHaveLength(4);
  });

  it('keeps the 10-second runtime transport deadline', async () => {
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => new AbortController().signal);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok'));

    await createStorefrontPublicReadFetch()('https://example.com/runtime');

    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
