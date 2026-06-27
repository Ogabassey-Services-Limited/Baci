import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CACHE_PROBE_ROUTES,
  getCacheProbeConfig,
  getCacheProbeRoutesFromEnv,
  probeCacheRoute,
  runCacheProbe,
} from './measure-ogabassey-cache-hit-rate.mjs';

function response(body, init = {}) {
  return new Response(body, {
    headers: init.headers || {},
    status: init.status || 200,
    statusText: init.statusText || 'OK',
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getCacheProbeRoutesFromEnv', () => {
  it('returns the default OgaBassey cache candidates when no override is set', () => {
    expect(getCacheProbeRoutesFromEnv({})).toEqual(DEFAULT_CACHE_PROBE_ROUTES);
  });

  it('parses comma-separated label=url route overrides', () => {
    expect(
      getCacheProbeRoutesFromEnv({
        OGABASSEY_CACHE_PROBE_URLS:
          'blog=https://ogabassey.com/blog,https://ogabassey.com/smartphones',
      })
    ).toEqual([
      {
        expectCloudflareCache: true,
        label: 'blog',
        url: 'https://ogabassey.com/blog',
      },
      {
        expectCloudflareCache: true,
        label: 'route-2',
        url: 'https://ogabassey.com/smartphones',
      },
    ]);
  });

  it('keeps unlabeled URLs with query strings intact', () => {
    expect(
      getCacheProbeRoutesFromEnv({
        OGABASSEY_CACHE_PROBE_URLS:
          'https://ogabassey.com/blog?utm_source=semrush',
      })
    ).toEqual([
      {
        expectCloudflareCache: true,
        label: 'route-1',
        url: 'https://ogabassey.com/blog?utm_source=semrush',
      },
    ]);
  });
});

describe('getCacheProbeConfig', () => {
  it('uses positive numeric environment overrides', () => {
    expect(
      getCacheProbeConfig({
        OGABASSEY_CACHE_PROBE_DELAY_MS: '50',
        OGABASSEY_CACHE_PROBE_OUTPUT_DIR: '/tmp/cache-probes',
        OGABASSEY_CACHE_PROBE_ROUNDS: '3',
        OGABASSEY_CACHE_PROBE_TIMEOUT_MS: '5000',
      })
    ).toMatchObject({
      delayMs: 50,
      outputDir: '/tmp/cache-probes',
      rounds: 3,
      timeoutMs: 5000,
    });
  });

  it('keeps fractional positive round overrides from disabling probes', () => {
    expect(
      getCacheProbeConfig({
        OGABASSEY_CACHE_PROBE_ROUNDS: '0.5',
      })
    ).toMatchObject({
      rounds: 1,
    });
  });
});

describe('probeCacheRoute', () => {
  it('captures Cloudflare cache headers, response timing, status, and body size', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response('cached html', {
        headers: {
          age: '8',
          'cf-cache-status': 'HIT',
          'content-type': 'text/html; charset=utf-8',
          'server-timing': 'cfCacheStatus;desc="HIT"',
          'x-vercel-cache': 'HIT',
        },
      })
    );
    const now = vi
      .fn()
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(250)
      .mockReturnValueOnce(310);

    await expect(
      probeCacheRoute(
        {
          expectCloudflareCache: true,
          label: 'blog',
          url: 'https://ogabassey.com/blog',
        },
        {
          fetchImpl: fetchMock,
          now,
          round: 2,
          timestamp: () => '2026-06-27T06:00:00.000Z',
        }
      )
    ).resolves.toEqual({
      age: '8',
      bytes: 11,
      cacheStatus: 'HIT',
      contentType: 'text/html; charset=utf-8',
      expectCloudflareCache: true,
      finalUrl: 'https://ogabassey.com/blog',
      label: 'blog',
      ok: true,
      round: 2,
      serverTiming: 'cfCacheStatus;desc="HIT"',
      status: 200,
      timestamp: '2026-06-27T06:00:00.000Z',
      totalMs: 210,
      ttfbMs: 150,
      url: 'https://ogabassey.com/blog',
      vercelCache: 'HIT',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ogabassey.com/blog',
      expect.objectContaining({
        headers: {
          Accept: 'text/html',
          'User-Agent': 'OgabasseyCacheProbe/1.0',
        },
        redirect: 'follow',
      })
    );
  });
});

describe('runCacheProbe', () => {
  it('writes JSONL rows that can be compared over time', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'ogabassey-cache-probe-'));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response('miss', { headers: { 'cf-cache-status': 'EXPIRED' } })
      )
      .mockResolvedValueOnce(
        response('hit', { headers: { age: '2', 'cf-cache-status': 'HIT' } })
      );
    const now = vi
      .fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(120)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(250)
      .mockReturnValueOnce(260);

    try {
      const result = await runCacheProbe({
        delayMs: 0,
        fetchImpl: fetchMock,
        now,
        outputDir,
        rounds: 2,
        routes: [
          {
            expectCloudflareCache: true,
            label: 'blog',
            url: 'https://ogabassey.com/blog',
          },
        ],
        timestamp: () => '2026-06-27T06:00:00.000Z',
      });

      const rows = (await readFile(result.outputPath, 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));

      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.cacheStatus)).toEqual(['EXPIRED', 'HIT']);
      expect(result.summary).toEqual([
        {
          age: '-',
          cache: 'EXPIRED',
          label: 'blog',
          round: 1,
          status: 200,
          totalMs: 120,
          ttfbMs: 100,
        },
        {
          age: '2',
          cache: 'HIT',
          label: 'blog',
          round: 2,
          status: 200,
          totalMs: 60,
          ttfbMs: 50,
        },
      ]);
    } finally {
      await rm(outputDir, { force: true, recursive: true });
    }
  });

  it('records route probe failures and still writes collected JSONL rows', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'ogabassey-cache-probe-'));
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce(
        response('hit', { headers: { age: '2', 'cf-cache-status': 'HIT' } })
      );
    const now = vi
      .fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(120)
      .mockReturnValueOnce(220);

    try {
      const result = await runCacheProbe({
        delayMs: 0,
        fetchImpl: fetchMock,
        now,
        outputDir,
        rounds: 1,
        routes: [
          {
            expectCloudflareCache: true,
            label: 'blog',
            url: 'https://ogabassey.com/blog',
          },
          {
            expectCloudflareCache: true,
            label: 'smartphones',
            url: 'https://ogabassey.com/smartphones',
          },
        ],
        timestamp: () => '2026-06-27T06:00:00.000Z',
      });

      const rows = (await readFile(result.outputPath, 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));

      expect(rows).toEqual([
        expect.objectContaining({
          error: 'network timeout',
          label: 'blog',
          ok: false,
          round: 1,
          status: 0,
          url: 'https://ogabassey.com/blog',
        }),
        expect.objectContaining({
          cacheStatus: 'HIT',
          label: 'smartphones',
          ok: true,
          round: 1,
          status: 200,
          url: 'https://ogabassey.com/smartphones',
        }),
      ]);
      expect(result.summary).toEqual([
        {
          age: '-',
          cache: '-',
          label: 'blog',
          round: 1,
          status: 0,
          totalMs: null,
          ttfbMs: null,
        },
        {
          age: '2',
          cache: 'HIT',
          label: 'smartphones',
          round: 1,
          status: 200,
          totalMs: 120,
          ttfbMs: 20,
        },
      ]);
    } finally {
      await rm(outputDir, { force: true, recursive: true });
    }
  });
});
