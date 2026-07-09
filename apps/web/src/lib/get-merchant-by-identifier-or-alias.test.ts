import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMerchantByIdentifier = vi.fn();
const mockGetCurrentSlugForAlias = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
}));
vi.mock('@/lib/slug-alias-cache', () => ({
  getCurrentSlugForAlias: (...args: unknown[]) =>
    mockGetCurrentSlugForAlias(...args),
}));

const { getMerchantByIdentifierOrAlias } = await import(
  './get-merchant-by-identifier-or-alias'
);

describe('getMerchantByIdentifierOrAlias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentSlugForAlias.mockResolvedValue(null);
  });

  it('returns the live merchant directly without consulting the alias table', async () => {
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'm1',
      slug: 'ogabassey',
    });
    const result = await getMerchantByIdentifierOrAlias('ogabassey');
    expect(result).toEqual({ id: 'm1', slug: 'ogabassey' });
    expect(mockGetCurrentSlugForAlias).not.toHaveBeenCalled();
  });

  it('falls back to the alias table for a retired slug and re-looks-up the current slug', async () => {
    mockGetMerchantByIdentifier
      .mockResolvedValueOnce(null) // retired slug misses
      .mockResolvedValueOnce({ id: 'm1', slug: 'zorvexa' }); // current slug hits
    mockGetCurrentSlugForAlias.mockResolvedValue('zorvexa');

    const result = await getMerchantByIdentifierOrAlias('yodhashop');

    expect(result).toEqual({ id: 'm1', slug: 'zorvexa' });
    expect(mockGetMerchantByIdentifier).toHaveBeenNthCalledWith(1, 'yodhashop');
    expect(mockGetMerchantByIdentifier).toHaveBeenNthCalledWith(2, 'zorvexa');
  });

  it('returns null when the identifier is neither a live merchant nor a retired alias', async () => {
    mockGetMerchantByIdentifier.mockResolvedValue(null);
    const result = await getMerchantByIdentifierOrAlias('nope');
    expect(result).toBeNull();
  });
});
