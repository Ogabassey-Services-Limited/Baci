import { describe, expect, it, vi } from 'vitest';
import { upsertOnboardingMerchant } from './upsert-onboarding-merchant';

describe('upsertOnboardingMerchant', () => {
  it('creates a web merchant with the authenticated owner and generated slug', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'merchant-1', slug: 'baci-food' },
      error: null,
    });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single }),
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
        insert,
      }),
      rpc: vi.fn().mockResolvedValue({ data: 'baci-food', error: null }),
    };

    const result = await upsertOnboardingMerchant({
      supabase: supabase as never,
      user: { id: 'user-1' } as never,
      email: 'merchant@example.com',
      businessName: 'Baci Food',
      businessType: 'food',
      country: 'NG',
      logoUrl: 'https://example.com/logo.png',
      brandColors: null,
      brandColorsParsed: false,
    });

    expect(result).toMatchObject({
      status: 'saved',
      merchant: { id: 'merchant-1' },
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        signup_source: 'web',
        slug: 'baci-food',
      })
    );
  });
});
