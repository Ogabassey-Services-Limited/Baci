import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetCloudflarePurgeCredentials = vi.fn();

vi.mock('@/lib/cloudflare-purge-credentials', () => ({
  getCloudflarePurgeCredentials: () => mockGetCloudflarePurgeCredentials(),
}));

// Re-import per test so the module-level "warned once" flag resets between
// cases that exercise the missing-config path.
async function loadPurge() {
  vi.resetModules();
  const module = await import('./cloudflare-purge');
  return module.purgeCloudflareUrls;
}

async function loadConfirmedPurge() {
  vi.resetModules();
  const module = await import('./cloudflare-purge');
  return module.purgeCloudflareUrlsConfirmed;
}

async function loadConfirmedHostnamePurge() {
  vi.resetModules();
  const module = await import('./cloudflare-purge');
  return module.purgeCloudflareHostnamesConfirmed;
}

function okResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ success: true, result: { id: 'zone' } }),
  } as unknown as Response;
}

describe('purgeCloudflareUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCloudflarePurgeCredentials.mockReturnValue({
      token: 'cf-token',
      zoneId: 'cf-zone',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs a batch of files to the zone purge endpoint with a bearer token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const purgeCloudflareUrls = await loadPurge();

    await purgeCloudflareUrls(
      ['https://ogabassey.com/blog', 'https://ogabassey.com/blog/post-a'],
      { fetchImpl: fetchImpl as unknown as typeof fetch }
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchImpl.mock.calls[0];
    expect(endpoint).toBe(
      'https://api.cloudflare.com/client/v4/zones/cf-zone/purge_cache'
    );
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer cf-token',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      files: [
        'https://ogabassey.com/blog',
        'https://ogabassey.com/blog/post-a',
      ],
    });
  });

  it('splits more than 30 URLs into sequential batches of at most 30', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const purgeCloudflareUrls = await loadPurge();
    const urls = Array.from(
      { length: 65 },
      (_, index) => `https://ogabassey.com/p/${index}`
    );

    await purgeCloudflareUrls(urls, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const batchSizes = fetchImpl.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit).body)).files.length
    );
    expect(batchSizes).toEqual([30, 30, 5]);
  });

  it('sends exactly 30 URLs as a single batch (batch boundary)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const purgeCloudflareUrls = await loadPurge();
    const urls = Array.from(
      { length: 30 },
      (_, index) => `https://ogabassey.com/p/${index}`
    );

    await purgeCloudflareUrls(urls, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const files = JSON.parse(
      String((fetchImpl.mock.calls[0][1] as RequestInit).body)
    ).files;
    expect(files).toHaveLength(30);
  });

  it('aborts a hung request via the AbortSignal timeout and still resolves', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    // Never resolves on its own — only rejects when the request signal aborts,
    // proving purgeCloudflareUrls attaches an AbortSignal.timeout to the fetch.
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
          }
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    );
    const purgeCloudflareUrls = await loadPurge();

    await expect(
      purgeCloudflareUrls(['https://ogabassey.com/a'], {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        timeoutMs: 10,
      })
    ).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0];
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('deduplicates URLs before purging', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const purgeCloudflareUrls = await loadPurge();

    await purgeCloudflareUrls(
      ['https://ogabassey.com/blog', 'https://ogabassey.com/blog', ''],
      { fetchImpl: fetchImpl as unknown as typeof fetch }
    );

    const files = JSON.parse(
      String((fetchImpl.mock.calls[0][1] as RequestInit).body)
    ).files;
    expect(files).toEqual(['https://ogabassey.com/blog']);
  });

  it('no-ops on empty input without reading configuration or calling fetch', async () => {
    const fetchImpl = vi.fn();
    const purgeCloudflareUrls = await loadPurge();

    await purgeCloudflareUrls([], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(mockGetCloudflarePurgeCredentials).not.toHaveBeenCalled();
  });

  it('warns once and skips fetch when configuration is missing', async () => {
    mockGetCloudflarePurgeCredentials.mockReturnValue(undefined);
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const fetchImpl = vi.fn();
    const purgeCloudflareUrls = await loadPurge();

    await purgeCloudflareUrls(['https://ogabassey.com/a'], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await purgeCloudflareUrls(['https://ogabassey.com/b'], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('never throws when a purge request rejects', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const purgeCloudflareUrls = await loadPurge();

    await expect(
      purgeCloudflareUrls(['https://ogabassey.com/a'], {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('never throws and warns when a purge request returns non-2xx', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 403 } as Response);
    const purgeCloudflareUrls = await loadPurge();

    await expect(
      purgeCloudflareUrls(['https://ogabassey.com/a'], {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('confirms successful foreground eviction', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const purgeCloudflareUrlsConfirmed = await loadConfirmedPurge();

    await expect(
      purgeCloudflareUrlsConfirmed(['https://ogabassey.com/'], {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual({ ok: true, reason: 'purged' });
  });

  it('reports missing configuration instead of confirming eviction', async () => {
    mockGetCloudflarePurgeCredentials.mockReturnValue(undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const purgeCloudflareUrlsConfirmed = await loadConfirmedPurge();

    await expect(
      purgeCloudflareUrlsConfirmed(['https://ogabassey.com/'])
    ).resolves.toEqual({ ok: false, reason: 'missing_configuration' });
  });

  it('reports a failed foreground eviction request', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const purgeCloudflareUrlsConfirmed = await loadConfirmedPurge();

    await expect(
      purgeCloudflareUrlsConfirmed(['https://ogabassey.com/'], {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual({ ok: false, reason: 'request_failed' });
  });

  it('rejects a 2xx provider payload whose success flag is false', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ success: false, errors: [] }),
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const purgeCloudflareUrlsConfirmed = await loadConfirmedPurge();

    await expect(
      purgeCloudflareUrlsConfirmed(['https://ogabassey.com/'], {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual({ ok: false, reason: 'provider_rejected' });
  });

  it('confirms a hostname-wide purge for every storefront alias', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const purgeCloudflareHostnamesConfirmed =
      await loadConfirmedHostnamePurge();

    await expect(
      purgeCloudflareHostnamesConfirmed(
        ['ogabassey.com', 'www.ogabassey.com'],
        { fetchImpl: fetchImpl as unknown as typeof fetch }
      )
    ).resolves.toEqual({ ok: true, reason: 'purged' });
    expect(
      JSON.parse(String((fetchImpl.mock.calls[0][1] as RequestInit).body))
    ).toEqual({ hosts: ['ogabassey.com', 'www.ogabassey.com'] });
  });
});
