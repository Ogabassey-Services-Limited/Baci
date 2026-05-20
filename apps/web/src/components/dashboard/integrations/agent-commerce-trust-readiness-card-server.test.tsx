import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/api/feed/google-merchant/feed-data', () => ({
  getCachedGoogleMerchantFeedData: vi.fn(),
}));

vi.mock('@/app/api/feed/openai/feed-data', () => ({
  getCachedOpenAIFeedData: vi.fn(),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: vi.fn(() => 'https://example.com'),
}));

vi.mock('@/lib/storefront-trust/build-merchant-trust-profile', () => ({
  buildMerchantTrustProfile: vi.fn(() => ({
    derivedLinks: {},
    socialLinks: {},
  })),
}));

vi.mock('@/lib/storefront-trust/build-agent-commerce-trust-readiness', () => ({
  buildAgentCommerceTrustReadiness: vi.fn(() => ({
    checks: [],
    status: 'pass',
    surfaces: {
      agentCommerceManifest: 'https://example.com/agent-commerce.json',
      agentNativeCommerce:
        'https://example.com/.well-known/agent-native-commerce',
      agentTrust: 'https://example.com/agent-trust.json',
      currentProductFeed: 'https://example.com/feeds/agent-products.jsonl',
      googleMerchantXml: 'https://example.com/feeds/google-merchant.xml',
      openAiProductFeed: 'https://example.com/feeds/openai.jsonl',
      productApi: 'https://example.com/api/storefront/demo/products',
      llms: 'https://example.com/llms.txt',
      policies: {
        privacy_policy_url: 'https://example.com/privacy',
        return_policy_url: 'https://example.com/returns',
        shipping_policy_url: 'https://example.com/shipping',
        terms_of_service_url: 'https://example.com/terms',
      },
      robots: 'https://example.com/robots.txt',
      sitemap: 'https://example.com/sitemap.xml',
      ucpProfile: 'https://example.com/.well-known/ucp',
    },
    totals: {
      googleProducts: 0,
      openAiProducts: 0,
      sharedProducts: 0,
      urlMismatches: 0,
      priceMismatches: 0,
      productsWithVerifiedImages: 0,
      latestProductUpdatedAt: null,
      productsWithStructuredData: 0,
      staleProducts: 0,
    },
  })),
}));

vi.mock('@/lib/storefront-trust/enrich-merchant-review-authority', () => ({
  enrichMerchantReviewAuthority: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@/lib/sanitize-core', () => ({
  sanitizeForLog: vi.fn((value: unknown) => value),
}));

vi.mock('./agent-commerce-trust-readiness-card', () => ({
  AgentCommerceTrustReadinessCard: ({
    error,
    readiness,
  }: {
    error?: string | null;
    readiness: { status: string } | null;
  }) => (
    <div>
      trust-card:{readiness?.status ?? 'none'}:{error ?? 'none'}
    </div>
  ),
}));

import { getCachedGoogleMerchantFeedData } from '@/app/api/feed/google-merchant/feed-data';
import { getCachedOpenAIFeedData } from '@/app/api/feed/openai/feed-data';
import { logger } from '@/lib/logger';
import { buildAgentCommerceTrustReadiness } from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';
import { enrichMerchantReviewAuthority } from '@/lib/storefront-trust/enrich-merchant-review-authority';
import { AgentCommerceTrustReadinessCardServer } from './agent-commerce-trust-readiness-card-server';

const merchant = {
  id: 'merchant-1',
  slug: 'demo-store',
  business_name: 'Demo Store',
  custom_domain: null,
  trust_profile: null,
};

describe('AgentCommerceTrustReadinessCardServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(enrichMerchantReviewAuthority).mockImplementation(
      async (profile) => profile
    );
  });

  it('loads trust readiness and passes it to the card', async () => {
    vi.mocked(getCachedOpenAIFeedData).mockResolvedValue({
      products: [],
    } as never);
    vi.mocked(getCachedGoogleMerchantFeedData).mockResolvedValue({
      products: [],
      imageManifest: {},
      custom_domain: null,
      slug: 'demo-store',
    } as never);

    render(await AgentCommerceTrustReadinessCardServer({ merchant }));

    expect(enrichMerchantReviewAuthority).toHaveBeenCalledWith({
      derivedLinks: {},
      socialLinks: {},
    });
    expect(buildAgentCommerceTrustReadiness).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://example.com',
        merchant: {
          business_name: 'Demo Store',
          slug: 'demo-store',
        },
      })
    );
    expect(screen.getByText('trust-card:pass:none')).toBeInTheDocument();
  });

  it('renders an error fallback when readiness loading fails', async () => {
    vi.mocked(getCachedOpenAIFeedData).mockRejectedValueOnce(new Error('boom'));
    vi.mocked(getCachedGoogleMerchantFeedData).mockResolvedValue({
      products: [],
      imageManifest: {},
      custom_domain: null,
      slug: 'demo-store',
    } as never);

    render(await AgentCommerceTrustReadinessCardServer({ merchant }));

    expect(
      screen.getByText('trust-card:none:Unable to load agent trust health')
    ).toBeInTheDocument();
    expect(logger.error).toHaveBeenCalled();
  });
});
