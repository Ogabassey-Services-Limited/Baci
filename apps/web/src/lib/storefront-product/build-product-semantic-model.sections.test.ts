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

describe('buildProductSemanticModel sections', () => {
  it('returns deterministic same-brand and same-price cards with optional compare CTAs', () => {
    const currentProduct = makeCandidate({
      slug: 'samsung-galaxy-s25',
      name: 'Samsung Galaxy S25',
      brand: 'Samsung',
      price: 900_000,
      product_key_specs: {
        chipset: 'Snapdragon 8 Elite',
        ram_gb: 12,
        storage_gb: 256,
        main_camera_mp: 50,
      },
    });
    const model = buildProductSemanticModel(
      makeInput({
        currentProduct,
        inventory: [
          currentProduct,
          makeCandidate({
            slug: 'samsung-galaxy-s24',
            name: 'Samsung Galaxy S24',
            brand: 'Samsung',
            price: 850_000,
            stock: 4,
            product_key_specs: {
              chipset: 'Snapdragon 8 Gen 3',
              ram_gb: 8,
              storage_gb: 512,
              main_camera_mp: 12,
            },
          }),
          makeCandidate({
            slug: 'samsung-galaxy-a56',
            name: 'Samsung Galaxy A56',
            brand: 'Samsung',
            price: 470_000,
            stock: 9,
            product_key_specs: {
              chipset: 'Exynos',
              ram_gb: 8,
              storage_gb: 128,
            },
          }),
          makeCandidate({
            slug: 'iphone-17-air',
            name: 'iPhone 17 Air',
            brand: 'Apple',
            price: 890_000,
            stock: 7,
            product_key_specs: {
              chipset: 'A19',
              ram_gb: 8,
              storage_gb: 256,
              main_camera_mp: 48,
            },
          }),
          makeCandidate({
            slug: 'pixel-10-pro',
            name: 'Pixel 10 Pro',
            brand: 'Google',
            price: 910_000,
            stock: 6,
            product_key_specs: {
              chipset: 'Tensor X',
              ram_gb: 12,
              storage_gb: 256,
            },
          }),
          makeCandidate({
            slug: 'oneplus-14',
            name: 'OnePlus 14',
            brand: 'OnePlus',
            price: 1_050_000,
            stock: 8,
            product_key_specs: {
              chipset: 'Snapdragon 8 Elite',
              ram_gb: 16,
              storage_gb: 512,
            },
          }),
        ],
      })
    );

    expect(model.sameBrand?.heading).toBe('More phones from this brand');
    expect(model.sameBrand?.cards[0].href).toBe(
      'https://ogabassey.com/smartphones/samsung-galaxy-s24'
    );
    expect(model.sameBrand?.cards[0].secondaryHref).toBe(
      'https://ogabassey.com/smartphones/compare/samsung-galaxy-s24-vs-samsung-galaxy-s25'
    );
    expect(model.samePrice?.heading).toBe('More phones in this price range');
    expect(model.samePrice?.cards[0].title).toBe('iPhone 17 Air');
    expect(model.samePrice?.cards[0].secondaryLabel).toMatch(/Compare with/i);
  });

  it('builds bounded trust bullets from supported condition and price-band facts', () => {
    const currentProduct = makeCandidate({
      slug: 'iphone-17-pro-max',
      name: 'iPhone 17 Pro Max',
      brand: 'Apple',
      price: 495_000,
      stock: 6,
      product_key_specs: { chipset: 'A19 Pro', ram_gb: 8, storage_gb: 256 },
    });
    const model = buildProductSemanticModel(
      makeInput({
        currentProduct,
        inventory: [
          currentProduct,
          makeCandidate({
            slug: 'galaxy-a56',
            name: 'Galaxy A56',
            brand: 'Samsung',
            price: 410_000,
            stock: 9,
            product_key_specs: {
              chipset: 'Exynos',
              ram_gb: 8,
              storage_gb: 128,
            },
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
        ],
      })
    );

    expect(model.trustBullets).toEqual(
      expect.arrayContaining([
        'Available in New condition',
        'Listed in Best Smartphones Under ₦500,000',
      ])
    );
    expect(model.trustBullets.join(' ')).not.toMatch(
      /warranty|returns|delivery/i
    );
  });
});
