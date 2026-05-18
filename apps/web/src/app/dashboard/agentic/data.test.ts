import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const createClient = vi.fn();
const getMerchantForUser = vi.fn();
const loadAgenticActionHealth = vi.fn();
const getCachedOpenAIFeedData = vi.fn();
const getCachedGoogleMerchantFeedData = vi.fn();
const buildMerchantTrustProfile = vi.fn();
const buildAgentCommerceTrustReadiness = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}));

vi.mock('@/lib/merchant-server', () => ({
  getMerchantForUser: () => getMerchantForUser(),
}));

vi.mock('@/lib/agentic/action-health-loader', () => ({
  loadAgenticActionHealth: (...args: unknown[]) =>
    loadAgenticActionHealth(...args),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: () => 'https://shop.example.com',
}));

vi.mock('@/lib/storefront-trust/build-merchant-trust-profile', () => ({
  buildMerchantTrustProfile: (...args: unknown[]) =>
    buildMerchantTrustProfile(...args),
}));

vi.mock(
  '@/lib/storefront-trust/build-agent-commerce-trust-readiness',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/lib/storefront-trust/build-agent-commerce-trust-readiness')
      >();
    return {
      ...actual,
      buildAgentCommerceTrustReadiness: (...args: unknown[]) =>
        buildAgentCommerceTrustReadiness(...args),
    };
  }
);

vi.mock('../../api/feed/openai/feed-data', () => ({
  getCachedOpenAIFeedData: (...args: unknown[]) =>
    getCachedOpenAIFeedData(...args),
}));

vi.mock('../../api/feed/google-merchant/feed-data', () => ({
  getCachedGoogleMerchantFeedData: (...args: unknown[]) =>
    getCachedGoogleMerchantFeedData(...args),
}));

const merchant = {
  business_name: 'Demo Store',
  custom_domain: null,
  id: 'merchant-1',
  is_published: true,
  slug: 'demo',
};

const actionHealth = {
  actions: [
    {
      code: 'AGENTIC_ACTIONS_HEALTHY',
      count: 0,
      message: 'No recent agentic action issues need attention.',
      severity: 'ok' as const,
    },
  ],
  generated_at: '2026-05-18T08:00:00.000Z',
};

const fullReadiness = {
  checks: [
    {
      affectedProductIds: ['p-1', 'p-2'],
      id: 'catalog-surface-parity' as const,
      label: 'Catalog surface parity',
      message: '2 products missing from a surface.',
      severity: 'fail' as const,
    },
  ],
  status: 'fail' as const,
  surfaces: {
    agentCommerceManifest: 'https://shop.example.com/agent-commerce.json',
    agentNativeCommerce:
      'https://shop.example.com/.well-known/agent-native-commerce',
    agentTrust: 'https://shop.example.com/agent-trust.json',
    currentProductFeed: 'https://shop.example.com/feeds/agent-products.jsonl',
    googleMerchantXml: 'https://shop.example.com/feeds/google-merchant.xml',
    llms: 'https://shop.example.com/llms.txt',
    openAiProductFeed: 'https://shop.example.com/feeds/openai.jsonl',
    policies: {
      privacy_policy_url: 'https://shop.example.com/privacy',
      return_policy_url: 'https://shop.example.com/returns',
      shipping_policy_url: 'https://shop.example.com/shipping',
      terms_of_service_url: 'https://shop.example.com/terms',
    },
    productApi: 'https://shop.example.com/api/storefront/demo/products',
    robots: 'https://shop.example.com/robots.txt',
    sitemap: 'https://shop.example.com/sitemap.xml',
    ucpProfile: 'https://shop.example.com/.well-known/ucp',
  },
  totals: {
    googleProducts: 2,
    latestProductUpdatedAt: '2026-05-18T08:00:00.000Z',
    openAiProducts: 2,
    priceMismatches: 0,
    productsWithStructuredData: 2,
    productsWithVerifiedImages: 2,
    sharedProducts: 2,
    staleProducts: 0,
    urlMismatches: 0,
  },
};

describe('loadAgenticCentersData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({ from: vi.fn() });
    getMerchantForUser.mockResolvedValue({ merchant });
    loadAgenticActionHealth.mockResolvedValue(actionHealth);
    getCachedOpenAIFeedData.mockResolvedValue({ products: [] });
    getCachedGoogleMerchantFeedData.mockResolvedValue({
      imageManifest: {},
      products: [],
    });
    buildMerchantTrustProfile.mockReturnValue({});
    buildAgentCommerceTrustReadiness.mockReturnValue(fullReadiness);
  });

  it('loads action and slim trust center data for published merchants', async () => {
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(loadAgenticActionHealth).toHaveBeenCalledWith(
      expect.anything(),
      'merchant-1'
    );
    expect(getCachedOpenAIFeedData).toHaveBeenCalledWith('merchant-1', true);
    expect(getCachedGoogleMerchantFeedData).toHaveBeenCalledWith(
      'merchant-1',
      'demo'
    );
    expect(result.actionCenterState).toBe('ready');
    expect(result.actionHealth).toBe(actionHealth);
    expect(result.trustCenterState).toBe('ready');
    expect(result.trustReadiness).not.toHaveProperty('surfaces');
    expect(result.trustReadiness?.checks[0]).toMatchObject({
      affectedProductCount: 2,
      id: 'catalog-surface-parity',
    });
  });

  it('skips loaders when the store is unpublished', async () => {
    getMerchantForUser.mockResolvedValue({
      merchant: { ...merchant, is_published: false },
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(loadAgenticActionHealth).not.toHaveBeenCalled();
    expect(getCachedOpenAIFeedData).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      actionCenterState: 'ready',
      actionHealth: null,
      isPublished: false,
      trustCenterState: 'ready',
      trustReadiness: null,
    });
  });

  it('returns unauthorized states when no merchant is available', async () => {
    getMerchantForUser.mockResolvedValue({ merchant: null });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(result).toMatchObject({
      actionCenterState: 'unauthorized',
      actionHealth: null,
      trustCenterState: 'unauthorized',
      trustReadiness: null,
    });
  });

  it('marks action center unauthorized on permission-denied loader errors', async () => {
    loadAgenticActionHealth.mockRejectedValueOnce({
      code: '42501',
      message: 'permission denied for relation merchant_feature_settings',
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(result.actionCenterState).toBe('unauthorized');
    expect(result.actionHealth).toBeNull();
    expect(result.trustCenterState).toBe('ready');
  });
});
