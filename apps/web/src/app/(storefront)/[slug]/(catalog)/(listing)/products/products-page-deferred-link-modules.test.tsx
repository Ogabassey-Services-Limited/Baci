import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoadProductsPageLinkModules = vi.fn();

vi.mock(
  '@/components/storefront/ogabassey/seo/storefront-link-modules-section',
  () => ({
    StorefrontLinkModulesSection: ({
      modules,
      pathPrefix,
    }: {
      modules: Array<{
        id: string;
        items: Array<{ href: string; label: string }>;
      }>;
      pathPrefix: string;
    }) => (
      <section aria-label="Deferred products link modules">
        <span>{pathPrefix}</span>
        {modules.flatMap((module) =>
          module.items.map((item) => (
            <a href={item.href} key={`${module.id}-${item.href}`}>
              {item.label}
            </a>
          ))
        )}
      </section>
    ),
  })
);

vi.mock('./products-page-link-modules', () => ({
  loadProductsPageLinkModules: (...args: unknown[]) =>
    mockLoadProductsPageLinkModules(...args),
}));

const { ProductsPageDeferredLinkModules } = await import(
  './products-page-deferred-link-modules'
);

describe('ProductsPageDeferredLinkModules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and renders products page link modules after the catalog shell', async () => {
    mockLoadProductsPageLinkModules.mockResolvedValueOnce([
      {
        id: 'catalog-pages',
        title: 'Browse product pages',
        description: 'Jump through the maintained product index.',
        items: [
          {
            href: '/products?page=6',
            label: 'Products page 6',
            source: 'catalog-pagination',
          },
        ],
      },
    ]);

    render(
      await ProductsPageDeferredLinkModules({
        baseUrl: 'https://ogabassey.com',
        categories: [
          {
            id: 'cat-1',
            name: 'Smartphones',
            slug: 'smartphones',
            canonicalSlug: 'smartphones',
            description: null,
            image_url: null,
            is_active: true,
            parent_id: null,
          },
        ],
        merchantId: 'merchant-1',
        pathPrefix: '/ogabassey',
        productTotalPages: 6,
      })
    );

    expect(mockLoadProductsPageLinkModules).toHaveBeenCalledWith({
      baseUrl: 'https://ogabassey.com',
      categories: [
        expect.objectContaining({
          id: 'cat-1',
          canonicalSlug: 'smartphones',
        }),
      ],
      merchantId: 'merchant-1',
      productTotalPages: 6,
    });
    expect(
      screen.getByRole('region', { name: 'Deferred products link modules' })
    ).toHaveTextContent('/ogabassey');
    expect(
      screen.getByRole('link', { name: 'Products page 6' })
    ).toHaveAttribute('href', '/products?page=6');
  });
});
