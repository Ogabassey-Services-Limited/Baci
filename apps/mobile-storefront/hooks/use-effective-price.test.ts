import { renderHook } from '@testing-library/react-native';
import type { Product } from '@/types/product';
import { useEffectivePrice } from './use-effective-price';

const baseProduct: Product = {
  id: 'product-1',
  merchant_id: 'merchant-1',
  name: 'iPhone 13 Pro',
  slug: 'iphone-13-pro',
  price: 552000,
  compare_at_price: 600000,
  image: 'https://cdn.example.com/iphone-13-pro.jpg',
  offers: [
    {
      id: 'offer-refurbished',
      condition: 'refurbished',
      price: 510000,
      compare_at_price: 560000,
      stock_quantity: 2,
    },
    {
      id: 'offer-uk-used',
      condition: 'uk_used',
      price: 495000,
      compare_at_price: 540000,
      stock_quantity: 1,
    },
  ],
};

describe('useEffectivePrice', () => {
  it('uses a legacy refurbished offer for canonical open_box selections', () => {
    const { result } = renderHook(() =>
      useEffectivePrice(baseProduct, null, 'open_box', null)
    );

    expect(result.current).toEqual({
      price: 510000,
      comparePrice: 560000,
    });
  });

  it('uses a legacy uk_used offer for canonical used selections', () => {
    const { result } = renderHook(() =>
      useEffectivePrice(baseProduct, null, 'used', null)
    );

    expect(result.current).toEqual({
      price: 495000,
      comparePrice: 540000,
    });
  });

  it('uses legacy alias selections when the selected condition is not yet canonicalized', () => {
    const { result } = renderHook(() =>
      useEffectivePrice(baseProduct, null, 'refurbished', null)
    );

    expect(result.current).toEqual({
      price: 510000,
      comparePrice: 560000,
    });
  });
});
