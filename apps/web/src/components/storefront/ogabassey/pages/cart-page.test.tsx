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

let mockMerchant: { id: string; slug: string } | null = {
  id: 'merchant-abc',
  slug: 'test-store',
};

vi.mock('@/hooks/use-merchant', () => ({
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

vi.mock('@/hooks/cart', () => ({
  useCart: () => ({
    cart: [
      {
        id: 'p1',
        cartItemId: 'ci-1',
        name: 'Test Gadget',
        price: 25000,
        quantity: 1,
        image: '/gadget.jpg',
        category: 'electronics',
        brand: 'Brand',
      },
    ],
    removeFromCart: vi.fn(),
    updateQuantity: vi.fn(),
    applyNegotiatedPrice: mockApplyNegotiatedPrice,
    applyCartWideNegotiation: mockApplyCartWideNegotiation,
    toggleAssurance: vi.fn(),
    cartTotal: 25000,
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

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img {...props} alt={String(props.alt || '')} />
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

import { CartPage } from './cart-page';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CartPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMerchant = { id: 'merchant-abc', slug: 'test-store' };
  });

  it('renders cart items', () => {
    render(<CartPage />);
    expect(screen.getByText('Test Gadget')).toBeInTheDocument();
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
    render(<CartPage />);
    fireEvent.click(
      screen.getByRole('button', { name: /negotiate total/i })
    );
    expect(screen.getByPlaceholderText('Enter amount...')).toBeInTheDocument();
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
});
