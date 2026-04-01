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

let mockMerchant: { id: string; slug: string } | null = { id: 'merchant-abc', slug: 'test-store' };

vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: () => ({
    merchant: mockMerchant,
    basePath: mockMerchant ? `/${mockMerchant.slug}` : '/test-store',
  }),
}));

const mockSetIsCartOpen = vi.fn();
const mockRemoveFromCart = vi.fn();
const mockUpdateQuantity = vi.fn();
const mockApplyNegotiatedPrice = vi.fn();
const mockApplyCartWideNegotiation = vi.fn();
const mockToggleAssurance = vi.fn();

vi.mock('@/hooks/use-cart', () => ({
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
      },
    ],
    removeFromCart: mockRemoveFromCart,
    updateQuantity: mockUpdateQuantity,
    applyNegotiatedPrice: mockApplyNegotiatedPrice,
    applyCartWideNegotiation: mockApplyCartWideNegotiation,
    toggleAssurance: mockToggleAssurance,
    cartTotal: 15000,
  }),
}));

vi.mock('@/lib/analytics', () => ({
  analytics: { viewCart: vi.fn() },
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (path: string) => path,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img {...props} alt={String(props.alt || '')} />
  ),
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

vi.mock('./AdUnit', () => ({
  AdUnit: () => <div data-testid="ad-unit" />,
}));

vi.mock('./empty-state', () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }),
  }),
}));

// ── Import after mocks ──────────────────────────────────────────────────────

import { CartSidebar } from './CartSidebar';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CartSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMerchant = { id: 'merchant-abc', slug: 'test-store' };
  });

  it('renders cart items when open', () => {
    render(<CartSidebar />);
    expect(screen.getByText('Test Shoe')).toBeInTheDocument();
  });

  it('links cart items to canonical product routes', () => {
    render(<CartSidebar />);
    expect(screen.getAllByRole('link', { name: /test shoe/i })[0]).toHaveAttribute(
      'href',
      '/test-store/shoes/test-shoe'
    );
  });

  it('renders Negotiate Total Amount button', () => {
    render(<CartSidebar />);
    expect(
      screen.getByRole('button', { name: /negotiate total amount/i })
    ).toBeInTheDocument();
  });

  it('opens negotiation modal with type=total when Negotiate Total is clicked', () => {
    render(<CartSidebar />);
    fireEvent.click(
      screen.getByRole('button', { name: /negotiate total amount/i })
    );
    // The NegotiationModal should now be visible
    expect(screen.getByPlaceholderText('Enter amount...')).toBeInTheDocument();
  });

  it('closes sidebar when X button is clicked', () => {
    render(<CartSidebar />);
    // Find close button by aria-label or the X icon
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    expect(mockSetIsCartOpen).toHaveBeenCalledWith(false);
  });

  it('does not open negotiation modal when merchant is unavailable', () => {
    mockMerchant = null;
    render(<CartSidebar />);
    const negotiateBtn = screen.getByRole('button', { name: /negotiate total amount/i });
    fireEvent.click(negotiateBtn);
    expect(screen.queryByPlaceholderText('Enter amount...')).not.toBeInTheDocument();
  });
});
