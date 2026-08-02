import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

// Import after mocks are set up
const { fetchMerchantData } = await import('@/hooks/useMerchant');

describe('fetchMerchantData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the RPC merchant context when it validates', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        merchant: {
          id: 'merchant-1',
          user_id: 'user-1',
          email: 'merchant@example.com',
          business_name: 'Baci Test',
          slug: 'baci-test',
          logo_url: null,
          favicon_png_192_url: null,
          is_published: false,
          phone: null,
          plan_expires_at: '2026-12-31T23:59:59.000Z',
          plan_tier: 'pro',
          premium_features: ['custom_domain'],
          vat_registration_status: 'not_registered',
          vat_rate: null,
          payout_currency: null,
          country: null,
          bank_code: null,
          bank_name: null,
          bank_account_number: null,
          bank_account_name: null,
          paystack_subaccount_code: null,
          nin: null,
          bvn: null,
          cac_rc_number: null,
          tax_identification_number: null,
          legal_entity_name: null,
          support_email: null,
          support_phone: null,
          business_address: null,
          social_media: {},
          google_analytics_id: null,
          facebook_pixel_id: null,
          tiktok_pixel_id: null,
          snapchat_pixel_id: null,
          twitter_pixel_id: null,
          hero_slides: [],
          brand_colors: {
            primary: '#000000',
            background: '#ffffff',
            accent: '#f59e0b',
          },
        },
        primaryDomain: {
          id: 'domain-1',
          domain: 'baci.usebaci.com',
          domain_type: 'subdomain',
          is_primary: true,
          status: 'active',
        },
      },
      error: null,
    });

    const result = await fetchMerchantData('user-1');

    expect(result.merchant?.id).toBe('merchant-1');
    expect(result.merchant?.plan_expires_at).toBe('2026-12-31T23:59:59.000Z');
    expect(result.merchant?.plan_tier).toBe('pro');
    expect(result.merchant?.premium_features).toEqual(['custom_domain']);
    expect(result.primaryDomain?.domain).toBe('baci.usebaci.com');
    expect(result.resolvedForUserId).toBe('user-1');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('throws when the RPC returns an error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'JWT missing' },
    });

    await expect(fetchMerchantData('user-1')).rejects.toThrow('JWT missing');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
