import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { ZohoCampaignsRuntimeConfig } from '@/env';
import {
  getMerchantZohoEmailBrand,
  normalizeZohoBrandColor,
  parseMerchantZohoCampaignSettings,
  resolveMerchantZohoCampaignConfig,
} from './merchant-zoho-campaign-settings';

const config: ZohoCampaignsRuntimeConfig = {
  accountsServerUrl: 'https://accounts.zoho.com',
  apiRootUrl: 'https://campaigns.zoho.com/api/v1.1',
  autoSend: false,
  clientId: 'client-id',
  clientSecret: 'client-secret',
  enabled: true,
  fromEmail: 'global@example.com',
  fromName: 'Global Store',
  contentSecret: 'content-secret',
  listKey: 'global-list',
  publicBaseUrl: 'https://usebaci.com',
  redirectUri: 'https://usebaci.com/api/integrations/zoho/callback',
  refreshToken: 'global-refresh-token',
  requestTimeoutMs: 15_000,
  topicId: 'global-topic',
};

function createSupabaseMock({
  brandColors = { primary: '#dc2626' },
  businessName = 'Merchant Store',
  customSettings,
  settingsError = null,
}: {
  brandColors?: unknown;
  businessName?: string | null;
  customSettings?: unknown;
  settingsError?: { message: string } | null;
}) {
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle() {
                  if (table === 'merchant_feature_settings') {
                    return settingsError
                      ? { data: null, error: settingsError }
                      : {
                          data: { custom_settings: customSettings ?? null },
                          error: null,
                        };
                  }

                  return {
                    data: {
                      brand_colors: brandColors,
                      business_name: businessName,
                    },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

describe('merchant Zoho Campaigns settings', () => {
  it('parses camelCase and snake_case Zoho settings from custom_settings', () => {
    expect(
      parseMerchantZohoCampaignSettings({
        zoho_campaigns: {
          auto_send: 'true',
          enabled: true,
          from_email: 'news@example.com',
          from_name: 'Example News',
          list_key: 'list-1',
          refresh_token: 'refresh-1',
          topic_id: 'topic-1',
        },
      })
    ).toEqual({
      autoSend: true,
      enabled: true,
      fromEmail: 'news@example.com',
      fromName: 'Example News',
      listKey: 'list-1',
      refreshToken: 'refresh-1',
      topicId: 'topic-1',
    });
  });

  it('does not use global Zoho credentials when merchant settings are missing', async () => {
    const result = await resolveMerchantZohoCampaignConfig({
      config,
      merchantId: 'merchant-1',
      supabase: createSupabaseMock({}),
    });

    expect(result).toEqual({
      reason: 'Zoho Campaigns is not enabled for this merchant',
      status: 'skipped',
    });
  });

  it('requires merchant-scoped refresh token, list key, and sender email', async () => {
    const result = await resolveMerchantZohoCampaignConfig({
      config,
      merchantId: 'merchant-1',
      supabase: createSupabaseMock({
        customSettings: { zohoCampaigns: { enabled: true } },
      }),
    });

    expect(result).toEqual({
      reason:
        'Missing Zoho Campaigns merchant settings: refreshToken, listKey, fromEmail',
      status: 'skipped',
    });
  });

  it('overlays tenant-specific campaign settings and merchant branding', async () => {
    const result = await resolveMerchantZohoCampaignConfig({
      config,
      merchantId: 'merchant-1',
      supabase: createSupabaseMock({
        businessName: 'Oga Gadgets',
        customSettings: {
          zohoCampaigns: {
            autoSend: true,
            enabled: true,
            fromEmail: 'support@merchant.test',
            listKey: 'merchant-list',
            refreshToken: 'merchant-refresh-token',
          },
        },
      }),
    });

    expect(result).toMatchObject({
      brand: { brandColor: '#dc2626', brandName: 'Oga Gadgets' },
      config: {
        autoSend: true,
        fromEmail: 'support@merchant.test',
        fromName: 'Oga Gadgets',
        listKey: 'merchant-list',
        refreshToken: 'merchant-refresh-token',
      },
      status: 'configured',
    });
  });

  it('normalizes short hex colors and rejects unsafe color values', () => {
    expect(normalizeZohoBrandColor('#c00')).toBe('#cc0000');
    expect(normalizeZohoBrandColor('rgb(1,2,3)')).toBeUndefined();
    expect(normalizeZohoBrandColor('javascript:alert(1)')).toBeUndefined();
  });

  it('loads safe merchant email branding from merchant data', async () => {
    await expect(
      getMerchantZohoEmailBrand(
        createSupabaseMock({
          brandColors: { accent: '#0f0' },
          businessName: '  Merchant Updates  ',
        }),
        'merchant-1'
      )
    ).resolves.toEqual({
      brandColor: '#00ff00',
      brandName: 'Merchant Updates',
    });
  });
});
