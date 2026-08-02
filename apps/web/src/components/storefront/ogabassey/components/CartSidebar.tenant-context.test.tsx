import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockMerchant: {
  id: string;
  slug: string;
  vat_registration_status?: 'registered';
  vat_rate?: number;
  feature_settings?: { shipping_insurance_enabled?: boolean };
} | null = null;
let mockCartMerchantSlug: string | null = null;

const mockSetIsCartOpen = vi.fn();
const mockRouterPush = vi.fn();

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => ({
    merchant: mockMerchant,
    basePath: mockMerchant ? `/${mockMerchant.slug}` : '/ogabassey',
  }),
}));

vi.mock('@/hooks/cart', () => ({
  useCart: () => ({
    isCartOpen: true,
    setIsCartOpen: mockSetIsCartOpen,
    cart: [
      {
        id: 'p1',
        cartItemId: 'ci-1',
        name: 'Test Shoe',
        price: 15000,
        quantity: 1,
        image: '/shoe.jpg',
        category: 'shoes',
        brand: 'TestBrand',
        negotiatedPrice: 10000,
        negotiationStatus: 'accepted',
      },
    ],
    merchantSlug: mockCartMerchantSlug,
    removeFromCart: vi.fn(),
    updateQuantity: vi.fn(),
    applyNegotiatedPrice: vi.fn(),
    applyCartWideNegotiation: vi.fn(),
    clearNegotiatedPrice: vi.fn(),
    toggleAssurance: vi.fn(),
  }),
}));

vi.mock('@/lib/storefront-price-negotiation', () => ({
  hasStorefrontPriceNegotiation: vi.fn(() => true),
}));

vi.mock('@/lib/analytics', () => ({
  analytics: { viewCart: vi.fn() },
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (path: string) => path,
}));

vi.mock('@/lib/storefront-product-href', () => ({
  getStorefrontProductHref: () => '/shoes/test-shoe',
}));

vi.mock('@/lib/checkout/cart-entitlement-sanitizer', () => ({
  calculateCartTotal: (items: Array<{ price: number; quantity: number }>) =>
    items.reduce((total, item) => total + item.price * item.quantity, 0),
  getCartItemCheckoutUnitPrice: (item: { price: number }) => item.price,
  isQuizVoucherCartItem: () => false,
  sanitizeCartItems: (items: unknown[]) => items,
}));

vi.mock('@baci/shared/lib', () => ({
  isProductNegotiable: () => true,
}));

vi.mock('@/components/storefront/cdn-format-image', () => ({
  CdnFormatImage: (props: Record<string, unknown>) => {
    const { fill: _fill, ...rest } = props;
    return <img {...rest} alt={String(props.alt || '')} />;
  },
}));

vi.mock('./AdUnit', () => ({ AdUnit: () => null }));
vi.mock('./empty-state', () => ({ EmptyState: () => null }));
vi.mock('./NegotiationModal', () => ({
  NegotiationModal: () => null,
  deriveCartLineNegotiationProps: () => ({}),
}));
vi.mock('../lib/cart-total-negotiation', () => ({
  runCartTotalNegotiation: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: { children: React.ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CartSidebar } from './CartSidebar';

describe('CartSidebar tenant context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMerchant = {
      id: 'host-merchant',
      slug: 'ogabassey',
      vat_registration_status: 'registered',
      vat_rate: 20,
      feature_settings: { shipping_insurance_enabled: true },
    };
    mockCartMerchantSlug = 'winter-store';
  });

  it('hides host-scoped negotiation and assurance actions for another cart merchant', () => {
    render(<CartSidebar />);

    expect(
      screen.queryByRole('button', { name: /negotiate total amount/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^negotiate$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/assurance|protection/i)).not.toBeInTheDocument();
  });
});
