import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCartSidebarModuleLoaded, mockUseCartSafe } = vi.hoisted(() => ({
  mockCartSidebarModuleLoaded: vi.fn(),
  mockUseCartSafe: vi.fn(),
}));

vi.mock('@/hooks/cart', () => ({
  useCartSafe: mockUseCartSafe,
}));

vi.mock('@/components/storefront/ogabassey/components/CartSidebar', async () => {
  const React = await import('react');

  mockCartSidebarModuleLoaded();

  return {
    CartSidebar: () =>
      React.createElement('aside', {
        'aria-label': 'Cart',
      }),
  };
});

import { DeferredCartSidebar } from './deferred-cart-sidebar';

describe('DeferredCartSidebar', () => {
  beforeEach(() => {
    mockCartSidebarModuleLoaded.mockClear();
    mockUseCartSafe.mockReset();
  });

  it('keeps the cart drawer chunk out of the page when the cart is closed', () => {
    mockUseCartSafe.mockReturnValue({ isCartOpen: false });

    render(<DeferredCartSidebar />);

    expect(
      screen.queryByRole('complementary', { name: /cart/i })
    ).not.toBeInTheDocument();
    expect(mockCartSidebarModuleLoaded).not.toHaveBeenCalled();
  });

  it('treats an undefined cart open state as closed', () => {
    mockUseCartSafe.mockReturnValue({ isCartOpen: undefined });

    render(<DeferredCartSidebar />);

    expect(
      screen.queryByRole('complementary', { name: /cart/i })
    ).not.toBeInTheDocument();
    expect(mockCartSidebarModuleLoaded).not.toHaveBeenCalled();
  });

  it('imports the cart drawer after the cart opens', async () => {
    mockUseCartSafe.mockReturnValue({ isCartOpen: true });

    render(<DeferredCartSidebar />);

    expect(
      screen.getByRole('status', { name: /loading cart/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('complementary', { name: /cart/i })
    ).toBeInTheDocument();
    expect(mockCartSidebarModuleLoaded).toHaveBeenCalledTimes(1);
  });

  it('renders the cart drawer loader while the cart chunk is pending', () => {
    mockUseCartSafe.mockReturnValue({ isCartOpen: true });

    render(<DeferredCartSidebar />);

    expect(
      screen.getByRole('status', { name: /loading cart/i })
    ).toBeInTheDocument();
  });

  it('hides the cart drawer loader when the cart closes before the chunk loads', () => {
    let cartState = { isCartOpen: false };
    mockUseCartSafe.mockImplementation(() => cartState);

    const { rerender } = render(<DeferredCartSidebar />);

    cartState = { isCartOpen: true };
    rerender(<DeferredCartSidebar />);

    expect(
      screen.getByRole('status', { name: /loading cart/i })
    ).toBeInTheDocument();

    cartState = { isCartOpen: false };
    rerender(<DeferredCartSidebar />);

    expect(
      screen.queryByRole('status', { name: /loading cart/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: /cart/i })
    ).not.toBeInTheDocument();
  });

  it('keeps the cart drawer mounted after it has opened once', async () => {
    let cartState = { isCartOpen: false };
    mockUseCartSafe.mockImplementation(() => cartState);

    const { rerender } = render(<DeferredCartSidebar />);

    expect(
      screen.queryByRole('complementary', { name: /cart/i })
    ).not.toBeInTheDocument();

    cartState = { isCartOpen: true };
    rerender(<DeferredCartSidebar />);

    expect(
      await screen.findByRole('complementary', { name: /cart/i })
    ).toBeInTheDocument();

    cartState = { isCartOpen: false };
    rerender(<DeferredCartSidebar />);

    expect(
      screen.getByRole('complementary', { name: /cart/i })
    ).toBeInTheDocument();
  });

  it('provides an accessible loading placeholder for the cart drawer chunk', () => {
    mockUseCartSafe.mockReturnValue({ isCartOpen: true });

    render(<DeferredCartSidebar />);

    const loader = screen.getByRole('status', { name: /loading cart/i });
    expect(loader).toBeInTheDocument();
    expect(loader).toHaveAttribute(
      'class',
      expect.stringContaining('bg-[var(--store-background)]')
    );
    expect(loader).not.toHaveClass('bg-white');
  });

  it('does not throw when rendered outside cart context', () => {
    mockUseCartSafe.mockReturnValue(null);

    render(<DeferredCartSidebar />);

    expect(
      screen.queryByRole('complementary', { name: /cart/i })
    ).not.toBeInTheDocument();
  });
});
