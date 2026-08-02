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

  it('fails closed before slug RPC or writes when the owner-scoped lookup fails', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'RLS transient failure' },
    });
    const insert = vi.fn();
    const rpc = vi.fn();
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
        insert,
      }),
      rpc,
    };

    await expect(
      upsertOnboardingMerchant({
        supabase: supabase as never,
        user: { id: 'user-1' } as never,
        email: 'merchant@example.com',
        businessName: 'Baci Food',
        businessType: 'food',
        country: 'NG',
        brandColors: null,
        brandColorsParsed: false,
      })
    ).rejects.toThrow('Could not load your store setup. Please try again.');
    expect(rpc).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([
    null,
    '   ',
  ])('uses a legacy-neutral type for a completed merchant with persisted type %j', async (persistedBusinessType) => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'merchant-1',
        business_name: 'Persisted Store',
        business_type: persistedBusinessType,
        slug: 'persisted-store',
      },
      error: null,
    });
    const rpc = vi.fn();
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      }),
      rpc,
    };

    const result = await upsertOnboardingMerchant({
      supabase: supabase as never,
      user: { id: 'user-1' } as never,
      email: 'merchant@example.com',
      businessName: 'Conflicting Submission',
      businessType: 'fashion',
      country: 'NG',
      brandColors: null,
      brandColorsParsed: false,
    });

    expect(result).toMatchObject({
      status: 'completed',
      businessName: 'Persisted Store',
      businessType: 'general',
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
