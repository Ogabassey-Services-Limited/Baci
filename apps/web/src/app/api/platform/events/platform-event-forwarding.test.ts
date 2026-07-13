import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  sendFacebook: vi.fn(),
  sendGa4: vi.fn(),
  single: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mocks.from }),
}));
vi.mock('@/lib/facebook-capi', () => ({
  sendFacebookCAPIEvent: mocks.sendFacebook,
}));
vi.mock('@/lib/ga4-measurement-protocol', () => ({
  generateClientId: () => 'client-1',
  sendGA4Event: mocks.sendGa4,
}));

import { forwardToPlatformAnalytics } from './platform-event-forwarding';

describe('forwardToPlatformAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    });
  });

  it('forwards a platform purchase with its validated currency and page URL', async () => {
    await forwardToPlatformAnalytics({
      eventData: { currency: 'GHS', value: 15_000 },
      eventId: 'platform-event-1',
      eventType: 'platform_purchase',
      pageUrl: 'https://usebaci.com/pricing',
      request: new NextRequest('https://usebaci.com/api/platform/events'),
    });

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
});
