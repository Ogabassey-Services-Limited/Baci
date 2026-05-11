import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { capturedDynamicOptions, mockUseCartSafe } = vi.hoisted(() => ({
  capturedDynamicOptions: {} as {
    current?: { loading?: ComponentType };
  },
  mockUseCartSafe: vi.fn(),
}));

vi.mock('@/hooks/cart', () => ({
  useCartSafe: mockUseCartSafe,
}));

vi.mock('next/dynamic', () => ({
  default: (_loader: unknown, options?: { loading?: ComponentType }) => {
    capturedDynamicOptions.current = options;
    const DynamicCartSidebar: ComponentType = () => (
      <aside aria-label="Cart" />
    );
    return DynamicCartSidebar;
  },
}));

import { DeferredCartSidebar } from './deferred-cart-sidebar';

describe('DeferredCartSidebar', () => {
  beforeEach(() => {
    mockUseCartSafe.mockReset();
  });

  it('keeps the cart drawer chunk out of the page when the cart is closed', () => {
    mockUseCartSafe.mockReturnValue({ isCartOpen: false });

    render(<DeferredCartSidebar />);

    expect(
      screen.queryByRole('complementary', { name: /cart/i })
    ).not.toBeInTheDocument();
  });

  it('treats an undefined cart open state as closed', () => {
    mockUseCartSafe.mockReturnValue({ isCartOpen: undefined });

    render(<DeferredCartSidebar />);

    expect(
      screen.queryByRole('complementary', { name: /cart/i })
    ).not.toBeInTheDocument();
  });

  it('renders the cart drawer loader when the cart opens', () => {
    mockUseCartSafe.mockReturnValue({ isCartOpen: true });

    render(<DeferredCartSidebar />);

    expect(
      screen.getByRole('complementary', { name: /cart/i })
    ).toBeInTheDocument();
  });

  it('keeps the cart drawer mounted after it has opened once', () => {
    let cartState = { isCartOpen: false };
    mockUseCartSafe.mockImplementation(() => cartState);

    const { rerender } = render(<DeferredCartSidebar />);

    expect(
      screen.queryByRole('complementary', { name: /cart/i })
    ).not.toBeInTheDocument();

    cartState = { isCartOpen: true };
    rerender(<DeferredCartSidebar />);

    expect(
      screen.getByRole('complementary', { name: /cart/i })
    ).toBeInTheDocument();

    cartState = { isCartOpen: false };
    rerender(<DeferredCartSidebar />);

    expect(
      screen.getByRole('complementary', { name: /cart/i })
    ).toBeInTheDocument();
  });

  it('provides an accessible loading placeholder for the cart drawer chunk', () => {
    const Loading = capturedDynamicOptions.current?.loading;

    expect(Loading).toBeDefined();
    render(Loading ? <Loading /> : null);

    const loader = screen.getByRole('status', { name: /loading cart/i });
    expect(loader).toBeInTheDocument();
    expect(loader).toHaveAttribute(
      'class',
      expect.stringContaining('bg-[var(--store-background,#ffffff)]')
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
