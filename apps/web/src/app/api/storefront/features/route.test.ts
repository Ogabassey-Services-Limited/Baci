import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [] })),
}));

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
}));

mockSelect.mockReturnValue({
  eq: mockEq,
});

mockEq.mockReturnValue({
  single: mockSingle,
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

// ---- Helpers ----

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
  });
}

// ---- Tests ----

describe('GET /api/storefront/features', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it('returns 400 when merchantId and slug are missing', async () => {
    const { GET } = await import('./route');
    const req = makeRequest('http://localhost:3000/api/storefront/features');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('merchantId or slug is required');
  });

  it('returns 404 when merchant by slug is not found', async () => {
    const { GET } = await import('./route');
    const req = makeRequest(
      'http://localhost:3000/api/storefront/features?slug=missing-store'
    );

    // Mock merchant lookup returning null
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    const res = await GET(req);

    expect(mockFrom).toHaveBeenCalledWith('merchants');
    expect(mockEq).toHaveBeenCalledWith('slug', 'missing-store');

    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.error).toBe('Store not found');
  });

  it('fetches settings using explicit columns', async () => {
    const { GET } = await import('./route');
    const req = makeRequest(
      'http://localhost:3000/api/storefront/features?merchantId=123'
    );

    // Mock settings lookup returning data
    mockSingle.mockResolvedValueOnce({
      data: { id: 'settings-1', merchant_id: '123' },
      error: null,
    });

    const res = await GET(req);

    expect(mockFrom).toHaveBeenCalledWith('merchant_feature_settings');

    const EXPECTED_COLUMNS = [
      'loyalty_enabled',
      'reviews_enabled',
      'wishlist_enabled',
      'order_tracking_enabled',
      'discount_codes_enabled',
      'guest_checkout_enabled',
      'paystack_enabled',
      'korapay_enabled',
      'pay_on_delivery_enabled',
      'credit_direct_enabled',
      'credpal_enabled',
      'credit_direct_min_amount',
      'credit_direct_max_amount',
      'preferred_local_gateway',
      'preferred_international_gateway',
      'shipping_providers',
      'free_shipping_threshold',
      'checkout_collect_phone',
      'checkout_require_account',
      'checkout_show_order_notes',
      'about_page_enabled',
      'contact_page_enabled',
      'faq_page_enabled',
      'privacy_page_enabled',
      'terms_page_enabled',
      'rewards_page_enabled',
      'show_recent_purchases',
      'show_stock_levels',
      'low_stock_threshold',
      'google_analytics_id',
      'facebook_pixel_id',
      'tiktok_pixel_id',
      'vtu_enabled',
      'vtu_airtime_enabled',
      'vtu_data_enabled',
      'vtu_checkout_addon_enabled',
      'vtu_checkout_addon_amounts',
      'vtu_loyalty_reward_enabled',
      'blog_enabled',
      'auto_blog_enabled',
    ].join(', ');

    expect(mockSelect).toHaveBeenCalledWith(EXPECTED_COLUMNS);

    expect(res.status).toBe(200);
  });

  it('handles DB errors gracefully', async () => {
    const { GET } = await import('./route');
    const req = makeRequest(
      'http://localhost:3000/api/storefront/features?merchantId=123'
    );

    // Mock settings lookup returning error
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB Error' },
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // suppress console.error
    });

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    // Should return defaults
    expect(json.loyaltyEnabled).toBe(false);

    consoleSpy.mockRestore();
  });
});
