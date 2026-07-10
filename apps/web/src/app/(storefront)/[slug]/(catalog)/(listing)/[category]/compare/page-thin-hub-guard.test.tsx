import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoadCategoryCompareHubData = vi.fn();

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers()),
}));

vi.mock('next/navigation', () => ({
  permanentRedirect: (href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/lib/seo-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/seo-utils')>();

  return {
    ...actual,
    getIndexableRobotsMetadata: () => ({ index: true, follow: true }),
  };
});

vi.mock('./load-category-compare-hub-data', () => ({
  loadCategoryCompareHubData: (...args: unknown[]) =>
    mockLoadCategoryCompareHubData(...args),
}));

const { default: CategoryCompareIndexPage, generateMetadata } = await import(
  './page'
);

describe('CategoryCompareIndexPage thin-hub guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('404s a hub with zero eligible comparisons instead of serving a thin page', async () => {
    mockLoadCategoryCompareHubData.mockResolvedValueOnce({
      categoryName: 'Printers',
      categorySlug: 'printers',
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      productGroups: [],
      products: [],
      storeUrl: 'https://ogabassey.com',
    });

    await expect(
      CategoryCompareIndexPage({
        params: Promise.resolve({
          slug: 'ogabassey',
          category: 'printers',
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('404s an empty hub even when only a lone product exists (no comparable pair)', async () => {
    mockLoadCategoryCompareHubData.mockResolvedValueOnce({
      categoryName: 'Printers',
      categorySlug: 'printers',
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      productGroups: [],
      products: [
        {
          slug: 'hp-laserjet-m110w',
          name: 'HP LaserJet M110w',
          brand: 'HP',
          price: 180_000,
          category_slug: 'printers',
          product_key_specs: {
            ram_gb: 0.032,
          },
        },
      ],
      storeUrl: 'https://ogabassey.com',
    });

    await expect(
      CategoryCompareIndexPage({
        params: Promise.resolve({
          slug: 'ogabassey',
          category: 'printers',
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('404s a populated hub whose pairs all fail spec eligibility (the live printers/gift-cards case)', async () => {
    // Two products DO form a pair, but identical key specs give zero
    // differentiating specs — the eligibility filter drops every entry, so
    // the hub is thin despite having products and must 404.
    mockLoadCategoryCompareHubData.mockResolvedValueOnce({
      categoryName: 'Printers',
      categorySlug: 'printers',
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      productGroups: [],
      products: [
        {
          slug: 'hp-laserjet-m110w',
          name: 'HP LaserJet M110w',
          brand: 'HP',
          price: 180_000,
          category_slug: 'printers',
          product_key_specs: {
            ram_gb: 0.032,
          },
        },
        {
          slug: 'canon-lbp6030w',
          name: 'Canon LBP6030w',
          brand: 'Canon',
          price: 175_000,
          category_slug: 'printers',
          product_key_specs: {
            ram_gb: 0.032,
          },
        },
      ],
      storeUrl: 'https://ogabassey.com',
    });

    await expect(
      CategoryCompareIndexPage({
        params: Promise.resolve({
          slug: 'ogabassey',
          category: 'printers',
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('serves the thin noindexed hub instead of 404 when the inventory load is degraded', async () => {
    const degradedHub = {
      categoryName: 'Laptops',
      categorySlug: 'laptops',
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      productGroups: [],
      products: [],
      inventoryDegraded: true,
      storeUrl: 'https://ogabassey.com',
    };
    mockLoadCategoryCompareHubData.mockResolvedValue(degradedHub);

    render(
      (await CategoryCompareIndexPage({
        params: Promise.resolve({
          slug: 'ogabassey',
          category: 'laptops',
        }),
      })) as React.ReactElement
    );
    expect(
      screen.getByRole('heading', { name: 'Laptops comparisons' })
    ).toBeInTheDocument();

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: 'ogabassey', category: 'laptops' }),
      })
    ).resolves.toMatchObject({
      robots: { index: false, follow: true },
    });
  });

  it('noindexes a partially degraded hub that still has comparison links', async () => {
    // A partial failure (one child group's inventory load threw, another
    // produced links) yields inventoryDegraded=true AND compareLinks — it must
    // stay noindex,follow so a transient failure never publishes an incomplete
    // hub as indexable, yet the populated hub still renders (not 404).
    const partiallyDegradedHub = {
      categoryName: 'Smartphones',
      categorySlug: 'smartphones',
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      storeUrl: 'https://ogabassey.com',
      inventoryDegraded: true,
      products: [
        {
          slug: 'xiaomi-13t',
          name: 'Xiaomi 13T',
          brand: 'Xiaomi',
          price: 450_000,
          category_slug: 'smartphones',
          product_key_specs: {
            chipset: 'Dimensity 8200 Ultra',
            ram_gb: 8,
            storage_gb: 256,
          },
        },
        {
          slug: 'google-pixel-8',
          name: 'Google Pixel 8',
          brand: 'Google',
          price: 620_000,
          category_slug: 'smartphones',
          product_key_specs: {
            chipset: 'Tensor G3',
            ram_gb: 12,
            storage_gb: 128,
          },
        },
      ],
    };
    mockLoadCategoryCompareHubData.mockResolvedValue(partiallyDegradedHub);

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: 'ogabassey', category: 'smartphones' }),
      })
    ).resolves.toMatchObject({
      robots: { index: false, follow: true },
    });

    render(
      (await CategoryCompareIndexPage({
        params: Promise.resolve({
          slug: 'ogabassey',
          category: 'smartphones',
        }),
      })) as React.ReactElement
    );
    expect(
      screen.getByRole('heading', { name: 'Smartphones comparisons' })
    ).toBeInTheDocument();
  });

  it('404s from generateMetadata for an empty hub so blocking-metadata crawls get a real 404 status', async () => {
    mockLoadCategoryCompareHubData.mockResolvedValueOnce({
      categoryName: 'Printers',
      categorySlug: 'printers',
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      productGroups: [],
      products: [],
      storeUrl: 'https://ogabassey.com',
    });

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: 'ogabassey', category: 'printers' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
