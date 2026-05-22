// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMerchantByIdentifier = vi.fn();
const mockGetCachedGoogleMerchantFeedData = vi.fn();
const mockGetCachedOpenAIFeedData = vi.fn();
const mockGetCachedGooglePlacesReviews = vi.fn();
const mockLoggerError = vi.fn();
const PRODUCT_UPDATED_AT = '2026-05-10T00:00:00.000Z';

type TestMerchant = {
  business_name: string;
  business_type: string;
  custom_domain: string;
  feature_settings?: {
    google_place_id: string | null;
    google_reviews_enabled: boolean;
  };
  id: string;
  pages: {
    privacy: string;
    terms: string;
  };
  paystack_subaccount_code: string;
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

vi.mock('@/lib/google-places-reviews', () => ({
  getCachedGooglePlacesReviews: (...args: unknown[]) =>
    mockGetCachedGooglePlacesReviews(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

function stubAgenticEnv() {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'usebaci.com');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.example.com');
  vi.stubEnv('OPENAI_AGENTIC_API_KEY', 'agent-api-key');
  vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY', 'confirmation-key');
  vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
  vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', 'signing-key');
  vi.stubEnv('PAYSTACK_SECRET_KEY', 'paystack-secret');
  vi.stubEnv('SUPABASE_JWT_SECRET', 'supabase-jwt-secret');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
}

function merchant(): TestMerchant {
  return {
    business_name: 'Ogabassey',
    business_type: 'electronics',
    custom_domain: 'ogabassey.com',
    id: 'merchant-1',
    pages: {
      privacy: 'Privacy policy content',
      terms: 'Terms of service content',
    },
    paystack_subaccount_code: 'ACCT_TESTMOCK1234567',
    slug: 'ogabassey',
    support_email: 'support@ogabassey.com',
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

function stubFeedData() {
  mockGetCachedOpenAIFeedData.mockResolvedValue({
    products: [
      {
        category: 'phones',
        description: 'Flagship phone',
        id: 'product-1',
        manage_stock: true,
        name: 'Samsung Galaxy S25',
        price: 500_000,
        average_rating: 4.7,
        review_count: 24,
        slug: 'samsung-galaxy-s25',
        stock: 5,
        stock_quantity: 5,
        updated_at: PRODUCT_UPDATED_AT,
      },
    ],
  });
  mockGetCachedGoogleMerchantFeedData.mockResolvedValue({
    custom_domain: 'ogabassey.com',
    imageManifest: {
      'product-1': [
        {
          is_primary: true,
          position: 0,
          status: 'verified',
          verified_format: 'jpeg',
          verified_url: 'https://cdn.example.com/product-1.jpg',
        },
      ],
    },
    products: [
      {
        category: 'phones',
        description: 'Flagship phone',
        id: 'product-1',
        manage_stock: true,
        name: 'Samsung Galaxy S25',
        price: 500_000,
        slug: 'samsung-galaxy-s25',
        stock: 5,
        stock_quantity: 5,
      },
    ],
    slug: 'ogabassey',
  });
}

describe('GET /.well-known/agent-native-commerce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    stubAgenticEnv();
    mockGetMerchantByIdentifier.mockResolvedValue(merchant());
    stubFeedData();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns the public agent-native commerce proof for storefront hosts', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://ogabassey.com/.well-known/agent-native-commerce', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    expect(response.headers.get('vercel-cdn-cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      schema_version: '2026-05-15',
      platform: 'baci',
      positioning: {
        category: 'agent-native commerce infrastructure',
        reference_merchant: 'ogabassey',
      },
      store: {
        canonical_origin: 'https://ogabassey.com',
        name: 'Ogabassey',
        slug: 'ogabassey',
      },
      proof: {
        status: 'pass',
        action: {
          payment_methods: ['paystack_bank_transfer'],
          signed_requests: true,
        },
        surfaces: {
          agent_commerce_manifest: 'https://ogabassey.com/agent-commerce.json',
          agent_native_commerce:
            'https://ogabassey.com/.well-known/agent-native-commerce',
          agent_trust: 'https://ogabassey.com/agent-trust.json',
          ucp_profile: 'https://ogabassey.com/.well-known/ucp',
        },
        trust: {
          status: 'pass',
          totals: {
            latestProductUpdatedAt: PRODUCT_UPDATED_AT,
            openAiProducts: 1,
          },
        },
      },
    });
    expect(body.proof.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'manageable',
          visibility: 'merchant_authenticated',
        }),
      ])
    );
    expect(mockGetCachedOpenAIFeedData).toHaveBeenCalledWith(
      'merchant-1',
      true
    );
    expect(mockGetCachedGoogleMerchantFeedData).toHaveBeenCalledWith(
      'merchant-1',
      'ogabassey'
    );
    expect(mockGetCachedGooglePlacesReviews).not.toHaveBeenCalled();
  });

  it('enriches Google review authority before packaging trust proof', async () => {
    mockGetMerchantByIdentifier.mockResolvedValueOnce({
      ...merchant(),
      feature_settings: {
        google_place_id: 'places/ChIJ1234',
        google_reviews_enabled: true,
      },
    });
    mockGetCachedOpenAIFeedData.mockResolvedValueOnce({
      products: [
        {
          category: 'phones',
          description: 'Flagship phone',
          id: 'product-1',
          manage_stock: true,
          name: 'Samsung Galaxy S25',
          price: 500_000,
          slug: 'samsung-galaxy-s25',
          stock: 5,
          stock_quantity: 5,
          updated_at: PRODUCT_UPDATED_AT,
        },
      ],
    });
    mockGetCachedGooglePlacesReviews.mockResolvedValueOnce({
      attributionLabel: 'Google Maps',
      attributions: [],
      businessName: 'OgaBassey Phones Store',
      googleMapsUrl: 'https://maps.google.com/?cid=123',
      rating: 4.6,
      reviewsSortedBy: 'relevance',
      source: 'google_maps',
      totalReviews: 264,
    });

    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://ogabassey.com/.well-known/agent-native-commerce', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.proof.status).toBe('pass');
    expect(body.proof.trust).toMatchObject({
      checks: {
        fail: 0,
      },
      status: 'pass',
    });
    expect(
      body.proof.stages.find((stage: { id: string }) => stage.id === 'trusted')
    ).toMatchObject({
      status: 'pass',
    });
    expect(mockGetCachedGooglePlacesReviews).toHaveBeenCalledWith('ChIJ1234');
  });

  it('returns 500 when trust authority enrichment fails unexpectedly', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockGetMerchantByIdentifier.mockResolvedValueOnce({
      ...merchant(),
      feature_settings: {
        google_place_id: 'places/ChIJ1234',
        google_reviews_enabled: true,
      },
    });
    const enrichmentModule = await import(
      '@/lib/storefront-trust/enrich-merchant-review-authority'
    );
    const enrichSpy = vi
      .spyOn(enrichmentModule, 'enrichMerchantReviewAuthority')
      .mockRejectedValueOnce(new Error('enrichment unavailable'));

    try {
      const { GET } = await import('./route');
      const response = await GET(
        new Request('https://ogabassey.com/.well-known/agent-native-commerce', {
          headers: { host: 'ogabassey.com' },
        })
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to build agent-native commerce proof');
      expect(enrichSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantReviewAuthority: expect.objectContaining({
            placeId: 'ChIJ1234',
          }),
        })
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('uses the host header when the request URL is an internal deployment host', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request(
        'https://vercel-deploy-1234.app/.well-known/agent-native-commerce',
        {
          headers: { host: 'ogabassey.com' },
        }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      store: {
        canonical_origin: 'https://ogabassey.com',
        name: 'Ogabassey',
        slug: 'ogabassey',
      },
      proof: {
        surfaces: {
          agent_native_commerce:
            'https://ogabassey.com/.well-known/agent-native-commerce',
          human_storefront: 'https://ogabassey.com',
        },
      },
    });
    expect(mockGetCachedOpenAIFeedData).toHaveBeenCalledWith(
      'merchant-1',
      true
    );
    expect(mockGetCachedGoogleMerchantFeedData).toHaveBeenCalledWith(
      'merchant-1',
      'ogabassey'
    );
  });

  it('returns 404 on the platform host', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://usebaci.com/.well-known/agent-native-commerce', {
        headers: { host: 'usebaci.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe(
      'Agent-native commerce proof is only available on storefront hosts'
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
        new Request('https://ogabassey.com/.well-known/agent-native-commerce', {
          headers: { host: 'ogabassey.com' },
        })
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to build agent-native commerce proof');
    } finally {
      errorSpy.mockRestore();
    }
  });
});
