import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem } from '@/hooks/cart/cart-types';

const mocks = vi.hoisted(() => ({
  savedItems: [] as string[],
  toggleSaved: vi.fn(),
  addToCart: vi.fn(),
  cart: [] as CartItem[],
  merchant: {
    plan_tier: 'pro',
    slug: 'ogabassey',
  } as any,
  hasPriceNegotiationEntitlement: vi.fn((_tier?: string | null, _slug?: string) => true),
}));

vi.mock('next/image', () => ({
  default: () => 'img',
}));

vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ productSlug: '1' })),
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
}));

vi.mock('@/hooks/use-cart', () => ({
  useCart: vi.fn(() => ({
    addToCart: mocks.addToCart,
    cart: mocks.cart,
  })),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: vi.fn(() => ({
    merchant: mocks.merchant,
    basePath: '/ogabassey',
  })),
}));

vi.mock('@/lib/feature-flags', () => ({
  hasPriceNegotiationEntitlement: vi.fn((plan_tier?: string | null, slug?: string) => mocks.hasPriceNegotiationEntitlement(plan_tier, slug)),
}));

vi.mock('./footer', () => ({
  Footer: () => null,
}));

vi.mock('./navbar', () => ({
  Navbar: () => null,
}));

vi.mock('./negotiation-modal', () => ({
  NegotiationModal: () => null,
}));

vi.mock('./saved-context', () => ({
  useSaved: vi.fn(() => ({
    savedItems: mocks.savedItems,
    toggleSaved: mocks.toggleSaved,
  })),
}));

import { ProductDetails } from './product-details';

function renderInsideForm(onSubmit = vi.fn()) {
  render(
    <form onSubmit={onSubmit}>
      <ProductDetails />
    </form>
  );
  return onSubmit;
}

describe('ProductDetails', () => {
  beforeEach(() => {
    mocks.savedItems = [];
    mocks.toggleSaved.mockReset();
    mocks.addToCart.mockReset();
    mocks.cart = [];
    window.scrollTo = vi.fn();
  });

  it('does not submit an enclosing form when saving a product', () => {
    const onSubmit = renderInsideForm();

    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(mocks.toggleSaved).toHaveBeenCalledWith('1');
  });

  it('does not submit an enclosing form when removing a saved product', () => {
    mocks.savedItems = ['1'];
    const onSubmit = renderInsideForm();

    fireEvent.click(screen.getByRole('button', { name: 'Remove from saved' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(mocks.toggleSaved).toHaveBeenCalledWith('1');
  });

  it('calculates the quantity of a product in the cart without crashing by using CartItem interface mapping', () => {
    mocks.cart = [
      {
        id: '1',
        cartItemId: '1::variant=variant-1',
        variantId: 'variant-1',
        name: 'iPhone 15 Pro Max',
        image: '/iphone.jpg',
        price: 1_200_000,
        quantity: 2,
      } as CartItem,
    ];

    // Test passes if component renders successfully with the typed cart item object
    render(<ProductDetails />);

    expect(screen.getAllByText('iPhone 15 Pro Max').length).toBeGreaterThan(0);
  });
});

describe('ProductDetails Negotiation Button Entitlement', () => {
  beforeEach(() => {
    mocks.savedItems = [];
    mocks.toggleSaved.mockReset();
    mocks.addToCart.mockReset();
    mocks.merchant = { plan_tier: 'pro', slug: 'ogabassey' };
    mocks.hasPriceNegotiationEntitlement.mockReset();
    window.scrollTo = vi.fn();
  });

  it('renders the negotiation button when entitled', () => {
    mocks.hasPriceNegotiationEntitlement.mockReturnValue(true);
    render(<ProductDetails />);
    expect(screen.getByRole('button', { name: 'Negotiate' })).toBeInTheDocument();
  });

  it('does not render the negotiation button when not entitled', () => {
    mocks.hasPriceNegotiationEntitlement.mockReturnValue(false);
    render(<ProductDetails />);
    expect(screen.queryByRole('button', { name: 'Negotiate' })).not.toBeInTheDocument();
  });
});
