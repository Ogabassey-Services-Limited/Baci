import { renderHook } from '@testing-library/react-native';
import type { Product, ProductVariant } from '@/types/product';
import { useEffectivePrice } from '@/hooks/use-effective-price';

const product: Product = {
  id: 'product-1',
  name: 'Galaxy Z Fold 6',
  slug: 'galaxy-z-fold-6',
  description: 'Phone',
  price: 900000,
  compare_at_price: 950000,
  image: 'https://cdn.example.com/fold.png',
  images: ['https://cdn.example.com/fold.png'],
  condition: 'New',
  has_condition_offers: true,
  offers: [
    {
      id: 'offer-used',
      condition: 'used',
      price: 700000,
      compare_at_price: 750000,
    },
  ],
  variants: [
    {
      id: 'variant-esim',
      name: '512GB / eSIM Only',
      price: 970000,
      price_override: 980000,
      stock_quantity: 2,
      attributes: {
        storage: '512GB',
        sim_type: 'eSIM Only',
      },
    },
  ],
};

describe('useEffectivePrice', () => {
  const selectedVariant = (() => {
    const variant = product.variants?.[0];
    if (!variant) {
      throw new Error('Expected useEffectivePrice fixture to include a variant');
    }

    return variant as ProductVariant;
  })();

  it('uses the selected variant pricing when a unique variant is resolved', () => {
    const { result } = renderHook(() =>
      useEffectivePrice(product, selectedVariant, null, null)
    );

    expect(result.current).toEqual({
      price: 980000,
      comparePrice: undefined,
    });
  });

  it('uses variant pricing and clears compare price for a matching condition offer', () => {
    const { result } = renderHook(() =>
      useEffectivePrice(product, selectedVariant, 'used', null)
    );

    expect(result.current).toEqual({
      price: 980000,
      comparePrice: undefined,
    });
  });

  it('prefers a negotiated price when one exists', () => {
    const { result } = renderHook(() =>
      useEffectivePrice(product, selectedVariant, null, 650000)
    );

    expect(result.current).toEqual({
      price: 650000,
      comparePrice: undefined,
    });
  });

  it('clears compare price when negotiated pricing overrides the base product', () => {
    const { result } = renderHook(() =>
      useEffectivePrice(product, null, null, 650000)
    );

    expect(result.current).toEqual({
      price: 650000,
      comparePrice: undefined,
    });
  });

  it('falls back to the base product pricing when no variant is selected', () => {
    const { result } = renderHook(() =>
      useEffectivePrice(product, null, null, null)
    );

    expect(result.current).toEqual({
      price: 900000,
      comparePrice: 950000,
    });
  });

  it('keeps base pricing when the selected condition has no matching offer', () => {
    const { result } = renderHook(() =>
      useEffectivePrice(product, selectedVariant, 'new', null)
    );

    expect(result.current).toEqual({
      price: 980000,
      comparePrice: undefined,
    });
  });

  it('negotiated price overrides the final price and compare price stays cleared', () => {
    const { result } = renderHook(() =>
      useEffectivePrice(product, selectedVariant, 'used', 640000)
    );

    expect(result.current).toEqual({
      price: 640000,
      comparePrice: undefined,
    });
  });

  it('falls back to product price when a selected variant has no override', () => {
    // When price_override is missing, useEffectivePrice falls back to
    // product.price instead of variant.price.
    const variantWithoutOverride: ProductVariant = {
      id: 'variant-no-override',
      name: selectedVariant.name,
      price: selectedVariant.price,
      stock_quantity: selectedVariant.stock_quantity,
      attributes: selectedVariant.attributes,
    };

    const { result } = renderHook(() =>
      useEffectivePrice(product, variantWithoutOverride, null, null)
    );

    expect(result.current).toEqual({
      price: 900000,
      comparePrice: 950000,
    });
  });

  it('returns undefined compare price when the product has no compare-at price', () => {
    const { result } = renderHook(() =>
      useEffectivePrice(
        {
          ...product,
          compare_at_price: undefined,
        },
        selectedVariant,
        null,
        null
      )
    );

    expect(result.current).toEqual({
      price: 980000,
      comparePrice: undefined,
    });
  });

  it('treats negotiated price 0 as a valid override', () => {
    const { result } = renderHook(() =>
      useEffectivePrice(product, selectedVariant, 'used', 0)
    );

    expect(result.current).toEqual({
      price: 0,
      comparePrice: undefined,
    });
  });

  it('clamps negative variant-derived prices to zero', () => {
    const { result } = renderHook(() =>
      useEffectivePrice(
        product,
        {
          ...selectedVariant,
          price_override: -1,
        },
        null,
        null
      )
    );

    expect(result.current).toEqual({
      price: 0,
      comparePrice: undefined,
    });
  });
});
