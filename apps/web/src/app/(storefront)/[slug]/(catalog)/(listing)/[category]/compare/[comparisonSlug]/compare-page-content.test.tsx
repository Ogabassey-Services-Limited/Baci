import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoadComparePage = vi.fn();

vi.mock('@/lib/storefront-compare/load-compare-page', () => ({
  loadComparePage: (...args: unknown[]) => mockLoadComparePage(...args),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: (value: unknown) => JSON.stringify(value),
}));

const comparePageModel = {
  kind: 'product' as const,
  canonicalSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
  canonicalUrl:
    'https://ogabassey.com/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
  metaTitle: 'iPhone 17 Pro Max vs Samsung Galaxy Z TriFold | Ogabassey',
  metaDescription:
    'Compare iPhone 17 Pro Max and Samsung Galaxy Z TriFold specs, pricing, and buying advice.',
  heading: 'iPhone 17 Pro Max vs Samsung Galaxy Z TriFold',
  summaryVerdict:
    'Both phones target flagship buyers, but their strengths differ.',
  keyDifferences: [
    'Apple ecosystem vs foldable productivity',
    'Battery life vs multitasking',
  ],
  comparisonRows: [
    {
      label: 'Processor',
      leftValue: 'A19 Pro',
      rightValue: 'Snapdragon 8 Elite',
    },
  ],
  faqItems: [
    {
      question: 'Which phone is better for multitasking?',
      answer: 'The TriFold.',
    },
  ],
  breadcrumbItems: [
    { name: 'Ogabassey', url: 'https://ogabassey.com' },
    { name: 'Smartphones', url: 'https://ogabassey.com/smartphones' },
    {
      name: 'iPhone 17 Pro Max vs Samsung Galaxy Z TriFold',
      url: 'https://ogabassey.com/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
    },
  ],
  guideLinks: [
    {
      href: 'https://ogabassey.com/blog/best-phones-in-nigeria',
      title: 'Best Phones in Nigeria',
      description: 'Budget and flagship picks.',
      kind: 'best-in-nigeria' as const,
    },
  ],
  isIndexable: true,
  leftProduct: {
    id: 'left-product',
    name: 'iPhone 17 Pro Max',
    slug: 'iphone-17-pro-max',
  },
  rightProduct: {
    id: 'right-product',
    name: 'Samsung Galaxy Z TriFold',
    slug: 'samsung-galaxy-z-trifold',
  },
};

describe('ComparePageContent', () => {
  beforeEach(() => {
    mockLoadComparePage.mockReset();
    mockLoadComparePage.mockResolvedValue(comparePageModel);
  });

  it('renders the verdict, key differences, and comparison table', async () => {
    const { ComparePageContent } = await import('./compare-page-content');

    render(
      (await ComparePageContent({
        params: Promise.resolve({
          slug: 'ogabassey',
          category: 'smartphones',
          comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
        }),
      })) as ReactElement
    );

    expect(
      screen.getByRole('heading', {
        name: /iPhone 17 Pro Max vs Samsung Galaxy Z TriFold/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Both phones target flagship buyers/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: /Product comparison table/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Best Phones in Nigeria' })
    ).toHaveAttribute(
      'href',
      'https://ogabassey.com/blog/best-phones-in-nigeria'
    );
  });

  it('renders breadcrumb and FAQ JSON-LD scripts when faqItems exist', async () => {
    const { ComparePageContent } = await import('./compare-page-content');

    const { container } = render(
      (await ComparePageContent({
        params: Promise.resolve({
          slug: 'ogabassey',
          category: 'smartphones',
          comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
        }),
      })) as ReactElement
    );

    const schemaScripts = container.querySelectorAll(
      'script[type="application/ld+json"]'
    );

    expect(schemaScripts).toHaveLength(2);
    expect(schemaScripts[0]?.textContent).toContain('"@type":"BreadcrumbList"');
    expect(schemaScripts[1]?.textContent).toContain('"@type":"FAQPage"');
  });

  it('renders only breadcrumb JSON-LD when faqItems are absent', async () => {
    mockLoadComparePage.mockResolvedValueOnce({
      ...comparePageModel,
      faqItems: [],
    });
    const { ComparePageContent } = await import('./compare-page-content');

    const { container } = render(
      (await ComparePageContent({
        params: Promise.resolve({
          slug: 'ogabassey',
          category: 'smartphones',
          comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
        }),
      })) as ReactElement
    );

    const schemaScripts = container.querySelectorAll(
      'script[type="application/ld+json"]'
    );

    expect(schemaScripts).toHaveLength(1);
    expect(schemaScripts[0]?.textContent).toContain('"@type":"BreadcrumbList"');
    expect(schemaScripts[0]?.textContent).not.toContain('"@type":"FAQPage"');
  });

  it('uses brand names as table column labels for brand compare pages', async () => {
    mockLoadComparePage.mockResolvedValueOnce({
      kind: 'brand' as const,
      canonicalSlug: 'apple-vs-samsung',
      canonicalUrl:
        'https://ogabassey.com/smartphones/compare/apple-vs-samsung',
      metaTitle: 'Apple vs Samsung Smartphones | Ogabassey',
      metaDescription:
        'Compare Apple and Samsung smartphones by price range and active models.',
      heading: 'Apple vs Samsung Smartphones',
      summaryVerdict:
        'Apple and Samsung both matter for smartphone buyers, but their positioning differs.',
      keyDifferences: [
        'Apple has 3 active models in this category.',
        'Samsung has 5 active models in this category.',
      ],
      comparisonRows: [
        {
          label: 'Active models',
          leftValue: '3',
          rightValue: '5',
        },
      ],
      faqItems: [],
      breadcrumbItems: [
        { name: 'Ogabassey', url: 'https://ogabassey.com' },
        { name: 'Smartphones', url: 'https://ogabassey.com/smartphones' },
        {
          name: 'Apple vs Samsung Smartphones',
          url: 'https://ogabassey.com/smartphones/compare/apple-vs-samsung',
        },
      ],
      guideLinks: [],
      isIndexable: true,
      leftBrand: 'Apple',
      rightBrand: 'Samsung',
      leftBrandProducts: [],
      rightBrandProducts: [],
    });
    const { ComparePageContent } = await import('./compare-page-content');

    render(
      (await ComparePageContent({
        params: Promise.resolve({
          slug: 'ogabassey',
          category: 'smartphones',
          comparisonSlug: 'apple-vs-samsung',
        }),
      })) as ReactElement
    );

    expect(
      screen.getByRole('columnheader', { name: 'Apple' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Samsung' })
    ).toBeInTheDocument();
  });
});
