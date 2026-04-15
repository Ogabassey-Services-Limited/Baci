import { render, screen, waitFor } from '@testing-library/react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import ProductDetailClient from './product-detail-client';

const mockUseSearchParams = vi.fn(() => new URLSearchParams());
const mockAddToCart = vi.fn();
const mockSetMerchantSlug = vi.fn();
const mockStickyAddToCart = vi.fn((_props: unknown) => null);

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <div data-alt={alt} data-src={src} />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

vi.mock('@/components/storefront/breadcrumbs', () => ({
  Breadcrumbs: () => null,
}));

vi.mock('@/components/storefront/sticky-add-to-cart', () => ({
  StickyAddToCart: (props: unknown) => {
    mockStickyAddToCart(props);
    return null;
  },
}));

vi.mock('@/components/themed', () => ({
  ThemedBadge: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ThemedButton: ({
    children,
    colorRole: _colorRole,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { colorRole?: string }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => null,
}));

vi.mock('@/hooks/use-cart', () => ({
  useCart: () => ({
    addToCart: mockAddToCart,
    cart: [],
    setMerchantSlug: mockSetMerchantSlug,
    updateQuantity: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-currency', () => ({
  useCurrency: () => ({
    currencyCode: 'NGN',
    formatCurrency: (amount: number) => `₦${amount}`,
  }),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchant: () => ({
    basePath: '',
    merchant: { id: 'merchant-1', slug: 'teststore' },
  }),
}));

vi.mock('@/hooks/use-recently-viewed', () => ({
  useRecentlyViewed: () => ({
    addToRecentlyViewed: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/event-tracking', () => ({
  trackEvent: {
    addToCart: vi.fn(),
    productView: vi.fn(),
  },
}));

function makeBaseProduct(): Product {
  return {
    id: 'product-1',
    name: 'iPad 11th Gen',
    description: 'Tablet',
    status: 'active',
    price: 550000,
    manage_stock: true,
    stock: 10,
    image: '/ipad.jpg',
    imageLarge: '/ipad.jpg',
    imageHint: 'ipad',
    brand: 'Apple',
    gtin: '',
    mpn: '',
    slug: 'ipad-11th-gen',
    condition: 'new',
    category: 'Tablets',
    category_slug: 'tablets',
  };
}

describe('ProductDetailClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
  });

  it('hydrates the exact conditioned variant from recognized route params', async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams(
        'condition=used&storage=256GB&connectivity=WiFi%2BCellular&utm_source=google'
      )
    );

    const product: Product = {
      ...makeBaseProduct(),
      has_variants: true,
      variants: [
        {
          id: 'variant-new-128',
          product_id: 'product-1',
          merchant_id: 'merchant-1',
          attributes: {
            connectivity: 'WiFi',
            storage: '128GB',
          },
          condition: 'new',
          price_override: 550000,
          stock_quantity: 5,
        },
        {
          id: 'variant-used-256',
          product_id: 'product-1',
          merchant_id: 'merchant-1',
          attributes: {
            connectivity: 'WiFi+Cellular',
            storage: '256GB',
          },
          condition: 'used',
          price_override: 600000,
          stock_quantity: 3,
        },
      ],
    };

    render(<ProductDetailClient product={product} />);

    await waitFor(() => {
      expect(mockStickyAddToCart).toHaveBeenLastCalledWith(
        expect.objectContaining({
          selectedCondition: 'used',
          selectedPrice: 600000,
          selectedVariant: expect.objectContaining({ id: 'variant-used-256' }),
        })
      );
    });

    expect(screen.getByText('₦600000')).toBeInTheDocument();
  });

  it('keeps legacy offer selection driven by the condition query param', async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams('condition=used&utm_source=google')
    );

    const product: Product = {
      ...makeBaseProduct(),
      has_condition_offers: true,
      offers: [
        {
          id: 'offer-used',
          condition: 'used',
          price: 400000,
          stock_quantity: 2,
        },
      ],
    };

    render(<ProductDetailClient product={product} />);

    await waitFor(() => {
      expect(mockStickyAddToCart).toHaveBeenLastCalledWith(
        expect.objectContaining({
          selectedCondition: 'used',
          selectedPrice: 400000,
          selectedVariant: null,
        })
      );
    });

    expect(screen.getByText('₦400000')).toBeInTheDocument();
  });
});
