import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createPublicClient: vi.fn(),
  getConfiguredAgenticMerchantSlug: vi.fn(),
  resolveAgenticMerchantId: vi.fn(),
}));

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: mocks.createPublicClient,
}));
vi.mock('./merchant-context', () => ({
  getConfiguredAgenticMerchantSlug: mocks.getConfiguredAgenticMerchantSlug,
}));
vi.mock('./agentic-merchant-id', () => ({
  resolveAgenticMerchantId: mocks.resolveAgenticMerchantId,
}));

import { resolveSantaTenant } from './resolve-santa-tenant';

describe('resolveSantaTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPublicClient.mockReturnValue({ kind: 'public' });
    mocks.getConfiguredAgenticMerchantSlug.mockReturnValue('winter-store');
    mocks.resolveAgenticMerchantId.mockResolvedValue('merchant-1');
  });

  it('resolves the tenant through the publication-gated public client', async () => {
    await expect(resolveSantaTenant()).resolves.toEqual({
      id: 'merchant-1',
      slug: 'winter-store',
    });

    expect(mocks.createPublicClient).toHaveBeenCalledWith({
      clientInfo: 'baci-santa-tenant-resolve',
    });
    expect(mocks.resolveAgenticMerchantId).toHaveBeenCalledWith({
      kind: 'public',
    });
  });

  it('fails closed when the tenant is not configured', async () => {
    mocks.getConfiguredAgenticMerchantSlug.mockReturnValue(undefined);

    await expect(resolveSantaTenant()).resolves.toBeNull();

    expect(mocks.createPublicClient).not.toHaveBeenCalled();
    expect(mocks.resolveAgenticMerchantId).not.toHaveBeenCalled();
  });

  it('fails closed when the configured tenant is unpublished or missing', async () => {
    mocks.resolveAgenticMerchantId.mockResolvedValue(null);

    await expect(resolveSantaTenant()).resolves.toBeNull();
  });
});
