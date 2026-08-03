import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAgenticMerchantIdentity } from './agentic-merchant-identity';

const MERCHANT_ID = '3bc72679-c0f7-4db4-9054-6a4a4a95a498';

function createClient(result: {
  data: {
    country: string | null;
    id: string;
    payout_currency: string | null;
    slug: string;
    business_name: string | null;
  } | null;
  error?: unknown;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: result.data,
    error: result.error ?? null,
  });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return {
    client: { from } as unknown as Pick<SupabaseClient, 'from'>,
    select,
    eq,
  };
}

describe('resolveAgenticMerchantIdentity', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves the public tenant identity in one publication-gated lookup', async () => {
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'winter-store');
    const { client, select, eq } = createClient({
      data: {
        country: 'NG',
        id: MERCHANT_ID,
        payout_currency: 'NGN',
        slug: 'winter-store',
        business_name: 'Winter Store',
      },
    });

    await expect(resolveAgenticMerchantIdentity(client)).resolves.toEqual({
      currency: { code: 'NGN', locale: 'en-NG', symbol: '₦' },
      id: MERCHANT_ID,
      slug: 'winter-store',
      businessName: 'Winter Store',
    });

    expect(select).toHaveBeenCalledWith(
      'id, slug, business_name, country, payout_currency'
    );
    expect(eq).toHaveBeenCalledWith('slug', 'winter-store');
  });

  it('fails closed when the public identity lookup errors', async () => {
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'winter-store');
    const { client } = createClient({
      data: null,
      error: { message: 'permission denied' },
    });

    await expect(resolveAgenticMerchantIdentity(client)).resolves.toBeNull();
  });
});
