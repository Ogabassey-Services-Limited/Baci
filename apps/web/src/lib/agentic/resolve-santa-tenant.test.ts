import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createPublicClient: vi.fn(),
  getConfiguredAgenticMerchantSlug: vi.fn(),
  readStorefrontMerchantSnapshot: vi.fn(),
  resolveAgenticMerchantIdentity: vi.fn(),
}));

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: mocks.createPublicClient,
}));
vi.mock('./agentic-merchant-slug', () => ({
  getConfiguredAgenticMerchantSlug: mocks.getConfiguredAgenticMerchantSlug,
}));
vi.mock('./agentic-merchant-identity', () => ({
  resolveAgenticMerchantIdentity: mocks.resolveAgenticMerchantIdentity,
}));
vi.mock('@/lib/storefront-merchant-snapshot', () => ({
  readStorefrontMerchantSnapshot: mocks.readStorefrontMerchantSnapshot,
}));

import { resolveSantaTenant } from './resolve-santa-tenant';

describe('resolveSantaTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPublicClient.mockReturnValue({ kind: 'public' });
    mocks.getConfiguredAgenticMerchantSlug.mockReturnValue('winter-store');
    mocks.resolveAgenticMerchantIdentity.mockResolvedValue({
      id: 'merchant-1',
      slug: 'winter-store',
      businessName: 'Winter Store',
    });
    mocks.readStorefrontMerchantSnapshot.mockResolvedValue({
      status: 'found',
      value: {
        resolution_status: 'found',
        merchant_data: {
          country: 'NG',
          id: 'merchant-1',
          payout_currency: 'NGN',
          slug: 'winter-store',
        },
        custom_domain: null,
        feature_settings: { agentic_checkout_enabled: true },
      },
    });
  });

  it('resolves the tenant through the publication-gated public client', async () => {
    await expect(resolveSantaTenant()).resolves.toEqual({
      id: 'merchant-1',
      slug: 'winter-store',
      businessName: 'Winter Store',
      currency: { code: 'NGN', locale: 'en-NG', symbol: '₦' },
      agenticCheckoutEnabled: true,
    });

    expect(mocks.createPublicClient).toHaveBeenCalledWith({
      clientInfo: 'baci-santa-tenant-resolve',
      timeoutMs: 4000,
    });
    expect(mocks.resolveAgenticMerchantIdentity).toHaveBeenCalledWith({
      kind: 'public',
    });
    expect(mocks.readStorefrontMerchantSnapshot).toHaveBeenCalledWith(
      { kind: 'public' },
      'winter-store'
    );
  });

  it('fails closed when the tenant is not configured', async () => {
    mocks.getConfiguredAgenticMerchantSlug.mockReturnValue(undefined);

    await expect(resolveSantaTenant()).resolves.toBeNull();

    expect(mocks.createPublicClient).not.toHaveBeenCalled();
    expect(mocks.resolveAgenticMerchantIdentity).not.toHaveBeenCalled();
  });

  it('fails closed when the configured tenant is unpublished or missing', async () => {
    mocks.resolveAgenticMerchantIdentity.mockResolvedValue(null);

    await expect(resolveSantaTenant()).resolves.toBeNull();
  });

  it('fails closed when the fresh snapshot no longer finds the tenant', async () => {
    mocks.readStorefrontMerchantSnapshot.mockResolvedValue({
      status: 'not_found',
    });

    await expect(resolveSantaTenant()).resolves.toBeNull();
  });

  it('fails closed when the fresh snapshot identifies another tenant', async () => {
    mocks.readStorefrontMerchantSnapshot.mockResolvedValue({
      status: 'found',
      value: {
        resolution_status: 'found',
        merchant_data: {
          country: 'NG',
          id: 'merchant-2',
          payout_currency: 'NGN',
          slug: 'other-store',
        },
        custom_domain: null,
        feature_settings: { agentic_checkout_enabled: true },
      },
    });

    await expect(resolveSantaTenant()).resolves.toBeNull();
  });

  it('carries the published tenant checkout kill switch into chat tools', async () => {
    mocks.readStorefrontMerchantSnapshot.mockResolvedValue({
      status: 'found',
      value: {
        resolution_status: 'found',
        merchant_data: {
          country: 'NG',
          id: 'merchant-1',
          payout_currency: 'NGN',
          slug: 'winter-store',
        },
        custom_domain: null,
        feature_settings: { agentic_checkout_enabled: false },
      },
    });

    await expect(resolveSantaTenant()).resolves.toMatchObject({
      agenticCheckoutEnabled: false,
    });
  });

  it('fails closed for checkout tools when the feature snapshot is unavailable', async () => {
    mocks.readStorefrontMerchantSnapshot.mockResolvedValue({
      status: 'unavailable',
      error: { kind: 'timeout' },
    });

    await expect(resolveSantaTenant()).resolves.toMatchObject({
      agenticCheckoutEnabled: false,
    });
  });
});
