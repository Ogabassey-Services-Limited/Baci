import type { SupabaseClient, User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { MobileMerchantProvisioningInput } from '@/schemas/mobile-merchant-provisioning';
import {
  type MobileProvisioningError,
  provisionAuthenticatedMerchant,
} from './provision-authenticated-merchant';

const input: MobileMerchantProvisioningInput = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  phone: '+2348012345678',
  businessName: '  Analytical   Engines  ',
  businessType: 'other',
  otherBusinessType: 'Software',
  country: 'NG',
  slug: 'analytical-engines',
  slugIsCustom: true,
  logoUrl: 'https://cdn.usebaci.com/logo.png',
  brandColors: {
    primary: '#111111',
    background: '#ffffff',
    accent: '#f59e0b',
  },
};

describe('provisionAuthenticatedMerchant', () => {
  it('calls the owner-scoped RPC once without caller identity or domain authority', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          merchant_id: 'merchant-1',
          merchant_slug: 'analytical-engines',
          created: true,
        },
      ],
      error: null,
    });

    await expect(
      provisionAuthenticatedMerchant({
        supabase: { rpc } as unknown as SupabaseClient,
        user: { id: 'user-1', email: 'ada@example.com' } as User,
        input,
        platform: 'ios',
      })
    ).resolves.toEqual({
      merchantId: 'merchant-1',
      merchantSlug: 'analytical-engines',
      created: true,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('provision_mobile_merchant_v2', {
      p_first_name: 'Ada',
      p_last_name: 'Lovelace',
      p_phone: '+2348012345678',
      p_business_name: 'Analytical Engines',
      p_business_type: 'other',
      p_other_business_type: 'Software',
      p_country: 'NG',
      p_slug: 'analytical-engines',
      p_slug_is_custom: true,
      p_logo_url: 'https://cdn.usebaci.com/logo.png',
      p_brand_colors: input.brandColors,
      p_signup_source: 'ios',
    });
    const rpcArgs = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(rpcArgs).not.toHaveProperty('user_id');
    expect(rpcArgs).not.toHaveProperty('email');
    expect(rpcArgs).not.toHaveProperty('merchant_id');
    expect(rpcArgs).not.toHaveProperty('domain');
    expect(rpcArgs).not.toHaveProperty('payout_currency');
    expect(rpcArgs).not.toHaveProperty('role');
  });

  it('preserves the PostgreSQL code without exposing raw details in a response', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: 'PT409',
        message: 'slug_unavailable internal details',
      },
    });

    await expect(
      provisionAuthenticatedMerchant({
        supabase: { rpc } as unknown as SupabaseClient,
        user: { id: 'user-1' } as User,
        input,
        platform: 'android',
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<MobileProvisioningError>>({
        name: 'MobileProvisioningError',
        pgCode: 'PT409',
      })
    );
  });

  it('fails closed when the RPC returns no result row', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });

    await expect(
      provisionAuthenticatedMerchant({
        supabase: { rpc } as unknown as SupabaseClient,
        user: { id: 'user-1' } as User,
        input,
        platform: 'ios',
      })
    ).rejects.toMatchObject({
      name: 'MobileProvisioningError',
      pgCode: null,
    });
  });
});
