import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMerchantForUser = vi.fn();
const mockBuildMerchantTrustProfile = vi.fn();
const mockGetCachedGoogleMerchantFeedData = vi.fn();
const mockBuildGoogleMerchantReadiness = vi.fn();

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

vi.mock('@/lib/storefront-trust/build-google-merchant-readiness', () => ({
  buildGoogleMerchantReadiness: (...args: unknown[]) =>
    mockBuildGoogleMerchantReadiness(...args),
}));

describe('GET /api/integrations/google-merchant-center/readiness', () => {
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

    mockGetCachedGoogleMerchantFeedData.mockResolvedValue({
      custom_domain: 'ogabassey.com',
      slug: 'ogabassey',
      products: [],
      imageManifest: {},
    });

    mockBuildGoogleMerchantReadiness.mockReturnValue({
      checks: [],
      totals: {
        products: 0,
        withBrand: 0,
        withIdentifier: 0,
        withGoogleCategory: 0,
        withVerifiedImage: 0,
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
  });

  it('loads merchant trust data and cached feed data before computing readiness', async () => {
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
    expect(mockGetCachedGoogleMerchantFeedData).toHaveBeenCalledWith(
      'merchant-1',
      'ogabassey'
    );
    expect(mockBuildGoogleMerchantReadiness).toHaveBeenCalledWith({
      merchant: expect.objectContaining({
        id: 'merchant-1',
      }),
      trustProfile: {
        socialLinks: {},
        derivedLinks: {},
      },
      feedData: {
        custom_domain: 'ogabassey.com',
        slug: 'ogabassey',
        products: [],
        imageManifest: {},
      },
    });
    expect(body).toEqual({
      checks: [],
      totals: {
        products: 0,
        withBrand: 0,
        withIdentifier: 0,
        withGoogleCategory: 0,
        withVerifiedImage: 0,
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
    expect(mockBuildMerchantTrustProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'merchant-1',
        slug: 'ogabassey',
        custom_domain: null,
      }),
      'https://ogabassey.usebaci.com'
    );
  });
});
