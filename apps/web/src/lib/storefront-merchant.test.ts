import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMerchantByIdentifier = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('resolveStorefrontMerchantFromRequest', () => {
  it('resolves a storefront host to the first matching merchant candidate', async () => {
    mockGetMerchantByIdentifier.mockImplementation((identifier) => {
      if (identifier === 'ogabassey.com') {
        return Promise.resolve({
          id: 'merchant-1',
          slug: 'ogabassey',
          business_name: 'Ogabassey',
        });
      }

      return Promise.resolve(null);
    });
    const { resolveStorefrontMerchantFromRequest } = await import(
      '@/lib/storefront-merchant'
    );

    const result = await resolveStorefrontMerchantFromRequest({
      request: new Request(
        'https://www.ogabassey.com/feeds/google-merchant.xml'
      ),
      rootDomain: 'usebaci.com',
      notFoundError: 'Storefront not found',
      lookupError: 'Lookup failed',
    });

    expect(result).toMatchObject({
      success: true,
      merchant: {
        id: 'merchant-1',
        slug: 'ogabassey',
      },
      identifier: 'ogabassey.com',
    });
    expect(mockGetMerchantByIdentifier).toHaveBeenCalledWith('ogabassey.com');
    expect(mockGetMerchantByIdentifier).not.toHaveBeenCalledWith(
      'www.ogabassey.com'
    );
  });

  it('falls back to the exact www custom-domain candidate when non-www misses', async () => {
    mockGetMerchantByIdentifier.mockImplementation((identifier) => {
      if (identifier === 'www.ogabassey.com') {
        return Promise.resolve({
          id: 'merchant-1',
          slug: 'ogabassey',
          business_name: 'Ogabassey',
        });
      }

      return Promise.resolve(null);
    });
    const { resolveStorefrontMerchantFromRequest } = await import(
      '@/lib/storefront-merchant'
    );

    const result = await resolveStorefrontMerchantFromRequest({
      request: new Request(
        'https://www.ogabassey.com/feeds/google-merchant.xml'
      ),
      rootDomain: 'usebaci.com',
      notFoundError: 'Storefront not found',
      lookupError: 'Lookup failed',
    });

    expect(result).toMatchObject({
      success: true,
      merchant: {
        id: 'merchant-1',
        slug: 'ogabassey',
      },
      identifier: 'www.ogabassey.com',
    });
    expect(mockGetMerchantByIdentifier).toHaveBeenNthCalledWith(
      1,
      'ogabassey.com'
    );
    expect(mockGetMerchantByIdentifier).toHaveBeenNthCalledWith(
      2,
      'www.ogabassey.com'
    );
  });

  it('returns 404 when the request is not storefront-scoped', async () => {
    const { resolveStorefrontMerchantFromRequest } = await import(
      '@/lib/storefront-merchant'
    );

    const result = await resolveStorefrontMerchantFromRequest({
      request: new Request('https://usebaci.com/feeds/google-merchant.xml'),
      rootDomain: 'usebaci.com',
      notFoundError: 'Storefront not found',
      lookupError: 'Lookup failed',
    });

    expect(result).toEqual({
      success: false,
      status: 404,
      error: 'Storefront not found',
    });
    expect(mockGetMerchantByIdentifier).not.toHaveBeenCalled();
  });

  it('returns 404 when no merchant matches a storefront host', async () => {
    mockGetMerchantByIdentifier.mockResolvedValue(null);
    const { resolveStorefrontMerchantFromRequest } = await import(
      '@/lib/storefront-merchant'
    );

    const result = await resolveStorefrontMerchantFromRequest({
      request: new Request('https://ogabassey.com/feeds/google-merchant.xml'),
      rootDomain: 'usebaci.com',
      notFoundError: 'Storefront not found',
      lookupError: 'Lookup failed',
    });

    expect(result).toEqual({
      success: false,
      status: 404,
      error: 'Storefront not found',
    });
    expect(mockGetMerchantByIdentifier).toHaveBeenCalledWith('ogabassey.com');
  });

  it('returns 400 when a storefront identifier fails route validation', async () => {
    const { resolveStorefrontMerchantFromRequest } = await import(
      '@/lib/storefront-merchant'
    );

    const result = await resolveStorefrontMerchantFromRequest({
      request: new Request('https://usebaci.com/feeds/google-merchant.xml', {
        headers: { host: '<script>' },
      }),
      rootDomain: 'usebaci.com',
      notFoundError: 'Storefront not found',
      lookupError: 'Lookup failed',
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      error: 'Invalid storefront host',
    });
    expect(mockGetMerchantByIdentifier).not.toHaveBeenCalled();
  });

  it('returns 500 when merchant lookup throws', async () => {
    const failure = new Error('database unavailable');
    mockGetMerchantByIdentifier.mockRejectedValue(failure);
    const { resolveStorefrontMerchantFromRequest } = await import(
      '@/lib/storefront-merchant'
    );

    const result = await resolveStorefrontMerchantFromRequest({
      request: new Request('https://ogabassey.com/feeds/google-merchant.xml'),
      rootDomain: 'usebaci.com',
      notFoundError: 'Storefront not found',
      lookupError: 'Lookup failed',
    });

    expect(result).toEqual({
      success: false,
      status: 500,
      error: 'Lookup failed',
      cause: failure,
    });
  });
});
