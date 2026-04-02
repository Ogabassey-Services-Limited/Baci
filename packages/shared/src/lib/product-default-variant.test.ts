import {
  type ProductWithDefaultVariantLike,
  resolveDefaultVariantSelection,
  resolveVariantSelection,
} from './product-default-variant';

describe('product-default-variant', () => {
  const product: ProductWithDefaultVariantLike<{
    id: string;
    price_override: number;
    stock_quantity: number;
    attributes: {
      color: string;
      storage: string;
    };
  }> = {
    price: 120000,
    compare_at_price: 140000,
    manage_stock: true,
    variants: [
      {
        id: 'variant-256-black',
        price_override: 135000,
        stock_quantity: 2,
        attributes: { storage: '256GB', color: 'Black' },
      },
      {
        id: 'variant-128-black',
        price_override: 120000,
        stock_quantity: 5,
        attributes: { storage: '128GB', color: 'Black' },
      },
      {
        id: 'variant-128-gold',
        price_override: 120000,
        stock_quantity: 1,
        attributes: { storage: '128GB', color: 'Gold' },
      },
    ],
  };

  it('picks the cheapest in-stock variant as the default selection', () => {
    expect(resolveDefaultVariantSelection(product)).toMatchObject({
      variant: expect.objectContaining({ id: 'variant-128-black' }),
      storage: '128GB',
      color: 'Black',
      price: 120000,
    });
  });

  it('skips out-of-stock variants when resolving the default selection', () => {
    expect(
      resolveDefaultVariantSelection({
        ...product,
        variants: product.variants.map((variant, index) => ({
          ...variant,
          stock_quantity: index === 0 ? 2 : 0,
        })),
      })
    ).toMatchObject({
      variant: expect.objectContaining({ id: 'variant-256-black' }),
      storage: '256GB',
      price: 135000,
    });
  });

  it('resolves the matching variant from the selected attributes', () => {
    expect(
      resolveVariantSelection(product, {
        attributes: { storage: '128GB', color: 'Gold' },
      })
    ).toMatchObject({
      variant: expect.objectContaining({ id: 'variant-128-gold' }),
      storage: '128GB',
      color: 'Gold',
    });
  });

  it('returns null when the selected attributes do not map to a purchasable variant', () => {
    expect(
      resolveVariantSelection(product, {
        attributes: { storage: '512GB' },
      })
    ).toBeNull();
  });
});
