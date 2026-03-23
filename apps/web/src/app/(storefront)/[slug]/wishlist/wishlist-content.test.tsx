import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMerchantByIdentifier } from '@/lib/cached-data';

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: vi.fn(),
}));

const wishListPageClientProps = vi.fn();

vi.mock('./wishlist-client', () => ({
  WishListPageClient: (props: { merchantCountry: string | null }) => {
    wishListPageClientProps(props);
    return <section aria-label="wish list">Your saved items</section>;
  },
}));

const { WishListContent } = await import('./wishlist-content');

describe('WishListContent', () => {
  beforeEach(() => {
    vi.mocked(getMerchantByIdentifier).mockReset();
    wishListPageClientProps.mockClear();
  });

  it('passes merchant country to WishListPageClient', async () => {
    vi.mocked(getMerchantByIdentifier).mockResolvedValue({
      country: 'NG',
    } as unknown as Awaited<ReturnType<typeof getMerchantByIdentifier>>);

    const element = await WishListContent({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });
    render(element);

    expect(
      screen.getByRole('region', { name: 'wish list' })
    ).toBeInTheDocument();
    expect(wishListPageClientProps).toHaveBeenCalledWith(
      expect.objectContaining({ merchantCountry: 'NG' })
    );
  });

  it('passes null country when merchant is not found', async () => {
    vi.mocked(getMerchantByIdentifier).mockResolvedValue(null);

    const element = await WishListContent({
      params: Promise.resolve({ slug: 'missing' }),
    });
    render(element);

    expect(wishListPageClientProps).toHaveBeenCalledWith(
      expect.objectContaining({ merchantCountry: null })
    );
  });
});
