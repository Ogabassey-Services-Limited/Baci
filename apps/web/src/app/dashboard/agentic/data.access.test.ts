import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  actionHealth,
  createClient,
  createCrawlerLogQuery,
  getCachedGoogleMerchantFeedData,
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
  it('skips loaders when the store is unpublished', async () => {
    getMerchantForUser.mockResolvedValue({
      merchant: { ...merchant, is_published: false },
      staffAccess: ownerStaffAccess,
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(loadAgenticActionHealth).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(getCachedOpenAIFeedData).not.toHaveBeenCalled();
    expect(getCachedGoogleMerchantFeedData).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      agentControls: {
        customSettings: {
          agentic_agent_allowlist: ['openai-agent'],
          agentic_agent_denylist: ['legacy-bot'],
          unrelated_setting: 'preserve-me',
        },
        enabled: true,
      },
      actionCenterState: 'ready',
      actionHealth: null,
      crawlerCenterState: 'ready',
      crawlerSummary: null,
      isPublished: false,
      merchantId: 'merchant-1',
      trustCenterState: 'ready',
      trustReadiness: null,
    });
  });

  it('returns unauthorized states when no merchant is available', async () => {
    getMerchantForUser.mockResolvedValue({
      merchant: null,
      staffAccess: {
        isOwner: false,
        isStaff: false,
        permissions: {},
        role: null,
      },
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(result).toMatchObject({
      agentControls: null,
      actionCenterState: 'unauthorized',
      actionHealth: null,
      crawlerCenterState: 'unauthorized',
      crawlerSummary: null,
      merchantId: null,
      trustCenterState: 'unauthorized',
      trustReadiness: null,
    });
  });

  it('does not load centers when staff lacks integrations view permission', async () => {
    getMerchantForUser.mockResolvedValue({
      merchant,
      staffAccess: {
        isOwner: false,
        isStaff: true,
        permissions: {
          analytics: { view: false },
          integrations: { view: false },
        },
        role: 'manager',
      },
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(loadAgenticActionHealth).not.toHaveBeenCalled();
    expect(getCachedOpenAIFeedData).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      agentControls: null,
      actionCenterState: 'unauthorized',
      actionHealth: null,
      crawlerCenterState: 'unauthorized',
      crawlerSummary: null,
      isPublished: true,
      merchantId: 'merchant-1',
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
    expect(result.crawlerCenterState).toBe('ready');
    expect(result.trustCenterState).toBe('ready');
  });

  it('marks trust center unavailable when trust readiness loading fails', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    getCachedOpenAIFeedData.mockRejectedValueOnce(
      new Error('feed unavailable')
    );
    const { loadAgenticCentersData } = await import('./data');

    try {
      const result = await loadAgenticCentersData();

      expect(result.actionCenterState).toBe('ready');
      expect(result.actionHealth).toBe(actionHealth);
      expect(result.crawlerCenterState).toBe('ready');
      expect(result.trustCenterState).toBe('error');
      expect(result.trustReadiness).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch trust readiness:',
        'feed unavailable'
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('keeps crawler visibility available for staff with analytics view only', async () => {
    getMerchantForUser.mockResolvedValue({
      merchant,
      staffAccess: {
        isOwner: false,
        isStaff: true,
        permissions: {
          analytics: { view: true },
          integrations: { view: false },
        },
        role: 'marketing',
      },
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(loadAgenticActionHealth).not.toHaveBeenCalled();
    expect(getCachedOpenAIFeedData).not.toHaveBeenCalled();
    expect(result.actionCenterState).toBe('unauthorized');
    expect(result.trustCenterState).toBe('unauthorized');
    expect(result.crawlerCenterState).toBe('ready');
    expect(result.crawlerSummary?.totalCrawls).toBe(2);
  });

  it('marks crawler visibility unavailable when crawler loading fails', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    supabaseFrom.mockImplementation((table: string) => {
      if (table === 'crawler_logs') {
        return createCrawlerLogQuery({
          data: null,
          error: { message: 'crawler logs unavailable' },
        });
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const { loadAgenticCentersData } = await import('./data');

    try {
      const result = await loadAgenticCentersData();

      expect(result.actionCenterState).toBe('ready');
      expect(result.trustCenterState).toBe('ready');
      expect(result.crawlerCenterState).toBe('error');
      expect(result.crawlerSummary).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch crawler visibility:',
        'crawler logs unavailable'
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
