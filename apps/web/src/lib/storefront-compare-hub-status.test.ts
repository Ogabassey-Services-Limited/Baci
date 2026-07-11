import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveStorefrontCompareHubStatus } from './storefront-compare-hub-status';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildOptions(
  fetchImpl: typeof fetch,
  overrides: Partial<
    Parameters<typeof resolveStorefrontCompareHubStatus>[0]
  > = {}
) {
  return {
    // Loopback origin: resolveBaseUrl returns it verbatim, so the transport
    // path is exercised without a configured platform root domain.
    origin: 'http://localhost:3000',
    identifier: 'ogabassey',
    categorySlug: 'printers',
    secret: 'test-internal-secret',
    fetchImpl,
    ...overrides,
  };
}

describe('resolveStorefrontCompareHubStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  it('resolves empty for a confirmed-empty hub verdict', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ empty: true, hasError: false }));

    const resolution = await resolveStorefrontCompareHubStatus(
      buildOptions(fetchImpl)
    );

    expect(resolution).toEqual({ kind: 'empty' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3000/api/internal/compare-hub-status/ogabassey?category=printers',
      expect.objectContaining({
        headers: { 'x-baci-internal-auth': 'test-internal-secret' },
        redirect: 'manual',
      })
    );
  });

  it('resolves renderable for a non-empty hub verdict', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ empty: false, hasError: false }));

    await expect(
      resolveStorefrontCompareHubStatus(buildOptions(fetchImpl))
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });
  });

  it('never sends the secret to an untrusted request origin (no configured base URL)', async () => {
    // A merchant custom domain's DNS is merchant-controlled: without a trusted
    // platform base URL the preflight must fail open WITHOUT fetching, or the
    // internal secret could be exfiltrated to wherever that domain resolves.
    const fetchImpl = vi.fn();

    await expect(
      resolveStorefrontCompareHubStatus(
        buildOptions(fetchImpl, { origin: 'https://ogabassey.com' })
      )
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'no-base-url' })
    );
  });

  it('fails open when the secret is missing without calling the route', async () => {
    const fetchImpl = vi.fn();

    await expect(
      resolveStorefrontCompareHubStatus(
        buildOptions(fetchImpl, { secret: undefined })
      )
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails open on an unsafe category segment without calling the route', async () => {
    const fetchImpl = vi.fn();

    await expect(
      resolveStorefrontCompareHubStatus(
        buildOptions(fetchImpl, { categorySlug: 'a'.repeat(600) })
      )
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails open on transport errors', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('socket hang up'));

    await expect(
      resolveStorefrontCompareHubStatus(buildOptions(fetchImpl))
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });
  });

  it('fails open on a fetch timeout', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new DOMException('Timed out', 'TimeoutError'));

    await expect(
      resolveStorefrontCompareHubStatus(buildOptions(fetchImpl))
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'timeout' })
    );
  });

  it('fails open on a redirect response instead of replaying the secret to its target', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 308,
        headers: { Location: 'https://attacker.example/steal' },
      })
    );

    await expect(
      resolveStorefrontCompareHubStatus(buildOptions(fetchImpl))
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'redirect' })
    );
  });

  it('fails open on a non-200 response', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'Unauthorized' }, 401));

    await expect(
      resolveStorefrontCompareHubStatus(buildOptions(fetchImpl))
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });
  });

  it('fails open when a successful response is not JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('not-json'));

    await expect(
      resolveStorefrontCompareHubStatus(buildOptions(fetchImpl))
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });
  });

  it('fails open on a schema-invalid body', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ unexpected: true }));

    await expect(
      resolveStorefrontCompareHubStatus(buildOptions(fetchImpl))
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });
  });

  it('fails open on a degraded-resolver (hasError) body even when marked empty', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ empty: true, hasError: true }));

    await expect(
      resolveStorefrontCompareHubStatus(buildOptions(fetchImpl))
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });
  });
});
