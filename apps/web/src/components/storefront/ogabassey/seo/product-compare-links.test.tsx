import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductCompareLinks } from './product-compare-links';

describe('ProductCompareLinks', () => {
  it('renders popular comparisons for the current product', () => {
    render(
      <ProductCompareLinks
        productName="Xiaomi 13T"
        merchantName="Demo Store"
        pathPrefix="/ogabassey"
        links={[
          {
            href: '/smartphones/compare/google-pixel-8-vs-xiaomi-13t',
            label: 'Compare Google Pixel 8 with Xiaomi 13T',
            description: 'Compare price, specs, condition, and buying fit.',
            categorySlug: 'smartphones',
            comparisonSlug: 'google-pixel-8-vs-xiaomi-13t',
            productSlugs: ['google-pixel-8', 'xiaomi-13t'],
            productNames: ['Google Pixel 8', 'Xiaomi 13T'],
            anchorProductSlug: 'xiaomi-13t',
            score: 12,
          },
        ]}
      />
    );

    expect(
      screen.getByRole('heading', {
        name: 'Popular comparisons for this product',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/similar Demo Store options/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'Compare Google Pixel 8 with Xiaomi 13T',
      })
    ).toHaveAttribute(
      'href',
      '/ogabassey/smartphones/compare/google-pixel-8-vs-xiaomi-13t'
    );
  });

  it('renders nothing when there are no popular comparisons', () => {
    const { container } = render(
      <ProductCompareLinks
        productName="Demo"
        merchantName="Demo Store"
        links={[]}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('normalizes path prefixes before rendering storefront compare links', () => {
    render(
      <ProductCompareLinks
        productName="Xiaomi 13T"
        merchantName="Demo Store"
        pathPrefix="/ogabassey/"
        links={[
          {
            href: 'smartphones/compare/google-pixel-8-vs-xiaomi-13t',
            label: 'Compare Google Pixel 8 with Xiaomi 13T',
            description: 'Compare price, specs, condition, and buying fit.',
            categorySlug: 'smartphones',
            comparisonSlug: 'google-pixel-8-vs-xiaomi-13t',
            productSlugs: ['google-pixel-8', 'xiaomi-13t'],
            productNames: ['Google Pixel 8', 'Xiaomi 13T'],
            anchorProductSlug: 'xiaomi-13t',
            score: 12,
          },
        ]}
      />
    );

    expect(
      screen.getByRole('link', {
        name: 'Compare Google Pixel 8 with Xiaomi 13T',
      })
    ).toHaveAttribute(
      'href',
      '/ogabassey/smartphones/compare/google-pixel-8-vs-xiaomi-13t'
    );
  });
});
