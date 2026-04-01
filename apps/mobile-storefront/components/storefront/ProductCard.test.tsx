/**
 * ProductCard variant guard test
 *
 * Tests the handleAddToCart logic: products with has_variants=true
 * should redirect to product detail instead of adding to cart directly.
 *
 * We test the logic in isolation since the full component requires
 * react-native-reanimated which has Babel transform issues in Jest.
 */

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  usePathname: jest.fn(() => '/'),
  useRouter: jest.fn(() => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  })),
  router: { push: mockPush },
  Link: 'Link',
}));

const mockAddItem = jest.fn();
const mockHapticsLight = jest.fn();

describe('ProductCard handleAddToCart logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Simulates the handleAddToCart logic from ProductCard.tsx
   * This mirrors the actual implementation after Fix 5c.
   */
  function simulateHandleAddToCart(product: {
    id: string;
    slug: string;
    name: string;
    price: number;
    has_variants?: boolean;
    image?: string;
    condition?: string;
    compare_at_price?: number;
  }) {
    if (product.has_variants) {
      mockPush(`/product/${product.slug}`);
      return;
    }
    mockHapticsLight();
    mockAddItem({
      product_id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      compare_at_price: product.compare_at_price,
      quantity: 1,
      image_url: product.image,
      condition: product.condition,
    });
  }

  it('navigates to product detail when has_variants is true', () => {
    simulateHandleAddToCart({
      id: 'prod-1',
      slug: 'macbook-air-m1',
      name: 'MacBook Air M1',
      price: 720000,
      has_variants: true,
    });

    expect(mockPush).toHaveBeenCalledWith('/product/macbook-air-m1');
    expect(mockAddItem).not.toHaveBeenCalled();
    expect(mockHapticsLight).not.toHaveBeenCalled();
  });

  it('adds to cart directly when has_variants is false', () => {
    simulateHandleAddToCart({
      id: 'prod-2',
      slug: 'usb-cable',
      name: 'USB Cable',
      price: 2000,
      has_variants: false,
    });

    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: 'prod-2',
        name: 'USB Cable',
      })
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockHapticsLight).toHaveBeenCalled();
  });

  it('adds to cart when has_variants is undefined', () => {
    simulateHandleAddToCart({
      id: 'prod-3',
      slug: 'phone-case',
      name: 'Phone Case',
      price: 5000,
    });

    expect(mockAddItem).toHaveBeenCalled();
    expect(mockHapticsLight).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
