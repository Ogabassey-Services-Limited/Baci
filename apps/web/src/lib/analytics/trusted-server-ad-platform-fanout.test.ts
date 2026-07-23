import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventPipelineServiceRoleTestClient } from '@/lib/events/event-pipeline-service-role-test-client';
import type { Database } from '@/types/supabase';

const mocks = vi.hoisted(() => ({ fetchConfig: vi.fn(), send: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('./fetch-analytics-platform-config', () => ({
  fetchAnalyticsPlatformConfig: mocks.fetchConfig,
}));
vi.mock('./send-configured-ad-platforms', () => ({
  sendConfiguredAdPlatforms: mocks.send,
}));

import { trustedServerAdPlatformFanout } from './trusted-server-ad-platform-fanout';

const event = {
  custom_data: {},
  event_id: 'event-1',
  event_type: 'purchase',
  merchant_id: 'merchant-1',
  source: 'server' as const,
  user_data: {},
};

const client = () =>
  createEventPipelineServiceRoleTestClient(
    vi.fn<typeof globalThis.fetch>(async () => Response.json([]))
  );

describe('trustedServerAdPlatformFanout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects request identity mismatch before configuration or provider I/O', async () => {
    await expect(
      trustedServerAdPlatformFanout(client(), 'merchant-2', event)
    ).resolves.toEqual({});
    expect(mocks.fetchConfig).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('loads configuration exactly once and passes the same immutable value', async () => {
    const config = Object.freeze({
      facebook_capi_token: 'token',
      facebook_pixel_id: 'pixel',
      ga4_api_secret: null,
      google_analytics_id: null,
      offline_conversions_enabled: true,
      snapchat_capi_token: null,
      snapchat_pixel_id: null,
      tiktok_access_token: null,
      tiktok_pixel_id: null,
    });
    mocks.fetchConfig.mockResolvedValue(config);
    mocks.send.mockResolvedValue({ facebook: { success: true } });

    await expect(
      trustedServerAdPlatformFanout(client(), 'merchant-1', event)
    ).resolves.toEqual({ facebook: { success: true } });
    expect(mocks.fetchConfig).toHaveBeenCalledTimes(1);
    expect(mocks.fetchConfig).toHaveBeenCalledWith(
      expect.any(Object),
      'merchant-1'
    );
    expect(mocks.send).toHaveBeenCalledWith(config, event, undefined);
  });

  it('requires the branded service-role client at compile time', () => {
    const ordinary = {} as SupabaseClient<Database>;
    // @ts-expect-error ordinary clients cannot enter the trusted wrapper
    const rejected: Parameters<typeof trustedServerAdPlatformFanout>[0] =
      ordinary;
    expect(rejected).toBe(ordinary);
  });
});
