import type { Product } from '@/types/product';
import {
  findMatchingProductVariant,
  getMissingProductSelections,
  serializeSelectedProductAttributes,
} from '@/lib/storefront-product-selection';

function createProduct(): Product {
  return {
    id: 'product-1',
    merchant_id: 'merchant-1',
    name: 'iPhone 16',
    slug: 'iphone-16',
    description: 'Phone',
    price: 100000,
    compare_at_price: 120000,
    image: 'https://cdn.example.com/iphone.png',
    images: ['https://cdn.example.com/iphone.png'],
    condition: 'New',
    variant_attributes: {
      storage: ['128GB', '256GB'],
      sim_type: ['Physical + eSIM', 'eSIM Only'],
    },
    variants: [
      {
        id: 'variant-1',
        name: 'Black / 128GB / Physical + eSIM',
        price: 100000,
        price_override: 100000,
        stock_quantity: 4,
        attributes: {
          color: 'Black',
          storage: '128GB',
          sim_type: 'Physical + eSIM',
        },
      },
      {
        id: 'variant-2',
        name: 'Black / 256GB / Physical + eSIM',
        price: 120000,
        price_override: 120000,
        stock_quantity: 6,
        attributes: {
          color: 'Black',
          storage: '256GB',
          sim_type: 'Physical + eSIM',
        },
      },
      {
        id: 'variant-3',
        name: 'White / 128GB / eSIM Only',
        price: 110000,
        price_override: 110000,
        stock_quantity: 3,
        attributes: {
          color: 'White',
          storage: '128GB',
          sim_type: 'eSIM Only',
        },
      },
    ],
  };
}

describe('storefront-product-selection', () => {
  it('returns null when the current attribute selection still matches multiple variants', () => {
    const product = createProduct();

    expect(
      findMatchingProductVariant(product.variants, {
        storage: '128GB',
      })
    ).toBeNull();
  });

  it('returns the unique matching variant once all required axes are selected', () => {
    const product = createProduct();

    expect(
      findMatchingProductVariant(product.variants, {
        color: 'Black',
        storage: '256GB',
        sim_type: 'Physical + eSIM',
      })?.id
    ).toBe('variant-2');
  });

  it('matches variants case-insensitively without changing stored display values', () => {
    const product = createProduct();

    expect(
      findMatchingProductVariant(product.variants, {
        color: 'black',
        storage: '256gb',
        sim_type: 'physical + esim',
      })?.id
    ).toBe('variant-2');
  });

  it('reports every missing selector axis for the mobile product page', () => {
    const product = createProduct();

    expect(
      getMissingProductSelections(
        product,
        {
          storage: '128GB',
        },
        null // selectedVariantId
      )
    ).toEqual(['Color', 'SIM Type']);
  });

  it('serializes selected attributes deterministically for cart identity', () => {
    expect(
      serializeSelectedProductAttributes({
        sim_type: 'eSIM Only',
        storage: '256GB',
      })
    ).toBe('sim_type=esim%20only::storage=256gb');
    expect(
      serializeSelectedProductAttributes({
        sim_type: 'esim only',
        storage: '256gb',
      })
    ).toBe('sim_type=esim%20only::storage=256gb');
  });
});
