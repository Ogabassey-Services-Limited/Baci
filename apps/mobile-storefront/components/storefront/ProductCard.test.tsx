import { resolveDefaultVariantSelection } from '@baci/shared/lib';
import { resolveCartItemImageUrl } from '@/lib/cart-display';

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
   * This mirrors the actual implementation after the default-variant update.
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
    manage_stock?: boolean;
    variants?: Array<{
      id: string;
      name?: string;
      price?: number;
      price_override?: number;
      stock_quantity?: number;
      attributes?: Record<string, string>;
      image?: string;
      images?: string[];
    }>;
  }) {
    const defaultVariantSelection = resolveDefaultVariantSelection(product);

    if (product.has_variants && !defaultVariantSelection) {
      mockPush(`/product/${product.slug}`);
      return;
    }

    mockHapticsLight();
    mockAddItem({
      product_id: product.id,
      slug: product.slug,
      name: product.name,
      variant_id: defaultVariantSelection?.variant.id,
      variant_attributes: defaultVariantSelection?.attributes,
      price: defaultVariantSelection?.price ?? product.price,
      compare_at_price:
        defaultVariantSelection?.compareAtPrice ?? product.compare_at_price,
      quantity: 1,
      image_url: resolveCartItemImageUrl({
        variantImageUrl: defaultVariantSelection?.variant.image,
        variantImages: defaultVariantSelection?.variant.images,
        fallbackImageUrl: product.image,
      }),
      condition: product.condition,
      color: defaultVariantSelection?.color,
      storage: defaultVariantSelection?.storage,
      variant_name: defaultVariantSelection?.variant.name,
    });
  }

  it('adds the cheapest available variant directly when a default variant can be resolved', () => {
    simulateHandleAddToCart({
      id: 'prod-1',
      slug: 'redmi-note-14',
      name: 'Redmi Note 14',
      price: 220000,
      has_variants: true,
      manage_stock: true,
      variants: [
        {
          id: 'variant-256gb',
          name: '256GB',
          price_override: 260000,
          stock_quantity: 4,
          attributes: { storage: '256GB' },
        },
        {
          id: 'variant-128gb',
          name: '128GB',
          price_override: 220000,
          stock_quantity: 6,
          attributes: { storage: '128GB' },
        },
      ],
    });

    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: 'prod-1',
        variant_id: 'variant-128gb',
        storage: '128GB',
        price: 220000,
      })
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockHapticsLight).toHaveBeenCalled();
  });

  it('navigates to product detail when has_variants is true but no purchasable default exists', () => {
    simulateHandleAddToCart({
      id: 'prod-1',
      slug: 'macbook-air-m1',
      name: 'MacBook Air M1',
      price: 720000,
      has_variants: true,
      manage_stock: true,
      variants: [
        {
          id: 'variant-256gb',
          name: '256GB',
          price_override: 720000,
          stock_quantity: 0,
          attributes: { storage: '256GB' },
        },
      ],
    });

    expect(mockPush).toHaveBeenCalledWith('/product/macbook-air-m1');
    expect(mockAddItem).not.toHaveBeenCalled();
    expect(mockHapticsLight).not.toHaveBeenCalled();
  });

  it('falls back to the card image when the default variant has no dedicated image', () => {
    const product = {
      id: 'prod-4',
      slug: 'redmi-pad',
      name: 'Redmi Pad',
      price: 180000,
      image: 'https://cdn.example.com/redmi-pad-card.jpg',
      condition: 'New',
      has_variants: true,
      manage_stock: true,
      variants: [
        {
          id: 'variant-128gb',
          name: '128GB',
          price_override: 180000,
          stock_quantity: 3,
          image: undefined,
          images: undefined,
          attributes: { storage: '128GB' },
        },
      ],
    };

    simulateHandleAddToCart(product);

    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        image_url: 'https://cdn.example.com/redmi-pad-card.jpg',
      })
    );
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
