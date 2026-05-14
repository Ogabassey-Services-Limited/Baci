import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMerchantForUser = vi.fn();
const mockBuildMerchantTrustProfile = vi.fn();
const mockGetCachedGoogleMerchantFeedData = vi.fn();
const mockGetCachedOpenAIFeedData = vi.fn();
const mockBuildAgentCommerceTrustReadiness = vi.fn();

vi.mock('@/lib/merchant-server', () => ({
  getMerchantForUser: (...args: unknown[]) => mockGetMerchantForUser(...args),
}));

vi.mock('@/lib/storefront-trust/build-merchant-trust-profile', () => ({
  buildMerchantTrustProfile: (...args: unknown[]) =>
    mockBuildMerchantTrustProfile(...args),
}));

vi.mock('@/app/api/feed/google-merchant/feed-data', () => ({
  getCachedGoogleMerchantFeedData: (...args: unknown[]) =>
    mockGetCachedGoogleMerchantFeedData(...args),
}));

vi.mock('@/app/api/feed/openai/feed-data', () => ({
  getCachedOpenAIFeedData: (...args: unknown[]) =>
    mockGetCachedOpenAIFeedData(...args),
}));

vi.mock('@/lib/storefront-trust/build-agent-commerce-trust-readiness', () => ({
  buildAgentCommerceTrustReadiness: (...args: unknown[]) =>
    mockBuildAgentCommerceTrustReadiness(...args),
}));

describe('GET /api/integrations/agent-commerce/readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetMerchantForUser.mockResolvedValue({
      user: {
        id: 'user-1',
      },
      merchant: {
        id: 'merchant-1',
        slug: 'ogabassey',
        business_name: 'Ogabassey',
        custom_domain: 'ogabassey.com',
      },
    });

    mockBuildMerchantTrustProfile.mockReturnValue({
      socialLinks: {},
      derivedLinks: {},
    });

    mockGetCachedOpenAIFeedData.mockResolvedValue({
      products: [],
    });

    mockGetCachedGoogleMerchantFeedData.mockResolvedValue({
      custom_domain: 'ogabassey.com',
      slug: 'ogabassey',
      products: [],
      imageManifest: {},
    });

    mockBuildAgentCommerceTrustReadiness.mockReturnValue({
      checks: [],
      status: 'pass',
      surfaces: {},
      totals: {
        googleProducts: 0,
        openAiProducts: 0,
        sharedProducts: 0,
        urlMismatches: 0,
        priceMismatches: 0,
        productsWithVerifiedImages: 0,
      },
    });
  });

  it('returns 401 when there is no authenticated user', async () => {
    mockGetMerchantForUser.mockResolvedValue({
      user: null,
      merchant: null,
    });

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mockGetCachedOpenAIFeedData).not.toHaveBeenCalled();
  });

  it('loads feed and trust signals before computing agent commerce readiness', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockBuildMerchantTrustProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'merchant-1',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      }),
      'https://ogabassey.com'
    );
    expect(mockGetCachedOpenAIFeedData).toHaveBeenCalledWith('merchant-1');
    expect(mockGetCachedGoogleMerchantFeedData).toHaveBeenCalledWith(
      'merchant-1',
      'ogabassey'
    );
    expect(mockBuildAgentCommerceTrustReadiness).toHaveBeenCalledWith({
      baseUrl: 'https://ogabassey.com',
      googleFeedData: {
        custom_domain: 'ogabassey.com',
        slug: 'ogabassey',
        products: [],
        imageManifest: {},
      },
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      openAiFeedData: {
        products: [],
      },
      trustProfile: {
        socialLinks: {},
        derivedLinks: {},
      },
    });
    expect(body).toMatchObject({
      status: 'pass',
      totals: {
        googleProducts: 0,
        openAiProducts: 0,
      },
    });
  });

  it('falls back to the root-domain storefront URL when no custom domain exists', async () => {
    mockGetMerchantForUser.mockResolvedValueOnce({
      user: {
        id: 'user-1',
      },
      merchant: {
        id: 'merchant-1',
        slug: 'ogabassey',
        business_name: 'Ogabassey',
        custom_domain: null,
      },
    });

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mockBuildAgentCommerceTrustReadiness).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://ogabassey.usebaci.com',
      })
    );
  });
});
