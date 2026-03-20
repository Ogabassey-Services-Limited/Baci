import { describe, expect, it } from 'vitest';
import type { PlatformSettingsResponse } from '@/app/api/admin/settings/route';
import {
  buildPlatformSettingsUpdatePayload,
  EMPTY_PLATFORM_SETTINGS_SECRET_INPUTS,
} from './settings-payload';

const settingsFixture: PlatformSettingsResponse = {
  id: 'settings-1',
  google_analytics_id: 'G-123456',
  facebook_pixel_id: '12345',
  tiktok_pixel_id: null,
  snapchat_pixel_id: null,
  twitter_pixel_id: null,
  platform_fee_percentage: 2.5,
  platform_fee_flat: 100,
  payment_processor_fee_percentage: 1.5,
  payment_processor_fee_flat: 75,
  platform_name: 'Baci',
  platform_logo_url: null,
  support_email: 'support@baci.app',
  support_phone: null,
  enable_merchant_signups: true,
  enable_custom_domains: true,
  enable_analytics_export: false,
  maintenance_mode: false,
  maintenance_message: null,
  created_at: '2026-03-20T00:00:00.000Z',
  updated_at: '2026-03-20T00:00:00.000Z',
  secretStatus: {
    ga4_api_secret: true,
    facebook_capi_token: true,
    tiktok_access_token: false,
    snapchat_capi_token: false,
  },
};

describe('buildPlatformSettingsUpdatePayload', () => {
  it('omits stored secrets when the admin leaves replacement inputs blank', () => {
    const payload = buildPlatformSettingsUpdatePayload(
      settingsFixture,
      EMPTY_PLATFORM_SETTINGS_SECRET_INPUTS
    );

    expect(payload).not.toHaveProperty('ga4_api_secret');
    expect(payload).not.toHaveProperty('facebook_capi_token');
    expect(payload.platform_name).toBe('Baci');
    expect(payload.google_analytics_id).toBe('G-123456');
  });

  it('includes only the replacement secrets the admin typed', () => {
    const payload = buildPlatformSettingsUpdatePayload(settingsFixture, {
      ...EMPTY_PLATFORM_SETTINGS_SECRET_INPUTS,
      ga4_api_secret: 'new-ga4-secret',
      snapchat_capi_token: 'new-snap-secret',
    });

    expect(payload).toMatchObject({
      ga4_api_secret: 'new-ga4-secret',
      snapchat_capi_token: 'new-snap-secret',
      platform_name: 'Baci',
    });
    expect(payload).not.toHaveProperty('facebook_capi_token');
    expect(payload).not.toHaveProperty('tiktok_access_token');
  });
});
