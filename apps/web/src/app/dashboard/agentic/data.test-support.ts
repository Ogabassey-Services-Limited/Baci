import { vi } from 'vitest';

vi.mock('server-only', () => ({}));

const createClient = vi.fn();
const getMerchantForUser = vi.fn();
const loadAgenticActionHealth = vi.fn();
const getCachedOpenAIFeedData = vi.fn();
const getCachedGoogleMerchantFeedData = vi.fn();
const getCachedGooglePlacesReviews = vi.fn();
const buildMerchantTrustProfile = vi.fn();
const buildAgentCommerceTrustReadiness = vi.fn();
const checkAgentCommerceUniversalCartReadiness = vi.fn();
const supabaseFrom = vi.fn();

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

vi.mock('@/lib/agentic/agent-commerce-health-monitor', () => ({
  checkAgentCommerceUniversalCartReadiness: (...args: unknown[]) =>
    checkAgentCommerceUniversalCartReadiness(...args),
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

vi.mock('@/app/api/feed/openai/feed-data', () => ({
  getCachedOpenAIFeedData: (...args: unknown[]) =>
    getCachedOpenAIFeedData(...args),
}));

vi.mock('@/app/api/feed/google-merchant/feed-data', () => ({
  getCachedGoogleMerchantFeedData: (...args: unknown[]) =>
    getCachedGoogleMerchantFeedData(...args),
}));

vi.mock('@/lib/google-places-reviews', () => ({
  getCachedGooglePlacesReviews: (...args: unknown[]) =>
    getCachedGooglePlacesReviews(...args),
}));

import {
  actionHealth,
  createCrawlerLogQuery,
  fullReadiness,
  merchant,
  ownerStaffAccess,
} from './data.test-fixtures';

export function resetAgenticDataMocks() {
  vi.clearAllMocks();
  supabaseFrom.mockImplementation((table: string) => {
    if (table === 'crawler_logs') return createCrawlerLogQuery();
    throw new Error(`Unexpected table: ${table}`);
  });
  createClient.mockResolvedValue({ from: supabaseFrom });
  getMerchantForUser.mockResolvedValue({
    merchant,
    staffAccess: ownerStaffAccess,
  });
  loadAgenticActionHealth.mockResolvedValue(actionHealth);
  checkAgentCommerceUniversalCartReadiness.mockResolvedValue({
    checks: [],
    lastCheckedAt: '2026-05-26T12:00:00.000Z',
    status: 'pass',
    url: 'https://shop.example.com/.well-known/ucp',
  });
  getCachedOpenAIFeedData.mockResolvedValue({ products: [] });
  getCachedGoogleMerchantFeedData.mockResolvedValue({
    imageManifest: {},
    products: [],
  });
  getCachedGooglePlacesReviews.mockResolvedValue({
    attributionLabel: 'Google Maps',
    attributions: [],
    businessName: 'Demo Store',
    googleMapsUrl: 'https://maps.google.com/?cid=demo',
    rating: 4.8,
    reviews: [],
    reviewsSortedBy: 'relevance',
    source: 'google_maps',
    totalReviews: 217,
  });
  buildMerchantTrustProfile.mockReturnValue({});
  buildAgentCommerceTrustReadiness.mockReturnValue(fullReadiness);
}

export {
  actionHealth,
  createCrawlerLogQuery,
  fullReadiness,
  merchant,
  ownerStaffAccess,
} from './data.test-fixtures';
export {
  buildAgentCommerceTrustReadiness,
  buildMerchantTrustProfile,
  checkAgentCommerceUniversalCartReadiness,
  createClient,
  getCachedGoogleMerchantFeedData,
  getCachedGooglePlacesReviews,
  getCachedOpenAIFeedData,
  getMerchantForUser,
  loadAgenticActionHealth,
  supabaseFrom,
};
