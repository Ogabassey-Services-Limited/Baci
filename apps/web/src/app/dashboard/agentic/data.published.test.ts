import { beforeEach, describe, expect, it } from 'vitest';
import {
  actionHealth,
  buildAgentCommerceTrustReadiness,
  buildMerchantTrustProfile,
  checkAgentCommerceUniversalCartReadiness,
  getCachedGoogleMerchantFeedData,
  getCachedGooglePlacesReviews,
  getCachedOpenAIFeedData,
  getMerchantForUser,
  loadAgenticActionHealth,
  merchant,
  ownerStaffAccess,
  resetAgenticDataMocks,
  supabaseFrom,
} from './data.test-support';

describe('loadAgenticCentersData', () => {
  beforeEach(resetAgenticDataMocks);
  it('loads action, slim trust, and crawler center data for published merchants', async () => {
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(loadAgenticActionHealth).toHaveBeenCalledWith(
      expect.anything(),
      'merchant-1'
    );
    expect(checkAgentCommerceUniversalCartReadiness).toHaveBeenCalledWith({
      custom_domain: null,
      slug: 'demo',
    });
    expect(getCachedOpenAIFeedData).toHaveBeenCalledWith('merchant-1', true);
    expect(getCachedGoogleMerchantFeedData).toHaveBeenCalledWith(
      'merchant-1',
      'demo'
    );
    expect(result.actionCenterState).toBe('ready');
    expect(result.actionHealth).toBe(actionHealth);
    expect(result.merchantId).toBe('merchant-1');
    expect(result.agentControls).toEqual({
      customSettings: {
        agentic_agent_allowlist: ['openai-agent'],
        agentic_agent_denylist: ['legacy-bot'],
        unrelated_setting: 'preserve-me',
      },
      enabled: true,
    });
    expect(result.trustCenterState).toBe('ready');
    expect(result.trustReadiness).not.toHaveProperty('surfaces');
    expect(result.trustReadiness?.checks[0]).toMatchObject({
      affectedProductCount: 2,
      id: 'catalog-surface-parity',
    });
    expect(supabaseFrom).toHaveBeenCalledWith('crawler_logs');
    expect(result.crawlerCenterState).toBe('ready');
    expect(result.crawlerSummary).toMatchObject({
      health: {
        aiAgentCrawls: 2,
        cacheMissCrawls: 1,
        failedCrawls: 0,
      },
      isPartial: false,
      totalCrawls: 2,
      windowDays: 14,
    });
    expect(result.universalCartReadiness).toMatchObject({
      status: 'pass',
      url: 'https://shop.example.com/.well-known/ucp',
    });
  });

  it.each([
    [
      'disabled checkout',
      {
        agentic_checkout_enabled: false,
        custom_settings: { agentic_agent_allowlist: ['chatgpt'] },
      },
      {
        customSettings: { agentic_agent_allowlist: ['chatgpt'] },
        enabled: false,
      },
    ],
    [
      'missing checkout flag',
      {
        custom_settings: { agentic_agent_denylist: ['legacy-bot'] },
      },
      {
        customSettings: { agentic_agent_denylist: ['legacy-bot'] },
        enabled: true,
      },
    ],
    ['null feature settings', null, { customSettings: {}, enabled: true }],
    [
      'undefined feature settings',
      undefined,
      { customSettings: {}, enabled: true },
    ],
    [
      'missing custom settings',
      { agentic_checkout_enabled: true },
      { customSettings: {}, enabled: true },
    ],
  ])('builds agent controls for %s', async (_label, featureSettings, expectedAgentControls) => {
    getMerchantForUser.mockResolvedValue({
      merchant: { ...merchant, feature_settings: featureSettings },
      staffAccess: ownerStaffAccess,
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(result.agentControls).toEqual(expectedAgentControls);
  });

  it('enriches Google review authority before building dashboard trust readiness', async () => {
    buildMerchantTrustProfile.mockReturnValueOnce({
      merchantReviewAuthority: {
        attributionLabel: 'Google Maps',
        placeId: 'ChIJ1234',
        reviewsSortedBy: 'relevance',
        source: 'google_maps',
      },
    });
    const { loadAgenticCentersData } = await import('./data');

    await loadAgenticCentersData();

    expect(getCachedGooglePlacesReviews).toHaveBeenCalledWith('ChIJ1234');
    expect(buildAgentCommerceTrustReadiness).toHaveBeenCalledWith(
      expect.objectContaining({
        trustProfile: expect.objectContaining({
          merchantReviewAuthority: expect.objectContaining({
            googleMapsUrl: 'https://maps.google.com/?cid=demo',
            placeId: 'ChIJ1234',
            rating: 4.8,
            totalReviews: 217,
          }),
        }),
      })
    );
  });

  it('skips Google review enrichment when dashboard authority has no Place ID', async () => {
    buildMerchantTrustProfile.mockReturnValueOnce({
      merchantReviewAuthority: {
        attributionLabel: 'Google Maps',
        reviewsSortedBy: 'relevance',
        source: 'google_maps',
      },
    });
    const { loadAgenticCentersData } = await import('./data');

    await loadAgenticCentersData();

    const readinessInput = buildAgentCommerceTrustReadiness.mock
      .calls[0]?.[0] as
      | {
          trustProfile: {
            merchantReviewAuthority?: Record<string, unknown>;
          };
        }
      | undefined;

    expect(getCachedGooglePlacesReviews).not.toHaveBeenCalled();
    expect(
      readinessInput?.trustProfile.merchantReviewAuthority
    ).not.toHaveProperty('googleMapsUrl');
    expect(
      readinessInput?.trustProfile.merchantReviewAuthority
    ).not.toHaveProperty('rating');
    expect(
      readinessInput?.trustProfile.merchantReviewAuthority
    ).not.toHaveProperty('totalReviews');
  });
});
