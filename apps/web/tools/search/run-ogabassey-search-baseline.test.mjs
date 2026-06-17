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
});
