import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveStorefrontComparePageStatus } from './storefront-compare-page-status';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildOptions(
  fetchImpl: typeof fetch,
  overrides: Partial<
    Parameters<typeof resolveStorefrontComparePageStatus>[0]
  > = {}
) {
  return {
    origin: 'http://localhost:3000',
    identifier: 'ogabassey',
    categorySlug: 'laptops',
    comparisonSlug: 'left-laptop-vs-right-laptop',
    secret: 'test-internal-secret',
    fetchImpl,
    ...overrides,
  };
}

describe('resolveStorefrontComparePageStatus', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns missing only for an explicit positive absence', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ present: false, hasError: false }));

    await expect(
      resolveStorefrontComparePageStatus(buildOptions(fetchImpl))
    ).resolves.toEqual({ kind: 'missing' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3000/api/internal/compare-page-status/ogabassey?category=laptops&comparison=left-laptop-vs-right-laptop',
      expect.objectContaining({
        headers: { 'x-baci-internal-auth': 'test-internal-secret' },
        redirect: 'manual',
      })
    );
  });

  it('falls through for renderable and degraded verdicts', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ present: true, hasError: false }))
      .mockResolvedValueOnce(jsonResponse({ present: false, hasError: true }));

    await expect(
      resolveStorefrontComparePageStatus(buildOptions(fetchImpl))
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });
    await expect(
      resolveStorefrontComparePageStatus(buildOptions(fetchImpl))
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });
  });

  it('fails open without a secret or trusted base URL', async () => {
    const fetchImpl = vi.fn();

    await expect(
      resolveStorefrontComparePageStatus(
        buildOptions(fetchImpl, { secret: undefined })
      )
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });
    await expect(
      resolveStorefrontComparePageStatus(
        buildOptions(fetchImpl, { origin: 'https://ogabassey.com' })
      )
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('hard-statuses a bounded malformed composite as a confirmed absence', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ present: false, hasError: false }));

    await expect(
      resolveStorefrontComparePageStatus(
        buildOptions(fetchImpl, { comparisonSlug: 'not-a-comparison' })
      )
    ).resolves.toEqual({ kind: 'missing' });
    expect(fetchImpl).toHaveBeenCalled();
  });

  it.each([
    ['transport failure', new Error('socket hang up')],
    ['timeout', new DOMException('Timed out', 'TimeoutError')],
  ])('fails open on %s', async (_label, error) => {
    const fetchImpl = vi.fn().mockRejectedValue(error);

    await expect(
      resolveStorefrontComparePageStatus(buildOptions(fetchImpl))
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });
  });

  it('fails open on redirects, non-2xx, non-JSON, and malformed bodies', async () => {
    const redirectFetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 308,
        headers: { Location: 'https://attacker.example/steal' },
      })
    );
    await expect(
      resolveStorefrontComparePageStatus(buildOptions(redirectFetch))
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });

    const httpFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'Unauthorized' }, 401));
    await expect(
      resolveStorefrontComparePageStatus(buildOptions(httpFetch))
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });

    const nonJsonFetch = vi.fn().mockResolvedValue(new Response('not-json'));
    await expect(
      resolveStorefrontComparePageStatus(buildOptions(nonJsonFetch))
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });

    const malformedFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ present: false }));
    await expect(
      resolveStorefrontComparePageStatus(buildOptions(malformedFetch))
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });
  });
});
