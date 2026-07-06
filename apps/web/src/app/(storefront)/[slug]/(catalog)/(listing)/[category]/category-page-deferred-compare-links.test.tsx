import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCategoryHubSections = vi.fn();
const mockLoadCategoryPageCompareLinks = vi.fn();

vi.mock('@/components/storefront/ogabassey/seo/category-hub-sections', () => ({
  CategoryHubSections: ({
    hub,
    headingIdPrefix,
    comparisonHeading,
  }: {
    hub: {
      comparisonLinks: Array<{
        href: string;
        label: string;
      }>;
    };
    headingIdPrefix?: string;
    comparisonHeading?: string;
  }) =>
    mockCategoryHubSections({
      comparisonHeading,
      headingIdPrefix,
      hub,
    }) ?? (
      <section aria-label="Deferred category comparisons">
        {hub.comparisonLinks.map((link) => (
          <a href={link.href} key={link.href}>
            {link.label}
          </a>
        ))}
      </section>
    ),
}));

vi.mock('./category-page-compare-links', () => ({
  loadCategoryPageCompareLinks: (...args: unknown[]) =>
    mockLoadCategoryPageCompareLinks(...args),
}));

const { CategoryPageDeferredCompareLinks } = await import(
  './category-page-deferred-compare-links'
);

describe('CategoryPageDeferredCompareLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders crawlable category comparison links when the graph has entries', async () => {
    mockLoadCategoryPageCompareLinks.mockResolvedValueOnce([
      {
        href: 'https://store.example.com/smartphones/compare/a-vs-b',
        label: 'Product A vs Product B',
      },
    ]);

    const ui = await CategoryPageDeferredCompareLinks({
      storeUrl: 'https://store.example.com',
      merchantId: 'merchant-1',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
    });

    render(ui);

    expect(
      screen.getByRole('link', { name: 'Product A vs Product B' })
    ).toHaveAttribute(
      'href',
      'https://store.example.com/smartphones/compare/a-vs-b'
    );
    expect(mockCategoryHubSections).toHaveBeenCalledWith(
      expect.objectContaining({
        comparisonHeading: 'More product comparisons',
        headingIdPrefix: 'maintained-category-comparisons',
      })
    );
  });

  it('renders nothing when no graph comparison links are available', async () => {
    mockLoadCategoryPageCompareLinks.mockResolvedValueOnce([]);

    const ui = await CategoryPageDeferredCompareLinks({
      storeUrl: 'https://store.example.com',
      merchantId: 'merchant-1',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
    });

    expect(ui).toBeNull();
  });
});
