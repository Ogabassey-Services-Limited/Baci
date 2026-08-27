import { describe, expect, it, vi } from 'vitest';
import { fetchBaseAnalytics } from './fetch-base-analytics';

describe('fetchBaseAnalytics', () => {
  it('scopes the request to the selected merchant and clears loading', async () => {
    const setBaseAnalytics = vi.fn();
    const setLoadingAnalytics = vi.fn();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ summary: {} })));

    await fetchBaseAnalytics({
      from: new Date('2026-08-01T00:00:00.000Z'),
      merchantId: 'merchant-2',
      setBaseAnalytics,
      setLoadingAnalytics,
      signal: new AbortController().signal,
      to: new Date('2026-08-02T00:00:00.000Z'),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/analytics?'),
      expect.objectContaining({
        headers: { 'x-baci-merchant-id': 'merchant-2' },
      })
    );
    expect(setBaseAnalytics).toHaveBeenCalledWith({ summary: {} });
    expect(setLoadingAnalytics).toHaveBeenLastCalledWith(false);
  });

  it('does not update analytics when cancellation occurs during response parsing', async () => {
    const setBaseAnalytics = vi.fn();
    const setLoadingAnalytics = vi.fn();
    const controller = new AbortController();
    let resolveJson: (value: { summary: Record<string, never> }) => void =
      () => {};
    const jsonPromise = new Promise<{ summary: Record<string, never> }>(
      (resolve) => {
        resolveJson = resolve;
      }
    );
    const response = new Response();
    vi.spyOn(response, 'json').mockReturnValue(jsonPromise);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    const request = fetchBaseAnalytics({
      from: new Date('2026-08-01T00:00:00.000Z'),
      merchantId: 'merchant-2',
      setBaseAnalytics,
      setLoadingAnalytics,
      signal: controller.signal,
      to: new Date('2026-08-02T00:00:00.000Z'),
    });

    await Promise.resolve();
    controller.abort();
    resolveJson({ summary: {} });
    await request;

    expect(setBaseAnalytics).not.toHaveBeenCalled();
    expect(setLoadingAnalytics).not.toHaveBeenLastCalledWith(false);
  });
});
