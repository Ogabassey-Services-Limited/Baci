import { describe, expect, it } from 'vitest';
import { buildProductSemanticModel } from './build-product-semantic-model';
import type {
  BuildProductSemanticModelInput,
  ProductSemanticCandidate,
} from './product-semantic-types';

function makeCandidate(
  overrides: Partial<ProductSemanticCandidate> &
    Pick<ProductSemanticCandidate, 'slug' | 'name' | 'price'>
): ProductSemanticCandidate {
  return {
    brand: null,
    condition: 'new',
    stock: 5,
    category_slug: 'smartphones',
    product_key_specs: {},
    ...overrides,
  };
}

function makeInput(
  overrides: Partial<BuildProductSemanticModelInput> &
    Pick<BuildProductSemanticModelInput, 'currentProduct' | 'inventory'>
): BuildProductSemanticModelInput {
  return {
    storeUrl: 'https://ogabassey.com',
    merchantBusinessName: 'Ogabassey',
    categorySlug: 'smartphones',
    categoryName: 'Smartphones',
    ...overrides,
  };
}

const publishedGuidePosts = [
  {
    slug: 'best-phones-in-nigeria',
    title: 'Best Phones in Nigeria',
    excerpt: 'Budget and flagship phone picks.',
    category: 'Smartphones',
    tags: ['smartphones', 'budget', 'iphone'],
    keywords: ['android', 'battery'],
    featured_image_url: null,
    published_at: '2026-04-10T09:00:00.000Z',
    reading_time_minutes: 6,
  },
  {
    slug: 'apple-vs-samsung-buying-guide',
    title: 'Apple vs Samsung Buying Guide',
    excerpt: 'Which ecosystem fits you.',
    category: 'Smartphones',
    tags: ['smartphones', 'apple', 'samsung'],
    keywords: ['iphone', 'galaxy'],
    featured_image_url: null,
    published_at: '2026-04-09T09:00:00.000Z',
    reading_time_minutes: 5,
  },
];

describe('buildProductSemanticModel', () => {
  it('keeps the category hub link first and appends compare support links without duplicates', () => {
    const currentProduct = makeCandidate({
      slug: 'iphone-17-pro-max',
      name: 'iPhone 17 Pro Max',
      brand: 'Apple',
      price: 495_000,
      product_key_specs: { chipset: 'A19 Pro', ram_gb: 8, storage_gb: 256 },
    });
    const inventory = [
      currentProduct,
      makeCandidate({
        slug: 'samsung-galaxy-z-trifold',
        name: 'Samsung Galaxy Z TriFold',
        brand: 'Samsung',
        price: 480_000,
        stock: 4,
        product_key_specs: {
          chipset: 'Snapdragon 8 Elite',
          ram_gb: 16,
          storage_gb: 512,
        },
      }),
      makeCandidate({
        slug: 'iphone-16e',
        name: 'iPhone 16e',
        brand: 'Apple',
        price: 450_000,
        stock: 12,
        product_key_specs: { chipset: 'A18', ram_gb: 8, storage_gb: 128 },
      }),
      makeCandidate({
        slug: 'iphone-15',
        name: 'iPhone 15',
        brand: 'Apple',
        price: 430_000,
        stock: 10,
        product_key_specs: { chipset: 'A17', ram_gb: 8, storage_gb: 128 },
      }),
      makeCandidate({
        slug: 'galaxy-a56',
        name: 'Galaxy A56',
        brand: 'Samsung',
        price: 410_000,
        stock: 9,
        product_key_specs: { chipset: 'Exynos', ram_gb: 8, storage_gb: 128 },
      }),
      makeCandidate({
        slug: 'galaxy-a36',
        name: 'Galaxy A36',
        brand: 'Samsung',
        price: 360_000,
        stock: 7,
        product_key_specs: {
          chipset: 'Snapdragon 7 Gen',
          ram_gb: 8,
          storage_gb: 128,
        },
      }),
      makeCandidate({
        slug: 'tecno-camon-40',
        name: 'Tecno Camon 40',
        brand: 'Tecno',
        price: 420_000,
        stock: 8,
        product_key_specs: {
          chipset: 'MediaTek Dimensity',
          ram_gb: 8,
          storage_gb: 256,
        },
      }),
    ];
    const model = buildProductSemanticModel(
      makeInput({
        currentProduct,
        inventory,
        guidePosts: [...publishedGuidePosts],
      })
    );

    expect(model.supportLinks[0]).toEqual({
      href: 'https://ogabassey.com/smartphones',
      label: 'Shop more Smartphones',
    });
    expect(new Set(model.supportLinks.map((link) => link.href)).size).toBe(
      model.supportLinks.length
    );
    expect(model.guideLinks).toEqual([
      {
        href: 'https://ogabassey.com/blog/apple-vs-samsung-buying-guide',
        title: 'Apple vs Samsung Buying Guide',
        description: 'Which ecosystem fits you.',
        kind: 'decision-support',
      },
      {
        href: 'https://ogabassey.com/blog/best-phones-in-nigeria',
        title: 'Best Phones in Nigeria',
        description: 'Budget and flagship phone picks.',
        kind: 'best-in-nigeria',
      },
    ]);
  });

  it('ranks alternatives by condition bucket, stock, price distance, spec overlap, then slug', () => {
    const currentProduct = makeCandidate({
      slug: 'samsung-galaxy-s25',
      name: 'Samsung Galaxy S25',
      brand: 'Samsung',
      price: 900_000,
      product_key_specs: {
        chipset: 'Snapdragon 8 Elite',
        ram_gb: 12,
        storage_gb: 256,
        screen_size_inches: 6.7,
      },
    });
    const model = buildProductSemanticModel(
      makeInput({
        currentProduct,
        inventory: [
          currentProduct,
          makeCandidate({
            slug: 'pixel-10',
            name: 'Pixel 10',
            brand: 'Google',
            price: 905_000,
            stock: 9,
            product_key_specs: {
              chipset: 'Tensor X',
              ram_gb: 12,
              storage_gb: 256,
              screen_size_inches: 6.7,
            },
          }),
          makeCandidate({
            slug: 'iphone-17-air',
            name: 'iPhone 17 Air',
            brand: 'Apple',
            price: 898_000,
            stock: 0,
            product_key_specs: {
              chipset: 'A19',
              ram_gb: 8,
              storage_gb: 128,
              screen_size_inches: 6.1,
            },
          }),
          makeCandidate({
            slug: 'used-xperia-1-vii',
            name: 'Used Xperia 1 VII',
            brand: 'Sony',
            condition: 'used',
            price: 901_000,
            stock: 9,
            product_key_specs: {
              chipset: 'Snapdragon 8 Elite',
              ram_gb: 12,
              storage_gb: 512,
              screen_size_inches: 6.7,
            },
          }),
        ],
      })
    );

    expect(model.alternatives?.cards.map((card) => card.title)).toEqual([
      'Pixel 10',
      'iPhone 17 Air',
      'Used Xperia 1 VII',
    ]);
  });

  it('returns null card sections when inventory is missing and when the current product has no brand', () => {
    const missingInventoryModel = buildProductSemanticModel(
      makeInput({
        currentProduct: makeCandidate({
          slug: 'mystery-phone',
          name: 'Mystery Phone',
          price: 250_000,
        }),
        inventory: [],
      })
    );

    expect(missingInventoryModel.supportLinks).toEqual([
      {
        href: 'https://ogabassey.com/smartphones',
        label: 'Shop more Smartphones',
      },
    ]);
    expect(missingInventoryModel.guideLinks).toEqual([]);
    expect(missingInventoryModel.alternatives).toBeNull();
    expect(missingInventoryModel.sameBrand).toBeNull();
    expect(missingInventoryModel.samePrice).toBeNull();

    const noBrandModel = buildProductSemanticModel(
      makeInput({
        currentProduct: makeCandidate({
          slug: 'house-brand-phone',
          name: 'House Brand Phone',
          price: 310_000,
          product_key_specs: { chipset: 'Custom', ram_gb: 6, storage_gb: 128 },
        }),
        inventory: [
          makeCandidate({
            slug: 'house-brand-phone',
            name: 'House Brand Phone',
            price: 310_000,
            product_key_specs: {
              chipset: 'Custom',
              ram_gb: 6,
              storage_gb: 128,
            },
          }),
          makeCandidate({
            slug: 'tecno-spark-40',
            name: 'Tecno Spark 40',
            brand: 'Tecno',
            price: 300_000,
            stock: 8,
            product_key_specs: {
              chipset: 'MediaTek',
              ram_gb: 8,
              storage_gb: 128,
            },
          }),
        ],
      })
    );

    expect(noBrandModel.sameBrand).toBeNull();
    expect(noBrandModel.guideLinks).toEqual([]);
  });
});
