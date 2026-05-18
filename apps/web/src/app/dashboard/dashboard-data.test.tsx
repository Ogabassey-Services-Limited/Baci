import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.fn();
const getMerchantForUser = vi.fn();
const getDashboardMetrics = vi.fn();
const getRecentSales = vi.fn();
const getMonthlyChartData = vi.fn();
const getCachedOpenAIFeedData = vi.fn();
const getCachedGoogleMerchantFeedData = vi.fn();
const loadAgenticActionHealth = vi.fn();
const buildMerchantTrustProfile = vi.fn();
const buildAgentCommerceTrustReadiness = vi.fn();

const clientProps = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({})),
}));

vi.mock('@/lib/merchant-server', () => ({
  getMerchantForUser: () => getMerchantForUser(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => createClient(...args),
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

vi.mock('./actions', () => ({
  getDashboardMetrics: (...args: unknown[]) => getDashboardMetrics(...args),
  getRecentSales: (...args: unknown[]) => getRecentSales(...args),
  getMonthlyChartData: (...args: unknown[]) => getMonthlyChartData(...args),
}));

vi.mock('../api/feed/openai/feed-data', () => ({
  getCachedOpenAIFeedData: (...args: unknown[]) =>
    getCachedOpenAIFeedData(...args),
}));

vi.mock('../api/feed/google-merchant/feed-data', () => ({
  getCachedGoogleMerchantFeedData: (...args: unknown[]) =>
    getCachedGoogleMerchantFeedData(...args),
}));

vi.mock('./client-page', () => ({
  default: (props: Record<string, unknown>) => {
    clientProps(props);
    return <div data-testid="client-page" />;
  },
}));

const merchantBase = {
  business_name: 'Demo Store',
  custom_domain: null,
  id: 'merchant-1',
  slug: 'demo',
};

const fullReadiness = {
  checks: [
    {
      affectedProductIds: ['p-1', 'p-2', 'p-3'],
      id: 'catalog-surface-parity' as const,
      label: 'Catalog surface parity',
      message: '3 products missing from a surface.',
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
    openAiProductFeed: 'https://shop.example.com/feeds/openai.jsonl',
    productApi: 'https://shop.example.com/api/storefront/demo/products',
    llms: 'https://shop.example.com/llms.txt',
    policies: {
      privacy_policy_url: 'https://shop.example.com/privacy',
      return_policy_url: 'https://shop.example.com/returns',
      shipping_policy_url: 'https://shop.example.com/shipping',
      terms_of_service_url: 'https://shop.example.com/terms',
    },
    robots: 'https://shop.example.com/robots.txt',
    sitemap: 'https://shop.example.com/sitemap.xml',
    ucpProfile: 'https://shop.example.com/.well-known/ucp',
  },
  totals: {
    googleProducts: 3,
    latestProductUpdatedAt: '2026-05-15T00:00:00.000Z',
    openAiProducts: 3,
    priceMismatches: 0,
    productsWithStructuredData: 3,
    productsWithVerifiedImages: 3,
    sharedProducts: 3,
    staleProducts: 0,
    urlMismatches: 0,
  },
};

async function renderDashboardData() {
  const { DashboardData } = await import('./dashboard-data');
  const ui = await DashboardData();
  render(ui);
}

describe('DashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockReturnValue({});
    loadAgenticActionHealth.mockResolvedValue({
      actions: [
        {
          code: 'AGENTIC_ACTIONS_HEALTHY',
          count: 0,
          message: 'No recent agentic action issues need attention.',
          severity: 'ok',
        },
      ],
      generated_at: '2026-05-16T12:00:00.000Z',
    });
    getDashboardMetrics.mockResolvedValue(null);
    getRecentSales.mockResolvedValue([]);
    getMonthlyChartData.mockResolvedValue([]);
    getCachedOpenAIFeedData.mockResolvedValue({ products: [] });
    getCachedGoogleMerchantFeedData.mockResolvedValue({ products: [] });
    buildMerchantTrustProfile.mockReturnValue({});
    buildAgentCommerceTrustReadiness.mockReturnValue(fullReadiness);
  });

  it('loads only home dashboard data for published merchants', async () => {
    getMerchantForUser.mockResolvedValue({
      merchant: { ...merchantBase, is_published: true },
    });
    getDashboardMetrics.mockResolvedValue({
      activeNow: { change: 0, value: 1 },
      aov: 0,
      customers: { change: 0, value: 2 },
      fulfillmentRate: 0,
      orders: { change: 0, value: 3 },
      revenue: { change: 0, value: 4 },
    });

    await renderDashboardData();

    expect(buildAgentCommerceTrustReadiness).not.toHaveBeenCalled();
    expect(loadAgenticActionHealth).not.toHaveBeenCalled();
    expect(getCachedOpenAIFeedData).not.toHaveBeenCalled();
    expect(getCachedGoogleMerchantFeedData).not.toHaveBeenCalled();
    const props = clientProps.mock.calls[0][0];
    expect(props.initialMetrics).toMatchObject({
      revenue: { value: 4 },
      orders: { value: 3 },
    });
    expect(props).not.toHaveProperty('initialActionHealth');
    expect(props).not.toHaveProperty('initialTrustReadiness');
  });

  it('does not load agentic centers for unpublished merchants', async () => {
    getMerchantForUser.mockResolvedValue({
      merchant: { ...merchantBase, is_published: false },
    });

    await renderDashboardData();

    expect(buildAgentCommerceTrustReadiness).not.toHaveBeenCalled();
    expect(getCachedOpenAIFeedData).not.toHaveBeenCalled();
    expect(getCachedGoogleMerchantFeedData).not.toHaveBeenCalled();
    expect(loadAgenticActionHealth).not.toHaveBeenCalled();

    const props = clientProps.mock.calls[0][0];
    expect(props).not.toHaveProperty('initialActionHealth');
    expect(props).not.toHaveProperty('initialTrustReadiness');
  });

  it('renders the client page when there is no merchant', async () => {
    getMerchantForUser.mockResolvedValue({ merchant: null });

    await renderDashboardData();

    expect(buildAgentCommerceTrustReadiness).not.toHaveBeenCalled();
    const props = clientProps.mock.calls[0][0];
    expect(props).toEqual({});
  });
});
