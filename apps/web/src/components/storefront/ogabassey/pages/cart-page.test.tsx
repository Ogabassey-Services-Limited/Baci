import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

vi.mock('@/lib/feature-flags', () => ({
  hasPriceNegotiationEntitlement: vi.fn(() => true),
}));

let mockMerchant: { id: string; slug: string } | null = {
  id: 'merchant-abc',
  slug: 'test-store',
};

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () =>
    mockMerchant
      ? { merchant: mockMerchant, basePath: `/${mockMerchant.slug}` }
      : null,
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuthSafe: () => ({ user: null }),
}));

const mockApplyNegotiatedPrice = vi.fn();
const mockApplyCartWideNegotiation = vi.fn();
const mockClearNegotiatedPrice = vi.fn();

type MockCartItem = {
  id: string;
  cartItemId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  category: string;
  brand: string;
  negotiatedPrice?: number;
  negotiationStatus?: 'accepted';
  quizAwardId?: string;
  quizVoucherToken?: string;
};

let mockCartItems: MockCartItem[] = [
  {
    id: 'p1',
    cartItemId: 'ci-1',
    name: 'Test Gadget',
    price: 25000,
    quantity: 1,
    image: '/gadget.jpg',
    category: 'electronics',
    brand: 'Brand',
    negotiatedPrice: 20000,
    negotiationStatus: 'accepted' as const,
  },
];

vi.mock('@/hooks/cart', () => ({
  useCart: () => ({
    cart: mockCartItems,
    removeFromCart: vi.fn(),
    updateQuantity: vi.fn(),
    applyNegotiatedPrice: mockApplyNegotiatedPrice,
    applyCartWideNegotiation: mockApplyCartWideNegotiation,
    clearNegotiatedPrice: mockClearNegotiatedPrice,
    toggleAssurance: vi.fn(),
    cartTotal: 20000,
    merchantSlug: 'test-store',
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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

vi.mock('@/components/storefront/cdn-format-image', () => ({
  CdnFormatImage: (props: Record<string, unknown>) => (
    <img
      {...Object.fromEntries(
        Object.entries(props).filter(
          ([key]) => key !== 'fill' && key !== 'preload',
        ),
      )}
      alt={String(props.alt || '')}
    />
  ),
}));

vi.mock('../components/AdUnit', () => ({
  AdUnit: () => <div data-testid="ad-unit" />,
}));

vi.mock('../components/empty-state', () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}));

vi.mock('../components/CheckoutIdentityModal', () => ({
  CheckoutIdentityModal: () => null,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }),
  }),
}));

// ── Import after mocks ──────────────────────────────────────────────────────

import { hasPriceNegotiationEntitlement } from '@/lib/feature-flags';
import { CartPage } from './cart-page';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CartPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasPriceNegotiationEntitlement).mockReturnValue(true);
    mockMerchant = { id: 'merchant-abc', slug: 'test-store' };
    mockCartItems = [
      {
        id: 'p1',
        cartItemId: 'ci-1',
        name: 'Test Gadget',
        price: 25000,
        quantity: 1,
        image: '/gadget.jpg',
        category: 'electronics',
        brand: 'Brand',
        negotiatedPrice: 20000,
        negotiationStatus: 'accepted' as const,
      },
    ];
  });

  it('renders cart items', () => {
    render(<CartPage />);
    expect(screen.getByText('Test Gadget')).toBeInTheDocument();
  });

  it('does not render a stray continue-shopping link in the page header', () => {
    render(<CartPage />);

    expect(
      screen.queryByRole('link', { name: 'Continue Shopping' })
    ).not.toBeInTheDocument();
  });

  it('renders the cart-specific empty state when no items are in the cart', () => {
    mockCartItems = [];

    render(<CartPage />);

    expect(
      screen.getByRole('heading', { name: 'Your cart is empty' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Add phones, accessories, or repair services/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/currently not available/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /start shopping/i })
    ).toHaveAttribute('href', '/test-store');
    expect(
      screen.getByRole('link', { name: 'Browse smartphones' })
    ).toHaveAttribute('href', '/test-store/smartphones');
  });

  it('links cart items to canonical product routes', () => {
    render(<CartPage />);
    expect(screen.getAllByRole('link', { name: /test gadget/i })[0]).toHaveAttribute(
      'href',
      '/test-store/electronics/test-gadget'
    );
  });

  it('renders negotiate total button', () => {
    render(<CartPage />);
    expect(
      screen.getByRole('button', { name: /negotiate total/i })
    ).toBeInTheDocument();
  });

  it('opens negotiation modal with correct type when negotiate total is clicked', () => {
    // The fixture has an individual offer, so a whole-cart negotiation must
    // confirm clearing it first before the modal opens.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<CartPage />);
    fireEvent.click(
      screen.getByRole('button', { name: /negotiate total/i })
    );
    expect(confirmSpy).toHaveBeenCalled();
    expect(mockClearNegotiatedPrice).toHaveBeenCalledWith('ci-1');
    expect(screen.getByPlaceholderText('Enter amount...')).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('does not open negotiation modal when merchant is unavailable', () => {
    mockMerchant = null;
    render(<CartPage />);
    const negotiateBtn = screen.getByRole('button', {
      name: /negotiate total/i,
    });
    fireEvent.click(negotiateBtn);
    expect(
      screen.queryByPlaceholderText('Enter amount...')
    ).not.toBeInTheDocument();
  });

  it('hides negotiation controls and ignores negotiated price when not entitled', () => {
    vi.mocked(hasPriceNegotiationEntitlement).mockReturnValue(false);
    render(<CartPage />);

    // Should not render Negotiate Total button
    expect(
      screen.queryByRole('button', { name: /negotiate total/i })
    ).not.toBeInTheDocument();

    // Should display original subtotal (25000) instead of negotiated (20000)
    expect(screen.getAllByText('₦25,000')[0]).toBeInTheDocument();
    expect(screen.queryByText('₦20,000')).not.toBeInTheDocument();
    expect(screen.queryByText(/matched @/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^negotiate$/i })
    ).not.toBeInTheDocument();
  });

  it('hides item and total negotiation for best-price cart lines', () => {
    vi.mocked(hasPriceNegotiationEntitlement).mockReturnValue(true);
    mockCartItems = [
      {
        id: 'p1',
        cartItemId: 'ci-1',
        name: 'Tecno Spark 50',
        price: 120000,
        quantity: 1,
        image: '/tecno.jpg',
        category: 'electronics',
        brand: 'Tecno',
      },
    ];

    render(<CartPage />);

    expect(
      screen.queryByRole('button', { name: /^negotiate$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /negotiate total/i })
    ).not.toBeInTheDocument();
  });

  it('shows signed quiz voucher items as free gifts in the cart total', () => {
    mockCartItems = [
      {
        id: 'p1',
        cartItemId: 'ci-1',
        name: 'Paid Gadget',
        price: 25000,
        quantity: 1,
        image: '/gadget.jpg',
        category: 'electronics',
        brand: 'Brand',
      },
      {
        id: 'gift-1',
        cartItemId: 'gift-1::quiz',
        name: 'Quiz Gift',
        price: 205000,
        quantity: 1,
        image: '/gift.jpg',
        category: 'phones',
        brand: 'Tecno',
        quizAwardId: 'award-1',
        quizVoucherToken: 'signed-token',
      },
    ];

    render(<CartPage />);

    expect(screen.getByText('Quiz Gift')).toBeInTheDocument();
    expect(screen.getByText('Free gift')).toBeInTheDocument();
    expect(screen.getAllByText('₦25,000')[0]).toBeInTheDocument();
    expect(screen.queryByText('₦230,000')).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /^negotiate$/i })
    ).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: /negotiate total/i })
    ).toBeInTheDocument();
  });
});
