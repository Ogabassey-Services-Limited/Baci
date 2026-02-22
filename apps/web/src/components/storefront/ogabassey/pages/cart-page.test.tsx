import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock dependencies before importing the component
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img
      data-testid="next-image"
      {...props}
      alt={props.alt as string}
      src={props.src as string}
    />
  ),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() })),
}));

const mockUseCart = vi.fn();
vi.mock('@/hooks/use-cart', () => ({
  useCart: (...args: unknown[]) => mockUseCart(...args),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuthSafe: vi.fn(() => null),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: vi.fn(() => ({
    merchant: {
      id: 'merchant-1',
      slug: 'test-store',
      feature_settings: { shipping_insurance_enabled: false },
    },
    basePath: '/test-store',
  })),
}));

vi.mock('../components/AdUnit', () => ({
  AdUnit: () => <div data-testid="ad-unit" />,
}));

vi.mock('../components/empty-state', () => ({
  EmptyState: (props: Record<string, unknown>) => (
    <div data-testid="empty-state">{props.title as string}</div>
  ),
}));

vi.mock('../components/NegotiationModal', () => ({
  NegotiationModal: () => <div data-testid="negotiation-modal" />,
}));

vi.mock('../components/CheckoutIdentityModal', () => ({
  CheckoutIdentityModal: () => <div data-testid="checkout-identity-modal" />,
}));

import { CartPage } from './cart-page';

const makeCartItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'product-1',
  cartItemId: 'cart-item-1',
  name: 'Test Phone',
  price: 50000,
  quantity: 1,
  image: 'https://example.com/phone.jpg',
  condition: 'new' as const,
  ...overrides,
});

function setupCart(cart: ReturnType<typeof makeCartItem>[] = []) {
  mockUseCart.mockReturnValue({
    cart,
    removeFromCart: vi.fn(),
    updateQuantity: vi.fn(),
    applyNegotiatedPrice: vi.fn(),
    applyCartWideNegotiation: vi.fn(),
    toggleAssurance: vi.fn(),
    cartTotal: cart.reduce((sum, i) => sum + i.price * i.quantity, 0),
    merchantSlug: 'test-store',
  });
}

describe('CartPage', () => {
  it('renders empty state when cart is empty', () => {
    setupCart([]);
    render(<CartPage />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders cart items when cart has products', () => {
    setupCart([makeCartItem()]);
    render(<CartPage />);
    expect(screen.getByText('Test Phone')).toBeInTheDocument();
  });

  describe('CartItemImage fallback', () => {
    it('renders Image with valid src when product has an image', () => {
      setupCart([makeCartItem({ image: 'https://example.com/phone.jpg' })]);
      render(<CartPage />);

      const img = screen.getByRole('img', { name: 'Test Phone' });
      expect(img).toHaveAttribute('src', 'https://example.com/phone.jpg');
    });

    it('renders Image with placeholder when product image is null', () => {
      setupCart([makeCartItem({ image: null })]);
      render(<CartPage />);

      const img = screen.getByRole('img', { name: 'Test Phone' });
      expect(img).toHaveAttribute('src', '/placeholder.png');
    });

    it('renders Image with placeholder when product image is empty string', () => {
      setupCart([makeCartItem({ image: '' })]);
      render(<CartPage />);

      const img = screen.getByRole('img', { name: 'Test Phone' });
      expect(img).toHaveAttribute('src', '/placeholder.png');
    });

    it('falls back to placeholder on image load error', () => {
      setupCart([makeCartItem({ image: 'https://example.com/broken.jpg' })]);
      render(<CartPage />);

      const img = screen.getByRole('img', { name: 'Test Phone' });
      expect(img).toHaveAttribute('src', 'https://example.com/broken.jpg');

      fireEvent.error(img);

      expect(img).toHaveAttribute('src', '/placeholder.png');
    });

    it('does not loop when placeholder itself triggers onError', () => {
      setupCart([makeCartItem({ image: null })]);
      render(<CartPage />);

      const img = screen.getByRole('img', { name: 'Test Phone' });
      expect(img).toHaveAttribute('src', '/placeholder.png');

      // Firing error on placeholder should not change src (no infinite loop)
      fireEvent.error(img);
      expect(img).toHaveAttribute('src', '/placeholder.png');
    });

    it('passes correct sizing props to Image', () => {
      setupCart([makeCartItem()]);
      render(<CartPage />);

      const img = screen.getByRole('img', { name: 'Test Phone' });
      expect(img).toHaveAttribute(
        'sizes',
        '(max-width: 768px) 80px, 112px',
      );
    });
  });
});
