import { describe, expect, it } from 'vitest';
import {
  buildCommercialSupportDiscoveryLinks,
  buildCompareDiscoveryLinks,
  PRODUCT_SCOPED_COMPARE_DISCOVERY_PRODUCT_LIMIT,
} from './build-compare-discovery-links';

const products = [
  {
    slug: 'macbook-air-15-inch-m4-2025',
    name: '15" MacBook Air M4 (2025)',
    brand: 'Apple',
    price: 2_000_000,
    category_slug: 'laptops',
    product_key_specs: {
      chipset: 'Apple M4',
      ram_gb: 16,
      storage_gb: 512,
    },
  },
  {
    slug: 'dell-xps-13-9350',
    name: 'Dell XPS 13 9350',
    brand: 'Dell',
    price: 900_000,
    category_slug: 'laptops',
    product_key_specs: {
      chipset: 'Intel Core Ultra 7',
      ram_gb: 16,
      storage_gb: 1024,
    },
  },
  {
    slug: 'hp-elitebook-840-g11',
    name: 'HP EliteBook 840 G11',
    brand: 'HP',
    price: 850_000,
    category_slug: 'laptops',
    product_key_specs: {
      chipset: 'Intel Core Ultra 5',
      ram_gb: 32,
      storage_gb: 512,
    },
  },
  {
    slug: 'lenovo-thinkpad-x1-carbon-gen-12',
    name: 'Lenovo ThinkPad X1 Carbon Gen 12',
    brand: 'Lenovo',
    price: 950_000,
    category_slug: 'laptops',
    product_key_specs: {
      chipset: 'Intel Core Ultra 7',
      ram_gb: 32,
      storage_gb: 1024,
    },
  },
  {
    slug: 'hp-probook-440-g11',
    name: 'HP ProBook 440 G11',
    brand: 'HP',
    price: 780_000,
    category_slug: 'laptops',
    product_key_specs: {
      chipset: 'Intel Core Ultra 5',
      ram_gb: 16,
      storage_gb: 512,
    },
  },
  {
    slug: 'dell-latitude-5440',
    name: 'Dell Latitude 5440',
    brand: 'Dell',
    price: 720_000,
    category_slug: 'laptops',
    product_key_specs: {
      chipset: 'Intel Core i5',
      ram_gb: 16,
      storage_gb: 256,
    },
  },
  {
    slug: 'lenovo-ideapad-slim-3-15irh8',
    name: 'Lenovo IdeaPad Slim 3 15IRH8',
    brand: 'Lenovo',
    price: 680_000,
    category_slug: 'laptops',
    product_key_specs: {
      chipset: 'Intel Core i5',
      ram_gb: 8,
      storage_gb: 512,
    },
  },
] as const;

describe('buildCompareDiscoveryLinks', () => {
  it('surfaces every product-scoped compare link as a canonical category link', () => {
    const links = buildCompareDiscoveryLinks({
      storeUrl: 'https://ogabassey.com/',
      categorySlug: 'laptops',
      categoryName: 'Laptops',
      products: [...products],
    });

    expect(links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: 'https://ogabassey.com/laptops/compare/dell-xps-13-9350-vs-hp-elitebook-840-g11',
          label: 'Dell XPS 13 9350 vs HP EliteBook 840 G11',
        }),
        expect.objectContaining({
          href: 'https://ogabassey.com/laptops/compare/dell-latitude-5440-vs-hp-elitebook-840-g11',
          label: 'Dell Latitude 5440 vs HP EliteBook 840 G11',
        }),
      ])
    );
    expect(new Set(links.map((link) => link.href)).size).toBe(links.length);
    expect(links.every((link) => link.href.includes('/compare/'))).toBe(true);
  });

  it('keeps price-band support URLs in the commercial sitemap output', () => {
    const compareLinks = buildCompareDiscoveryLinks({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'laptops',
      categoryName: 'Laptops',
      products: [...products],
    });
    const links = buildCommercialSupportDiscoveryLinks({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'laptops',
      categoryName: 'Laptops',
      products: [...products],
    });

    expect(links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: expect.stringContaining('/laptops/compare/'),
        }),
      ])
    );
    expect(
      links
        .filter((link) => link.href.includes('/laptops/compare/'))
        .map((link) => link.href)
    ).toEqual(compareLinks.map((link) => link.href));
    expect(
      links.some((link) => link.href.includes('/laptops/best-under/'))
    ).toBe(true);
  });

  it('drops compare candidates when products do not meet publish rules', () => {
    const links = buildCompareDiscoveryLinks({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'laptops',
      categoryName: 'Laptops',
      products: [
        {
          slug: 'basic-laptop-a',
          name: 'Basic Laptop A',
          brand: 'A',
          price: 400_000,
          category_slug: 'laptops',
          product_key_specs: {
            chipset: 'Intel N100',
          },
        },
        {
          slug: 'basic-laptop-b',
          name: 'Basic Laptop B',
          brand: 'B',
          price: 420_000,
          category_slug: 'laptops',
          product_key_specs: {
            chipset: 'Intel N100',
          },
        },
      ],
    });

    expect(links).toEqual([]);
  });

  it('caps product-scoped compare discovery to a bounded product set', () => {
    const overflowProductSlug = `laptop-${PRODUCT_SCOPED_COMPARE_DISCOVERY_PRODUCT_LIMIT}`;
    const largeProducts = Array.from(
      { length: PRODUCT_SCOPED_COMPARE_DISCOVERY_PRODUCT_LIMIT + 1 },
      (_, index) => ({
        slug: `laptop-${index}`,
        name: `Laptop ${index}`,
        brand: `Brand ${index % 4}`,
        price: 500_000 + index,
        category_slug: 'laptops',
        product_key_specs: {
          chipset: `Chip ${index}`,
          ram_gb: 8 + index,
          storage_gb: 128 + index,
        },
      })
    );
    const links = buildCompareDiscoveryLinks({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'laptops',
      categoryName: 'Laptops',
      products: largeProducts,
    });

    expect(links.some((link) => link.href.includes(overflowProductSlug))).toBe(
      false
    );
  });

  it('skips brand compare links when discovery uses sampled products', () => {
    const links = buildCompareDiscoveryLinks({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      includeBrandCompareLinks: false,
      products: [
        {
          slug: 'iphone-17-pro-max',
          name: 'iPhone 17 Pro Max',
          brand: 'Apple',
          price: 495_000,
          category_slug: 'smartphones',
          product_key_specs: {
            chipset: 'A19 Pro',
            ram_gb: 8,
            storage_gb: 256,
          },
        },
        {
          slug: 'samsung-galaxy-z-trifold',
          name: 'Samsung Galaxy Z TriFold',
          brand: 'Samsung',
          price: 480_000,
          category_slug: 'smartphones',
          product_key_specs: {
            chipset: 'Snapdragon 8 Elite',
            ram_gb: 16,
            storage_gb: 512,
          },
        },
        {
          slug: 'iphone-16e',
          name: 'iPhone 16e',
          brand: 'Apple',
          price: 450_000,
          category_slug: 'smartphones',
          product_key_specs: {
            chipset: 'A18',
            ram_gb: 8,
            storage_gb: 128,
          },
        },
        {
          slug: 'galaxy-a56',
          name: 'Galaxy A56',
          brand: 'Samsung',
          price: 410_000,
          category_slug: 'smartphones',
          product_key_specs: {
            chipset: 'Exynos',
            ram_gb: 8,
            storage_gb: 128,
          },
        },
      ],
    });

    expect(
      links.some((link) => link.href.endsWith('/compare/apple-vs-samsung'))
    ).toBe(false);
    expect(
      links.some((link) =>
        link.href.endsWith(
          '/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
        )
      )
    ).toBe(true);
  });
});
