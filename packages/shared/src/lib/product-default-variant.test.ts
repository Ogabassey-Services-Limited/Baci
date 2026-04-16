import {
  getVariantConditionOptions,
  hasVariantConditionAxis,
  type ProductWithDefaultVariantLike,
  resolveDefaultVariantSelection,
  resolveVariantDisplaySelection,
  resolveVariantSelection,
} from './product-default-variant';

describe('product-default-variant', () => {
  type ConditionedVariant = {
    id: string;
    condition?: string;
    price_override: number;
    stock_quantity: number;
    attributes: Record<string, string>;
  };

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
  const variants = product.variants ?? [];

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
        variants: variants.map((variant, index) => ({
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

  it('treats variant conditions as a first-class selection axis when present', () => {
    const conditionedProduct: ProductWithDefaultVariantLike<ConditionedVariant> =
      {
        price: 550000,
        condition: 'new',
        manage_stock: true,
        variants: [
          {
            id: 'new-wifi-128',
            condition: 'new',
            price_override: 550000,
            stock_quantity: 1,
            attributes: { storage: '128GB', connectivity: 'WiFi' },
          },
          {
            id: 'used-cellular-256',
            condition: 'used',
            price_override: 600000,
            stock_quantity: 1,
            attributes: {
              storage: '256GB',
              connectivity: 'WiFi + Cellular',
            },
          },
        ],
      };

    expect(hasVariantConditionAxis(conditionedProduct)).toBe(true);
    const conditionOptions = getVariantConditionOptions(conditionedProduct);
    expect(conditionOptions).toHaveLength(2);
    expect(conditionOptions).toEqual(expect.arrayContaining(['new', 'used']));
    expect(
      resolveVariantSelection(conditionedProduct, {
        condition: 'used',
        attributes: {
          storage: '256GB',
          connectivity: 'WiFi + Cellular',
        },
      })
    ).toMatchObject({
      condition: 'used',
      variant: expect.objectContaining({ id: 'used-cellular-256' }),
      price: 600000,
    });
  });

  it('returns null for attribute-only matches that are ambiguous across conditions', () => {
    const conditionedProduct: ProductWithDefaultVariantLike<ConditionedVariant> =
      {
        price: 550000,
        condition: 'new',
        manage_stock: true,
        variants: [
          {
            id: 'new-wifi-128',
            condition: 'new',
            price_override: 550000,
            stock_quantity: 1,
            attributes: { storage: '128GB', connectivity: 'WiFi' },
          },
          {
            id: 'used-wifi-128',
            condition: 'used',
            price_override: 500000,
            stock_quantity: 1,
            attributes: { storage: '128GB', connectivity: 'WiFi' },
          },
        ],
      };

    expect(
      resolveVariantSelection(conditionedProduct, {
        attributes: { storage: '128GB', connectivity: 'WiFi' },
      })
    ).toBeNull();
  });

  it('resolves condition-only requests to the cheapest purchasable variant in that condition', () => {
    const conditionedProduct: ProductWithDefaultVariantLike<ConditionedVariant> =
      {
        price: 550000,
        condition: 'new',
        manage_stock: true,
        variants: [
          {
            id: 'used-cellular',
            condition: 'used',
            price_override: 600000,
            stock_quantity: 2,
            attributes: { connectivity: 'WiFi + Cellular' },
          },
          {
            id: 'used-wifi',
            condition: 'used',
            price_override: 500000,
            stock_quantity: 4,
            attributes: { connectivity: 'WiFi' },
          },
        ],
      };

    expect(
      resolveVariantSelection(conditionedProduct, {
        condition: 'used',
      })
    ).toMatchObject({
      condition: 'used',
      variant: expect.objectContaining({ id: 'used-wifi' }),
      price: 500000,
    });
  });

  it('lets display resolution return an out-of-stock exact variant while purchasable resolution rejects it', () => {
    const conditionedProduct: ProductWithDefaultVariantLike<{
      id: string;
      condition?: string;
      price_override: number;
      stock_quantity: number;
      attributes: {
        connectivity: string;
        storage: string;
      };
    }> = {
      price: 550000,
      condition: 'new',
      manage_stock: true,
      variants: [
        {
          id: 'new-wifi-128',
          condition: 'new',
          price_override: 550000,
          stock_quantity: 0,
          attributes: { storage: '128GB', connectivity: 'WiFi' },
        },
      ],
    };

    expect(
      resolveVariantDisplaySelection(conditionedProduct, {
        variantId: 'new-wifi-128',
      })
    ).toMatchObject({
      condition: 'new',
      variant: expect.objectContaining({ id: 'new-wifi-128' }),
    });
    expect(
      resolveVariantSelection(conditionedProduct, {
        variantId: 'new-wifi-128',
      })
    ).toBeNull();
  });
});
