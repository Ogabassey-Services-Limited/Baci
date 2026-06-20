import { describe, expect, it, vi } from 'vitest';
import { resolveStorefrontAuthMerchant } from './resolve-storefront-auth-merchant';

describe('resolveStorefrontAuthMerchant', () => {
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
