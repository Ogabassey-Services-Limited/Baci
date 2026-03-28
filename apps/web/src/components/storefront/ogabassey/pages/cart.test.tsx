import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

const mockMerchant = { id: 'merchant-xyz', slug: 'test-store' };

vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: () => ({
    merchant: mockMerchant,
    basePath: '/test-store',
  }),
}));

const mockApplyNegotiatedPrice = vi.fn();
const mockApplyCartWideNegotiation = vi.fn();

vi.mock('@/hooks/use-cart', () => ({
  useCart: () => ({
    cart: [
      {
        id: 'p1',
        cartItemId: 'ci-1',
        name: 'Test Product',
        price: 20000,
        quantity: 2,
        image: '/product.jpg',
        category: 'electronics',
        brand: 'Brand',
      },
    ],
    removeFromCart: vi.fn(),
    updateQuantity: vi.fn(),
    applyNegotiatedPrice: mockApplyNegotiatedPrice,
    applyCartWideNegotiation: mockApplyCartWideNegotiation,
    toggleAssurance: vi.fn(),
    cartTotal: 40000,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }),
  }),
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

// ── Import after mocks ──────────────────────────────────────────────────────

import { OgabasseyV2CartPage } from './cart';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('OgabasseyV2CartPage', () => {
  it('renders cart items', () => {
    render(<OgabasseyV2CartPage storeSlug="test-store" />);
    expect(screen.getByText('Test Product')).toBeInTheDocument();
  });

  it('renders Negotiate Total button', () => {
    render(<OgabasseyV2CartPage storeSlug="test-store" />);
    expect(
      screen.getByRole('button', { name: /negotiate total/i })
    ).toBeInTheDocument();
  });

  it('opens negotiation modal when negotiate total is clicked', () => {
    render(<OgabasseyV2CartPage storeSlug="test-store" />);
    fireEvent.click(
      screen.getByRole('button', { name: /negotiate total/i })
    );
    expect(screen.getByPlaceholderText('Enter amount...')).toBeInTheDocument();
  });
});
