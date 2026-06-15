import type { SantaAction } from '@baci/shared/lib';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockAddItem = jest.fn();
const mockShowCartToast = jest.fn();
const mockAbortSignal = new AbortController().signal;

jest.mock('@/stores/cart-store', () => ({
  useCartStore: { getState: () => ({ addItem: mockAddItem }) },
}));

jest.mock('@/hooks/cart-notifications', () => ({
  showCartToast: (...args: unknown[]) => mockShowCartToast(...args),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  }),
}));

jest.mock('./constants', () => ({
  API_BASE_URL: 'https://test.example',
  CHAT_REQUEST_TIMEOUT_MS: 1000,
}));

import { addSantaWishToCart } from './santa-cart';

const action: SantaAction = {
  type: 'ADD_TO_CART',
  productName: 'iPhone 15',
  price: 800_000,
};

function mockLookup(product: unknown, ok = true, status = 200) {
  global.fetch = jest.fn(async () => ({
    ok,
    status,
    json: async () => ({ product }),
  })) as unknown as typeof fetch;
}

describe('addSantaWishToCart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds a real product and applies the granted price as a negotiated price', async () => {
    mockLookup({
      id: 'prod-1',
      name: 'iPhone 15',
      price: 950_000,
      image: 'https://img/iphone.jpg',
      manage_stock: true,
      stock: 5,
    });

    const result = await addSantaWishToCart(action);

    expect(result).toBe(true);
    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: 'prod-1',
        name: 'iPhone 15',
        price: 950_000,
        quantity: 1,
        image_url: 'https://img/iphone.jpg',
        max_quantity: 5,
        negotiatedPrice: 800_000,
        negotiationStatus: 'accepted',
      })
    );
    expect(mockShowCartToast).toHaveBeenCalledWith(
      expect.stringContaining('iPhone 15'),
      'success'
    );
  });

  it('adds a synthetic (catalog-less) product without a stock cap or negotiated price when not cheaper', async () => {
    mockLookup({
      id: '',
      name: 'Limited Drop',
      price: 500_000,
      manage_stock: false,
      stock: 9999,
    });

    const result = await addSantaWishToCart({
      type: 'ADD_TO_CART',
      productName: 'Limited Drop',
      price: 500_000, // equal to price → not a discount
    });

    expect(result).toBe(true);
    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: '',
        price: 500_000,
        max_quantity: undefined,
        negotiatedPrice: undefined,
        negotiationStatus: undefined,
      })
    );
  });

  it('applies a free Santa grant as a negotiated price', async () => {
    mockLookup({
      id: 'prod-free',
      name: 'Free Gift',
      price: 500_000,
      manage_stock: false,
    });

    const result = await addSantaWishToCart({
      type: 'ADD_TO_CART',
      productName: 'Free Gift',
      price: 0,
    });

    expect(result).toBe(true);
    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        negotiatedPrice: 0,
        negotiationStatus: 'accepted',
      })
    );
  });

  it('passes an abort signal to the product lookup request', async () => {
    mockLookup({
      id: 'prod-1',
      name: 'iPhone 15',
      price: 950_000,
      manage_stock: false,
    });

    await addSantaWishToCart(action, mockAbortSignal);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: mockAbortSignal })
    );
  });

  it('rejects malformed product lookup responses', async () => {
    mockLookup({ id: 'prod-1', name: 'iPhone 15', price: '950000' });

    const result = await addSantaWishToCart(action);

    expect(result).toBe(false);
    expect(mockAddItem).not.toHaveBeenCalled();
    expect(mockShowCartToast).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('returns false and warns when the product is not found', async () => {
    mockLookup(null);

    const result = await addSantaWishToCart(action);

    expect(result).toBe(false);
    expect(mockAddItem).not.toHaveBeenCalled();
    expect(mockShowCartToast).toHaveBeenCalledWith(
      expect.stringContaining("couldn't find"),
      'error'
    );
  });

  it('returns false and surfaces an error toast when the lookup request fails', async () => {
    mockLookup(null, false, 500);

    const result = await addSantaWishToCart(action);

    expect(result).toBe(false);
    expect(mockAddItem).not.toHaveBeenCalled();
    expect(mockShowCartToast).toHaveBeenCalledWith(expect.any(String), 'error');
  });
});
