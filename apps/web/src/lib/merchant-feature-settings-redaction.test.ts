import { describe, expect, it } from 'vitest';
import {
  preserveZohoCampaignSecretCustomSettings,
  redactMerchantFeatureSettingsResponse,
} from './merchant-feature-settings-redaction';

describe('merchant feature settings redaction', () => {
  it('redacts Zoho Campaigns secret fields from feature settings responses', () => {
    const response = redactMerchantFeatureSettingsResponse({
      id: 'settings-1',
      custom_settings: {
        theme: 'compact',
        zohoCampaigns: {
          apiDomain: 'https://campaigns.zoho.eu',
          enabled: true,
          refreshToken: 'secret-refresh-token',
        },
        zoho_campaigns: {
          access_token: 'secret-access-token',
          client_secret: 'secret-client',
          list_key: 'list-key',
          refresh_token: 'secret-refresh-token-2',
        },
      },
    });

    expect(response.custom_settings).toEqual({
      theme: 'compact',
      zohoCampaigns: {
        apiDomain: 'https://campaigns.zoho.eu',
        enabled: true,
      },
      zoho_campaigns: {
        list_key: 'list-key',
      },
    });
  });

  it('preserves stored Zoho Campaigns secrets when unrelated custom settings are written', () => {
    expect(
      preserveZohoCampaignSecretCustomSettings(
        { integrationCardsCollapsed: true },
        {
          zohoCampaigns: {
            enabled: true,
            refreshToken: 'secret-refresh-token',
          },
        }
      )
    ).toEqual({
      integrationCardsCollapsed: true,
      zohoCampaigns: {
        enabled: true,
        refreshToken: 'secret-refresh-token',
      },
    });
  });

  it('preserves existing Zoho fields when partial Zoho settings are updated', () => {
    expect(
      preserveZohoCampaignSecretCustomSettings(
        {
          zohoCampaigns: {
            apiDomain: 'https://campaigns.zoho.in',
            enabled: false,
          },
        },
        {
          zohoCampaigns: {
            enabled: true,
            listKey: 'list-key',
            refreshToken: 'secret-refresh-token',
          },
        }
      )
    ).toEqual({
      zohoCampaigns: {
        apiDomain: 'https://campaigns.zoho.in',
        enabled: false,
        listKey: 'list-key',
        refreshToken: 'secret-refresh-token',
      },
    });
  });

  it('allows explicit Zoho secret rotation', () => {
    expect(
      preserveZohoCampaignSecretCustomSettings(
        {
          zohoCampaigns: {
            refreshToken: 'rotated-refresh-token',
          },
        },
        {
          zohoCampaigns: {
            refreshToken: 'old-refresh-token',
          },
        }
      )
    ).toEqual({
      zohoCampaigns: {
        refreshToken: 'rotated-refresh-token',
      },
    });
  });
});
