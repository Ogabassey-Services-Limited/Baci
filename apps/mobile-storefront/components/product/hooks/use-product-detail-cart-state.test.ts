import { renderHook } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { useProductDetailCartState } from './use-product-detail-cart-state';

const mockCartStoreState = {
  addItem: jest.fn(),
  items: [],
  removeItem: jest.fn(),
  updateQuantity: jest.fn(),
};

jest.mock('@/stores/cart-store', () => ({
  useCartStore: (
    selector: (state: typeof mockCartStoreState) => unknown
  ): unknown => selector(mockCartStoreState),
}));

describe('useProductDetailCartState', () => {
  it('uses an attribute-backed condition before the display fallback', () => {
    const { result } = renderHook(() =>
      useProductDetailCartState({
        currentVariantDisplaySelection: { condition: 'new' },
        effectiveSelectedAttributes: { condition: 'open_box' },
        effectiveSelectedColor: null,
        effectiveSelectedStorage: null,
        effectiveSelectedVariantId: 'open-box-256',
        offerConditionKey: null,
        product: {
          condition: 'new',
          id: 'product-1',
        },
      } as never)
    );

    expect(result.current.getConditionDisplay()).toBe('Open Box');
  });
});
