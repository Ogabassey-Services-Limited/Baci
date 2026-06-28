import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateClient,
  mockFacebookAddToCart,
  mockFacebookEvent,
  mockLoggerInfo,
  mockLoggerWarn,
  mockSnapchatAddToCart,
  mockSnapchatEvent,
  mockTikTokAddToCart,
  mockTikTokSearch,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockFacebookAddToCart: vi.fn(),
  mockFacebookEvent: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockSnapchatAddToCart: vi.fn(),
  mockSnapchatEvent: vi.fn(),
  mockTikTokAddToCart: vi.fn(),
  mockTikTokSearch: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/lib/facebook-capi', () => ({
  facebookCAPI: {
    addToCart: (...args: unknown[]) => mockFacebookAddToCart(...args),
  },
  sendFacebookCAPIEvent: (...args: unknown[]) => mockFacebookEvent(...args),
}));

vi.mock('@/lib/snapchat-capi', () => ({
  sendSnapchatEvent: (...args: unknown[]) => mockSnapchatEvent(...args),
  snapchatCAPI: {
    addToCart: (...args: unknown[]) => mockSnapchatAddToCart(...args),
  },
}));

vi.mock('@/lib/tiktok-events-api', () => ({
  tiktokEventsAPI: {
    addToCart: (...args: unknown[]) => mockTikTokAddToCart(...args),
    search: (...args: unknown[]) => mockTikTokSearch(...args),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
  },
}));

import { sendToAdPlatforms } from './send-to-ad-platforms';

function createQuery(table: string) {
  const query = {
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(() => {
      if (table === 'merchants') {
        return {
          data: {
            offline_conversions_enabled: true,
            facebook_pixel_id: null,
            facebook_capi_token: null,
            tiktok_pixel_id: null,
            tiktok_access_token: null,
            google_analytics_id: null,
            ga4_api_secret: null,
            plan_expires_at: null,
            plan_tier: 'pro',
            premium_features: [],
            snapchat_pixel_id: null,
            snapchat_capi_token: null,
          },
          error: null,
        };
      }

      return {
        data: {
          facebook_pixel_id: 'fb-pixel',
          facebook_capi_token: 'fb-token',
          tiktok_pixel_id: 'tt-pixel',
          tiktok_access_token: 'tt-token',
          google_analytics_id: null,
          ga4_api_secret: null,
          snapchat_pixel_id: 'snap-pixel',
          snapchat_capi_token: 'snap-token',
        },
        error: null,
      };
    }),
    select: vi.fn(() => query),
  };

  return query;
}

describe('sendToAdPlatforms', () => {
  let from: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    from = vi.fn((table: string) => createQuery(table));
    mockCreateClient.mockReturnValue({ from });
    mockFacebookAddToCart.mockResolvedValue({ success: true });
    mockFacebookEvent.mockResolvedValue({ success: true });
    mockSnapchatAddToCart.mockResolvedValue({ success: true });
    mockSnapchatEvent.mockResolvedValue({ success: true });
    mockTikTokAddToCart.mockResolvedValue({ success: true });
    mockTikTokSearch.mockResolvedValue({ success: true });
  });

  it('uses merchant feature settings credentials for every configured platform', async () => {
    await sendToAdPlatforms({
      merchant_id: 'merchant-1',
      event_id: 'evt-1',
      event_type: 'add_to_cart',
      user_data: {
        email: 'buyer@example.com',
        ip: '203.0.113.10',
        phone: '+2348012345678',
        ua: 'Unit Test Agent',
      },
      custom_data: {
        contents: [
          {
            id: 'sku-1',
            name: 'iPhone 15',
            price: 120_000,
            quantity: 1,
          },
        ],
        currency: 'NGN',
        value: 120_000,
      },
      source: 'mobile_app',
    });

    expect(from).toHaveBeenCalledWith('merchants');
    expect(from).toHaveBeenCalledWith('merchant_feature_settings');
    expect(mockFacebookAddToCart).toHaveBeenCalledWith(
      'fb-pixel',
      'fb-token',
      expect.any(Object),
      'sku-1',
      'iPhone 15',
      120_000,
      'NGN',
      undefined,
      'evt-1'
    );
    expect(mockTikTokAddToCart).toHaveBeenCalledWith(
      'tt-pixel',
      'tt-token',
      expect.any(Object),
      expect.objectContaining({
        contentId: 'sku-1',
        contentName: 'iPhone 15',
        currency: 'NGN',
        value: 120_000,
      }),
      expect.objectContaining({
        eventId: 'evt-1',
      })
    );
    expect(mockSnapchatAddToCart).toHaveBeenCalledWith(
      'snap-pixel',
      'snap-token',
      expect.any(Object),
      'sku-1',
      120_000,
      'NGN',
      'evt-1'
    );
  });

  it('sends TikTok Search with search_string and event_id', async () => {
    await sendToAdPlatforms({
      merchant_id: 'merchant-1',
      event_id: 'evt-search',
      event_type: 'search',
      user_data: {},
      custom_data: {
        search_string: 'iphone',
        url: 'https://ogabassey.com/search?q=iphone',
      },
      source: 'mobile_app',
      targets: ['tiktok'],
    });

    expect(mockTikTokSearch).toHaveBeenCalledWith(
      'tt-pixel',
      'tt-token',
      expect.any(Object),
      'iphone',
      {
        eventId: 'evt-search',
        url: 'https://ogabassey.com/search?q=iphone',
      }
    );
    expect(mockFacebookAddToCart).not.toHaveBeenCalled();
    expect(mockSnapchatAddToCart).not.toHaveBeenCalled();
  });
});
