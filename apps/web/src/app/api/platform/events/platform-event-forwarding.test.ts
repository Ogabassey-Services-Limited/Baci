import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  from: vi.fn(),
  sendFacebook: vi.fn(),
  sendGa4: vi.fn(),
  single: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => {
    throw new Error('Use the admin client factory for platform settings');
  },
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock('@/lib/facebook-capi', () => ({
  sendFacebookCAPIEvent: mocks.sendFacebook,
}));
vi.mock('@/lib/ga4-measurement-protocol', () => ({
  generateClientId: () => 'client-1',
  sendGA4Event: mocks.sendGa4,
}));

import { forwardToPlatformAnalytics } from './platform-event-forwarding';

const request = new NextRequest('https://usebaci.com/api/platform/events');

describe('forwardToPlatformAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAdminClient.mockReturnValue({ from: mocks.from });
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      single: mocks.single,
    });
    mocks.single.mockResolvedValue({
      data: {
        facebook_capi_token: 'token',
        facebook_pixel_id: 'pixel',
        ga4_api_secret: 'secret',
        google_analytics_id: 'G-TEST',
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards a platform purchase with its validated currency and page URL', async () => {
    await forwardToPlatformAnalytics({
      eventData: { currency: 'GHS', value: 15_000 },
      eventId: 'platform-event-1',
      eventType: 'platform_purchase',
      pageUrl: 'https://usebaci.com/pricing',
      request,
    });

    expect(mocks.createAdminClient).toHaveBeenCalledWith('event-pipeline');
    expect(mocks.sendGa4).toHaveBeenCalledWith(
      'G-TEST',
      'secret',
      'purchase',
      expect.any(Object),
      expect.objectContaining({
        currency: 'GHS',
        page_location: 'https://usebaci.com/pricing',
        value: 15_000,
      })
    );
    expect(mocks.sendFacebook).toHaveBeenCalledWith(
      'pixel',
      'token',
      'Purchase',
      expect.any(Object),
      { currency: 'GHS', value: 15_000 },
      'https://usebaci.com/pricing',
      'platform-event-1'
    );
  });

  it('logs a settings-query error without attempting provider delivery', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const sentinel = 'platform-settings-sensitive-sentinel';
    mocks.single.mockResolvedValue({
      data: null,
      error: { message: sentinel },
    });

    await expect(
      forwardToPlatformAnalytics({
        eventData: undefined,
        eventId: 'platform-event-query-error',
        eventType: 'landing_page_view',
        request,
      })
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      'Failed to load platform analytics settings'
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(sentinel);
    expect(mocks.sendGa4).not.toHaveBeenCalled();
    expect(mocks.sendFacebook).not.toHaveBeenCalled();
  });

  it('contains a rejected settings query without logging its value', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const sentinel = 'privileged-query-credential-sentinel';
    mocks.single.mockRejectedValue(new Error(sentinel));

    await expect(
      forwardToPlatformAnalytics({
        eventData: undefined,
        eventId: 'platform-event-rejected-query',
        eventType: 'landing_page_view',
        request,
      })
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      'Failed to load platform analytics settings'
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(sentinel);
    expect(mocks.sendGa4).not.toHaveBeenCalled();
    expect(mocks.sendFacebook).not.toHaveBeenCalled();
  });

  it('continues after individual provider failures', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ga4Sentinel = 'ga4_api_secret=credential-sentinel';
    const facebookSentinel = 'facebook_capi_token=credential-sentinel';
    mocks.sendGa4.mockRejectedValue(new Error(ga4Sentinel));
    mocks.sendFacebook.mockRejectedValue(new Error(facebookSentinel));

    await expect(
      forwardToPlatformAnalytics({
        eventData: undefined,
        eventId: 'platform-event-provider-error',
        eventType: 'landing_page_view',
        request,
      })
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith('GA4 forward failed');
    expect(warn).toHaveBeenCalledWith('Facebook CAPI forward failed');
    expect(JSON.stringify(warn.mock.calls)).not.toContain(ga4Sentinel);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(facebookSentinel);
  });

  it('sends GA4 but skips Facebook for a platform event without a Facebook map', async () => {
    await forwardToPlatformAnalytics({
      eventData: undefined,
      eventId: 'platform-event-pricing',
      eventType: 'pricing_page_view',
      request,
    });

    expect(mocks.sendGa4).toHaveBeenCalledWith(
      'G-TEST',
      'secret',
      'page_view',
      expect.any(Object),
      expect.any(Object)
    );
    expect(mocks.sendFacebook).not.toHaveBeenCalled();
  });
});
