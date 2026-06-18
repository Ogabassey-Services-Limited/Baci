import { describe, expect, it, vi } from 'vitest';
import { createBaselineReport } from './run-ogabassey-search-baseline.mjs';

function response(body, init = {}) {
  return new Response(body, {
    status: init.status || 200,
    statusText: init.statusText || 'OK',
    headers: init.headers || {},
  });
}

describe('createBaselineReport', () => {
  it('probes public search surfaces for every fixture', async () => {
    const fetchMock = vi.fn(async () =>
      response(JSON.stringify({ products: [{ name: 'iPhone 16 Pro' }] }))
    );

    const report = await createBaselineReport({
      fetchImpl: fetchMock,
      merchantId: '123e4567-e89b-12d3-a456-426614174000',
      origin: 'https://ogabassey.test',
    });

    expect(report.origin).toBe('https://ogabassey.test');
    expect(report.results.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('/search?q=iphone', 'https://ogabassey.test'),
      expect.objectContaining({
        headers: { accept: 'text/html,application/json' },
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        '/api/search?q=iphone&merchant_id=123e4567-e89b-12d3-a456-426614174000&limit=20',
        'https://ogabassey.test'
      ),
      expect.objectContaining({
        headers: { accept: 'text/html,application/json' },
      })
    );
  });

  it('marks merchant-scoped API probes as skipped when merchant id is missing', async () => {
    const fetchMock = vi.fn(async () => response('<html>Search</html>'));

    const report = await createBaselineReport({
      fetchImpl: fetchMock,
      merchantId: '',
      origin: 'https://ogabassey.test',
    });

    expect(report.results[0].surfaces.searchPage).toMatchObject({
      ok: true,
      status: 200,
    });
    expect(report.results[0].surfaces.apiSearch).toMatchObject({
      ok: false,
      status: 0,
      sample: 'OGABASSEY_MERCHANT_ID not set',
    });
    expect(fetchMock).toHaveBeenCalledTimes(report.results.length);
  });

  it('marks only the failed surface as errored when fetch rejects', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue(response(JSON.stringify({ products: [] })));

    const report = await createBaselineReport({
      fetchImpl: fetchMock,
      merchantId: '123e4567-e89b-12d3-a456-426614174000',
      origin: 'https://ogabassey.test',
    });

    expect(report.results[0].surfaces.searchPage).toMatchObject({
      ok: false,
      sample: 'Fetch error: network down',
      status: 0,
    });
    expect(report.results[0].surfaces.apiSearch).toMatchObject({
      ok: true,
      status: 200,
    });
  });

  it.sequential('marks a slow surface as errored when the timeout signal aborts the request', async () => {
    const timeoutSpy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation((timeoutMs) => {
        expect(timeoutMs).toBe(30_000);
        const controller = new AbortController();
        queueMicrotask(() => {
          controller.abort(
            new DOMException('Request timed out', 'TimeoutError')
          );
        });
        return controller.signal;
      });
    const fetchMock = vi.fn((_url, init) => {
      if (fetchMock.mock.calls.length === 1) {
        return new Promise((_, reject) => {
          init.signal.addEventListener(
            'abort',
            () => reject(init.signal.reason),
            { once: true }
          );
        });
      }

      return Promise.resolve(response(JSON.stringify({ products: [] })));
    });

    try {
      const report = await createBaselineReport({
        fetchImpl: fetchMock,
        merchantId: '123e4567-e89b-12d3-a456-426614174000',
        origin: 'https://ogabassey.test',
      });

      expect(report.results[0].surfaces.searchPage).toMatchObject({
        ok: false,
        sample: 'Fetch error: Request timed out',
        status: 0,
      });
      expect(report.results[0].surfaces.apiSearch).toMatchObject({
        ok: true,
        status: 200,
      });
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it('limits sampled response bodies to 1000 characters', async () => {
    const longBody = 'x'.repeat(1200);
    const fetchMock = vi.fn(async () => response(longBody));

    const report = await createBaselineReport({
      fetchImpl: fetchMock,
      merchantId: '123e4567-e89b-12d3-a456-426614174000',
      origin: 'https://ogabassey.test',
    });

    expect(report.results[0].surfaces.searchPage).toMatchObject({
      ok: true,
      status: 200,
    });
    expect(report.results[0].surfaces.searchPage.sample).toHaveLength(1000);
    expect(report.results[0].surfaces.searchPage.sample).toBe(
      longBody.slice(0, 1000)
    );
  });
});
