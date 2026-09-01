import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const { getCustomDomainForSlug, getSlugForCustomDomain } = await import(
  './domain-cache-simple'
);

beforeEach(() => {
  vi.clearAllMocks();
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

describe('Edge Config read coalescing', () => {
  it('shares only concurrent normalized forward reads', async () => {
    let resolve: ((value: string) => void) | undefined;
    const providerRead = new Promise<string>((done) => {
      resolve = done;
    });
    mockEdgeGet.mockReturnValueOnce(providerRead);

    const first = getCustomDomainForSlug(' OGABASSEY ');
    const second = getCustomDomainForSlug('ogabassey');
    resolve?.('ogabassey.com');

    await expect(Promise.all([first, second])).resolves.toEqual([
      'ogabassey.com',
      'ogabassey.com',
    ]);
    expect(mockEdgeGet).toHaveBeenCalledTimes(1);

    mockEdgeGet.mockResolvedValueOnce('fresh.ogabassey.com');
    await expect(getCustomDomainForSlug('ogabassey')).resolves.toBe(
      'fresh.ogabassey.com'
    );
    expect(mockEdgeGet).toHaveBeenCalledTimes(2);
  });

  it('shares only concurrent normalized reverse reads', async () => {
    let resolve: ((value: string) => void) | undefined;
    const providerRead = new Promise<string>((done) => {
      resolve = done;
    });
    mockEdgeGet.mockReturnValueOnce(providerRead);

    const first = getSlugForCustomDomain(' OGABASSEY.COM. ');
    const second = getSlugForCustomDomain('ogabassey.com');
    resolve?.('ogabassey');

    await expect(Promise.all([first, second])).resolves.toEqual([
      'ogabassey',
      'ogabassey',
    ]);
    expect(mockEdgeGet).toHaveBeenCalledTimes(1);
  });

  it('retries after a provider failure without retaining it', async () => {
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

  it('coalesces DB fallback reads during a provider outage', async () => {
    let resolveDb:
      | ((value: { data: { id: string; domains: null } }) => void)
      | undefined;
    const dbRead = new Promise<{ data: { id: string; domains: null } }>(
      (resolve) => {
        resolveDb = resolve;
      }
    );
    mockEdgeGet.mockRejectedValue(new Error('provider outage'));
    mockMaybeSingle.mockReturnValue(dbRead);

    const first = getCustomDomainForSlug('fallback-stampede');
    const second = getCustomDomainForSlug(' FALLBACK-STAMPEDE ');
    resolveDb?.({ data: { id: 'merchant-1', domains: null } });

    await expect(Promise.all([first, second])).resolves.toEqual([null, null]);
    expect(mockEdgeGet).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledTimes(1);
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
