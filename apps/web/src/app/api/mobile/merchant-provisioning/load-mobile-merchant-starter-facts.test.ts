import { describe, expect, it, vi } from 'vitest';
import { loadMobileMerchantStarterFacts } from './load-mobile-merchant-starter-facts';

function createClient(result: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const ownerEq = vi.fn().mockReturnValue({ maybeSingle });
  const merchantEq = vi.fn().mockReturnValue({ eq: ownerEq });
  const select = vi.fn().mockReturnValue({ eq: merchantEq });
  const from = vi.fn().mockReturnValue({ select });
  return { from, select, merchantEq, ownerEq };
}

describe('loadMobileMerchantStarterFacts', () => {
  it('loads the exact tenant-scoped persisted facts with an explicit projection', async () => {
    const client = createClient({
      data: {
        id: 'merchant-1',
        business_name: 'Persisted Store',
        business_type: 'technology',
        slug: 'persisted-store',
        logo_url: 'https://cdn.example.com/persisted-logo.png',
        brand_colors: {
          primary: '#112233',
          background: '#ffffff',
          accent: '#445566',
        },
      },
      error: null,
    });

    await expect(
      loadMobileMerchantStarterFacts({
        supabase: client as never,
        merchantId: 'merchant-1',
        ownerUserId: 'user-1',
      })
    ).resolves.toEqual({
      merchantId: 'merchant-1',
      merchantSlug: 'persisted-store',
      businessName: 'Persisted Store',
      businessType: 'technology',
      merchantLogoUrl: 'https://cdn.example.com/persisted-logo.png',
      brandColors: {
        primary: '#112233',
        background: '#ffffff',
        accent: '#445566',
      },
    });
    expect(client.select).toHaveBeenCalledWith(
      'id, business_name, business_type, slug, logo_url, brand_colors'
    );
    expect(client.merchantEq).toHaveBeenCalledWith('id', 'merchant-1');
    expect(client.ownerEq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('fails closed when the tenant-scoped fact read errors or is incomplete', async () => {
    const client = createClient({
      data: null,
      error: { message: 'RLS error' },
    });

    await expect(
      loadMobileMerchantStarterFacts({
        supabase: client as never,
        merchantId: 'merchant-1',
        ownerUserId: 'user-1',
      })
    ).rejects.toThrow('Could not load persisted store setup.');
  });
});
