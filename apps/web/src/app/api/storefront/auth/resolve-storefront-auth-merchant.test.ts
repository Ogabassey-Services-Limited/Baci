import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentSlugForAlias } from '@/lib/slug-alias-cache';
import { resolveStorefrontAuthMerchant } from './resolve-storefront-auth-merchant';

vi.mock('@/lib/slug-alias-cache', () => ({
  getCurrentSlugForAlias: vi.fn(),
}));

describe('resolveStorefrontAuthMerchant', () => {
  beforeEach(() => {
    // Default: not a retired alias (so RPC-miss paths return null as before).
    vi.mocked(getCurrentSlugForAlias).mockResolvedValue(null);
  });

  it('falls back to the alias table for a retired slug and retries with the current slug', async () => {
    vi.mocked(getCurrentSlugForAlias).mockResolvedValue('zorvexa');
    const rpc = vi
      .fn()
      .mockImplementation((_fn, args: { p_identifier: string }) =>
        args.p_identifier === 'zorvexa'
          ? Promise.resolve({
              data: [
                {
                  business_name: 'Zorvexa',
                  custom_domain: null,
                  id: 'merchant-1',
                  is_published: true,
                  slug: 'zorvexa',
                },
              ],
              error: null,
            })
          : Promise.resolve({ data: [], error: null })
      );

    const merchant = await resolveStorefrontAuthMerchant({ rpc }, 'yodhashop');

    expect(merchant?.slug).toBe('zorvexa');
    expect(rpc).toHaveBeenCalledWith('resolve_storefront_auth_merchant', {
      p_identifier: 'yodhashop',
    });
    expect(rpc).toHaveBeenCalledWith('resolve_storefront_auth_merchant', {
      p_identifier: 'zorvexa',
    });
  });

  it('resolves a retired slug that is now RESERVED via the alias table', async () => {
    // A store used 'staff' before it was reserved, then renamed to 'zorvexa'.
    // 'staff' is no longer a valid merchant identifier, but an OTP/session request
    // from a still-open staff.usebaci.com tab must still resolve the current store
    // instead of dead-ending at "Store not found".
    vi.mocked(getCurrentSlugForAlias).mockResolvedValue('zorvexa');
    const rpc = vi
      .fn()
      .mockImplementation((_fn, args: { p_identifier: string }) =>
        args.p_identifier === 'zorvexa'
          ? Promise.resolve({
              data: [
                {
                  business_name: 'Zorvexa',
                  custom_domain: null,
                  id: 'merchant-1',
                  is_published: true,
                  slug: 'zorvexa',
                },
              ],
              error: null,
            })
          : Promise.resolve({ data: [], error: null })
      );

    const merchant = await resolveStorefrontAuthMerchant({ rpc }, 'staff');

    expect(merchant?.slug).toBe('zorvexa');
    // Never queried the RPC for the reserved slug itself — only the resolved current one.
    expect(rpc).not.toHaveBeenCalledWith('resolve_storefront_auth_merchant', {
      p_identifier: 'staff',
    });
    expect(rpc).toHaveBeenCalledWith('resolve_storefront_auth_merchant', {
      p_identifier: 'zorvexa',
    });
  });

  it('uses the uncached public auth merchant RPC with a normalized identifier', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          business_name: 'Ogabassey',
          custom_domain: 'ogabassey.com',
          id: 'merchant-1',
          is_published: true,
          slug: 'ogabassey',
        },
      ],
      error: null,
    });

    const merchant = await resolveStorefrontAuthMerchant(
      { rpc },
      ' Ogabassey.COM '
    );

    expect(rpc).toHaveBeenCalledWith('resolve_storefront_auth_merchant', {
      p_identifier: 'ogabassey.com',
    });
    expect(merchant).toEqual({
      business_name: 'Ogabassey',
      custom_domain: 'ogabassey.com',
      id: 'merchant-1',
      is_published: true,
      slug: 'ogabassey',
    });
  });

  it('returns null when the RPC returns no merchant rows', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });

    const merchant = await resolveStorefrontAuthMerchant({ rpc }, 'missing');

    expect(merchant).toBeNull();
  });

  it('throws when the RPC fails', async () => {
    const rpcError = { message: 'permission denied' };
    const rpc = vi.fn().mockResolvedValue({ data: null, error: rpcError });

    await expect(
      resolveStorefrontAuthMerchant({ rpc }, 'ogabassey')
    ).rejects.toThrow('Failed to resolve storefront auth merchant');
  });

  it('returns null for unexpected row shapes', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: 'merchant-1', slug: 'ogabassey' }],
      error: null,
    });

    const merchant = await resolveStorefrontAuthMerchant({ rpc }, 'ogabassey');

    expect(merchant).toBeNull();
  });

  it('returns null without calling the RPC for invalid merchant identifiers', async () => {
    const rpc = vi.fn();

    const reserved = await resolveStorefrontAuthMerchant({ rpc }, 'api');
    const overlong = await resolveStorefrontAuthMerchant(
      { rpc },
      'a'.repeat(255)
    );

    expect(reserved).toBeNull();
    expect(overlong).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns null without calling the RPC when the identifier is blank', async () => {
    const rpc = vi.fn();

    const merchant = await resolveStorefrontAuthMerchant({ rpc }, '   ');

    expect(merchant).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('keeps null custom domains as null', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          business_name: 'Ogabassey',
          custom_domain: null,
          id: 'merchant-1',
          is_published: true,
          slug: 'ogabassey',
        },
      ],
      error: null,
    });

    const merchant = await resolveStorefrontAuthMerchant({ rpc }, 'ogabassey');

    expect(merchant?.custom_domain).toBeNull();
  });

  it('coerces non-string custom domains to null', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          business_name: 'Ogabassey',
          custom_domain: 123,
          id: 'merchant-1',
          is_published: true,
          slug: 'ogabassey',
        },
      ],
      error: null,
    });

    const merchant = await resolveStorefrontAuthMerchant({ rpc }, 'ogabassey');

    expect(merchant?.custom_domain).toBeNull();
  });
});
