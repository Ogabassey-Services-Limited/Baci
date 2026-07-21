import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock(
  '@/app/(storefront)/[slug]/(catalog)/(listing)/products/product-index-card',
  () => ({
    ProductIndexCard: ({ product }: { product: { name: string } }) => (
      <div>{product.name}</div>
    ),
  })
);
vi.mock('@/lib/resolve-merchant-currency', () => ({
  resolveMerchantCurrencyConfig: () => ({ code: 'NGN' }),
}));
vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: (value: unknown) => JSON.stringify(value),
}));

const page = {
  canonicalUrl: 'https://ogabassey.com/smartphones/brands/samsung',
  heading: 'Samsung Phones and Prices in Nigeria',
  intro: 'Compare six active Samsung phones.',
  categoryName: 'Smartphones',
  categoryUrl: 'https://ogabassey.com/smartphones',
  brand: { displayName: 'Samsung' },
  merchant: { country: 'NG', payout_currency: 'NGN' },
  breadcrumbItems: [],
  pathPrefix: '',
  products: [
    {
      id: 'product-1',
      name: 'Samsung Galaxy A56',
      slug: 'samsung-galaxy-a56',
      description: 'Galaxy phone',
      image: 'https://cdn.example.com/a56.jpg',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Samsung',
      price: 450_000,
      condition: 'new',
      stock: 4,
      availability: 'InStock' as const,
      has_condition_offers: false,
    },
  ],
  guideLinks: [
    {
      href: 'https://ogabassey.com/blog/best-samsung-phones',
      title: 'Best Samsung Phones',
      description: 'Compare Galaxy models.',
      kind: 'buyer-guide' as const,
    },
  ],
};

describe('BrandAuthorityPageContent', () => {
  it('renders brand context, product links, category link, and guides', async () => {
    const { BrandAuthorityPageContent } = await import(
      './brand-authority-page-content'
    );
    render(<BrandAuthorityPageContent page={page as never} />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Samsung Phones and Prices in Nigeria',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Samsung Galaxy A56')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Browse all smartphones' })
    ).toHaveAttribute('href', 'https://ogabassey.com/smartphones');
    expect(
      screen.getByRole('link', { name: 'Best Samsung Phones' })
    ).toHaveAttribute('href', 'https://ogabassey.com/blog/best-samsung-phones');
  });
});
