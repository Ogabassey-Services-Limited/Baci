import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockEdgeGet = vi.fn();
vi.mock('@vercel/edge-config', () => ({
  get: (...args: unknown[]) => mockEdgeGet(...args),
}));

const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockEq = vi.fn();
mockEq.mockImplementation(() => ({
  eq: mockEq,
  limit: mockLimit,
  maybeSingle: mockMaybeSingle,
}));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('./supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

const {
  getCustomDomainForSlug,
  getSlugForCustomDomain,
  invalidateForwardDomainCacheForSlug,
  invalidateReverseDomainCacheForSlug,
} = await import('./domain-cache-simple');

beforeEach(() => {
  vi.useFakeTimers();
  mockEdgeGet.mockReset();
  mockMaybeSingle.mockReset();
  mockLimit.mockReset().mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockEq.mockReset().mockImplementation(() => ({
    eq: mockEq,
    limit: mockLimit,
    maybeSingle: mockMaybeSingle,
  }));
  mockSelect.mockReset().mockReturnValue({ eq: mockEq });
  mockFrom.mockReset().mockReturnValue({ select: mockSelect });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('successful Edge Config warm cache', () => {
  it('reuses a normalized forward mapping within the cache window', async () => {
    mockEdgeGet.mockResolvedValue('cached-edge.com');

    const first = await getCustomDomainForSlug('  EDGE-CACHED  ');
    const second = await getCustomDomainForSlug('edge-cached');

    expect(first).toBe('cached-edge.com');
    expect(second).toBe('cached-edge.com');
    expect(mockEdgeGet).toHaveBeenCalledTimes(1);
    expect(mockEdgeGet).toHaveBeenCalledWith('slug_edge-cached');
  });

  it('refetches a forward mapping after the 60 second TTL', async () => {
    mockEdgeGet
      .mockResolvedValueOnce('old-edge.com')
      .mockResolvedValueOnce('new-edge.com');

    await getCustomDomainForSlug('edge-ttl');
    vi.advanceTimersByTime(60_001);

    await expect(getCustomDomainForSlug('edge-ttl')).resolves.toBe(
      'new-edge.com'
    );
    expect(mockEdgeGet).toHaveBeenCalledTimes(2);
  });

  it('does not cache a provider failure', async () => {
    mockEdgeGet
      .mockRejectedValueOnce(new Error('temporary outage'))
      .mockResolvedValueOnce('recovered-edge.com');
    mockMaybeSingle.mockResolvedValue({ data: null });

    await getCustomDomainForSlug('edge-retry');

    await expect(getCustomDomainForSlug('edge-retry')).resolves.toBe(
      'recovered-edge.com'
    );
    expect(mockEdgeGet).toHaveBeenCalledTimes(2);
  });

  it('clears a forward mapping on slug mutation', async () => {
    mockEdgeGet
      .mockResolvedValueOnce('before-rename.com')
      .mockResolvedValueOnce('after-rename.com');

    await getCustomDomainForSlug('rename-edge');
    invalidateForwardDomainCacheForSlug(' RENAME-EDGE ');

    await expect(getCustomDomainForSlug('rename-edge')).resolves.toBe(
      'after-rename.com'
    );
    expect(mockEdgeGet).toHaveBeenCalledTimes(2);
  });

  it('reuses normalized reverse mappings within the cache window', async () => {
    mockEdgeGet.mockResolvedValue('edge-slug');

    await getSlugForCustomDomain(' EDGE-CACHED-REVERSE.COM. ');
    const second = await getSlugForCustomDomain('edge-cached-reverse.com');

    expect(second).toBe('edge-slug');
    expect(mockEdgeGet).toHaveBeenCalledTimes(1);
    expect(mockEdgeGet).toHaveBeenCalledWith('domain_edge-cached-reverse_com');
  });

  it('clears reverse mappings for a renamed slug', async () => {
    mockEdgeGet
      .mockResolvedValueOnce('old-slug')
      .mockResolvedValueOnce('new-slug');

    await getSlugForCustomDomain('reverse-rename.com');
    invalidateReverseDomainCacheForSlug(' OLD-SLUG ');

    await expect(getSlugForCustomDomain('reverse-rename.com')).resolves.toBe(
      'new-slug'
    );
    expect(mockEdgeGet).toHaveBeenCalledTimes(2);
  });

  it('prefers a new Edge mapping over a warm DB fallback', async () => {
    mockEdgeGet
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('current-edge-slug');
    mockMaybeSingle.mockResolvedValue({
      data: { merchants: { slug: 'stale-db-slug' } },
    });

    await expect(getSlugForCustomDomain('promoted.com')).resolves.toBe(
      'stale-db-slug'
    );
    await expect(getSlugForCustomDomain('promoted.com')).resolves.toBe(
      'current-edge-slug'
    );
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
