// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMerchantByIdentifier = vi.fn();
const mockGetCachedGoogleMerchantFeedData = vi.fn();
const mockGetCachedOpenAIFeedData = vi.fn();
const PRODUCT_UPDATED_AT = '2026-05-10T00:00:00.000Z';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
}));

vi.mock('@/app/api/feed/google-merchant/feed-data', () => ({
  getCachedGoogleMerchantFeedData: (...args: unknown[]) =>
    mockGetCachedGoogleMerchantFeedData(...args),
}));

vi.mock('@/app/api/feed/openai/feed-data', () => ({
  getCachedOpenAIFeedData: (...args: unknown[]) =>
    mockGetCachedOpenAIFeedData(...args),
}));

type TestMerchant = {
  business_name: string;
  business_type: string;
  custom_domain: string;
  id: string;
  pages: {
    privacy: string;
    terms: string;
  };
  slug: string;
  support_email: string;
  trust_profile: {
    return_policy: {
      summary: string;
      window_days: number;
    };
    shipping_policy: {
      regions: string[];
      summary: string;
    };
  };
};

function merchant(): TestMerchant {
  return {
    id: 'merchant-1',
    business_name: 'Ogabassey',
    business_type: 'electronics',
    custom_domain: 'ogabassey.com',
    slug: 'ogabassey',
    support_email: 'support@ogabassey.com',
    pages: {
      privacy: 'Privacy policy content',
      terms: 'Terms of service content',
    },
    trust_profile: {
      return_policy: {
        summary: '7-day returns.',
        window_days: 7,
      },
      shipping_policy: {
        regions: ['NG'],
        summary: 'Nationwide shipping.',
      },
    },
  };
}

describe('GET /agent-trust.json', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'usebaci.com');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.example.com');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');

    mockGetMerchantByIdentifier.mockResolvedValue(merchant());
    mockGetCachedOpenAIFeedData.mockResolvedValue({
      products: [
        {
          id: 'product-1',
          name: 'Samsung Galaxy S25',
          description: 'Flagship phone',
          slug: 'samsung-galaxy-s25',
          price: 500_000,
          stock: 5,
          stock_quantity: 5,
          manage_stock: true,
          category: 'phones',
          updated_at: PRODUCT_UPDATED_AT,
        },
      ],
    });
    mockGetCachedGoogleMerchantFeedData.mockResolvedValue({
      custom_domain: 'ogabassey.com',
      imageManifest: {
        'product-1': [
          {
            verified_url: 'https://cdn.example.com/product-1.jpg',
            verified_format: 'jpeg',
            status: 'verified',
            is_primary: true,
            position: 0,
          },
        ],
      },
      products: [
        {
          id: 'product-1',
          name: 'Samsung Galaxy S25',
          description: 'Flagship phone',
          slug: 'samsung-galaxy-s25',
          price: 500_000,
          stock: 5,
          stock_quantity: 5,
          manage_stock: true,
          category: 'phones',
        },
      ],
      slug: 'ogabassey',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns public trust readiness for storefront hosts', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://ogabassey.com/agent-trust.json', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    expect(body).toMatchObject({
      schema_version: '2026-05-11',
      platform: 'baci',
      store: {
        slug: 'ogabassey',
        name: 'Ogabassey',
        canonical_origin: 'https://ogabassey.com',
      },
      trust: {
        status: 'pass',
        totals: {
          openAiProducts: 1,
          googleProducts: 1,
          sharedProducts: 1,
          latestProductUpdatedAt: PRODUCT_UPDATED_AT,
          productsWithStructuredData: 1,
          staleProducts: 0,
        },
      },
    });
    expect(body.trust.surfaces.agentTrust).toBe(
      'https://ogabassey.com/agent-trust.json'
    );
    expect(body.trust.surfaces.robots).toBe('https://ogabassey.com/robots.txt');
    expect(body.trust.surfaces.sitemap).toBe(
      'https://ogabassey.com/sitemap.xml'
    );
    expect(mockGetCachedOpenAIFeedData).toHaveBeenCalledWith('merchant-1');
    expect(mockGetCachedGoogleMerchantFeedData).toHaveBeenCalledWith(
      'merchant-1',
      'ogabassey'
    );
  });

  it('returns 404 when the storefront host has no merchant record', async () => {
    mockGetMerchantByIdentifier.mockResolvedValue(null);

    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://missing.example.com/agent-trust.json', {
        headers: { host: 'missing.example.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe(
      'Agent trust readiness is only available on storefront hosts'
    );
    expect(mockGetCachedOpenAIFeedData).not.toHaveBeenCalled();
    expect(mockGetCachedGoogleMerchantFeedData).not.toHaveBeenCalled();
  });

  it('returns 404 on platform hosts', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://usebaci.com/agent-trust.json', {
        headers: { host: 'usebaci.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe(
      'Agent trust readiness is only available on storefront hosts'
    );
    expect(mockGetCachedOpenAIFeedData).not.toHaveBeenCalled();
    expect(mockGetCachedGoogleMerchantFeedData).not.toHaveBeenCalled();
  });

  it('returns 500 when feed data cannot be loaded', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockGetCachedOpenAIFeedData.mockRejectedValueOnce(
      new Error('feed unavailable')
    );

    try {
      const { GET } = await import('./route');
      const response = await GET(
        new Request('https://ogabassey.com/agent-trust.json', {
          headers: { host: 'ogabassey.com' },
        })
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to build agent trust readiness');
    } finally {
      errorSpy.mockRestore();
    }
  });
});
