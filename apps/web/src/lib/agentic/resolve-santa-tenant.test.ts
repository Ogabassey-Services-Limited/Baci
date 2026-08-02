import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createPublicClient: vi.fn(),
  getConfiguredAgenticMerchantSlug: vi.fn(),
  resolveAgenticMerchantIdentity: vi.fn(),
}));

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: mocks.createPublicClient,
}));
vi.mock('./merchant-context', () => ({
  getConfiguredAgenticMerchantSlug: mocks.getConfiguredAgenticMerchantSlug,
}));
vi.mock('./agentic-merchant-id', () => ({
  resolveAgenticMerchantIdentity: mocks.resolveAgenticMerchantIdentity,
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
  });

  it('resolves the tenant through the publication-gated public client', async () => {
    await expect(resolveSantaTenant()).resolves.toEqual({
      id: 'merchant-1',
      slug: 'winter-store',
      businessName: 'Winter Store',
    });

    expect(mocks.createPublicClient).toHaveBeenCalledWith({
      clientInfo: 'baci-santa-tenant-resolve',
      timeoutMs: 4000,
    });
    expect(mocks.resolveAgenticMerchantIdentity).toHaveBeenCalledWith({
      kind: 'public',
    });
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
});
