import type { ComponentType } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type LoadCartSidebar = () => Promise<ComponentType>;

const { mockLoadCartSidebar, mockSetIsCartOpen, mockUseCartSafe } = vi.hoisted(
  () => ({
    mockLoadCartSidebar: vi.fn<LoadCartSidebar>(),
    mockSetIsCartOpen: vi.fn(),
    mockUseCartSafe: vi.fn(),
  })
);

vi.mock('@/hooks/cart', () => ({
  useCartSafe: mockUseCartSafe,
}));

vi.mock(
  '@/components/storefront/ogabassey/components/load-cart-sidebar',
  () => ({
    loadCartSidebar: mockLoadCartSidebar,
  })
);

import { DeferredCartSidebar } from './deferred-cart-sidebar';

function MockCartSidebar() {
  return <aside aria-label="Cart" />;
}

function createPendingCartSidebarLoad(): Promise<ComponentType> {
  return new Promise(() => undefined);
}

describe('DeferredCartSidebar', () => {
  beforeEach(() => {
    mockLoadCartSidebar.mockReset();
    mockLoadCartSidebar.mockResolvedValue(MockCartSidebar);
    mockSetIsCartOpen.mockReset();
    mockUseCartSafe.mockReset();
  });

  it('keeps the cart drawer chunk out of the page when the cart is closed', () => {
    mockUseCartSafe.mockReturnValue({ isCartOpen: false });

    render(<DeferredCartSidebar />);

    expect(
      screen.queryByRole('complementary', { name: /cart/i })
    ).not.toBeInTheDocument();
    expect(mockLoadCartSidebar).not.toHaveBeenCalled();
  });

  it('treats an undefined cart open state as closed', () => {
    mockUseCartSafe.mockReturnValue({ isCartOpen: undefined });

    render(<DeferredCartSidebar />);

    expect(
      screen.queryByRole('complementary', { name: /cart/i })
    ).not.toBeInTheDocument();
    expect(mockLoadCartSidebar).not.toHaveBeenCalled();
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
    expect(mockLoadCartSidebar).toHaveBeenCalledTimes(1);
  });

  it('renders the cart drawer loader while the cart chunk is pending', () => {
    mockLoadCartSidebar.mockReturnValue(createPendingCartSidebarLoad());
    mockUseCartSafe.mockReturnValue({ isCartOpen: true });

    render(<DeferredCartSidebar />);

    expect(
      screen.getByRole('status', { name: /loading cart/i })
    ).toBeInTheDocument();
  });

  it('hides the cart drawer loader when the cart closes before the chunk loads', () => {
    mockLoadCartSidebar.mockReturnValue(createPendingCartSidebarLoad());
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

  it('shows a retryable alert and recovers when the cart drawer chunk reloads', async () => {
    mockLoadCartSidebar
      .mockRejectedValueOnce(new Error('cart chunk failed'))
      .mockResolvedValueOnce(MockCartSidebar);
    mockUseCartSafe.mockReturnValue({ isCartOpen: true });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      render(<DeferredCartSidebar />);

      expect(
        screen.getByRole('status', { name: /loading cart/i })
      ).toBeInTheDocument();
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Unable to load cart.');
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /close cart/i })
      ).toBeInTheDocument();
      expect(mockLoadCartSidebar).toHaveBeenCalledTimes(1);
      expect(alert).not.toHaveAttribute('aria-live');

      fireEvent.click(retryButton);

      expect(
        await screen.findByRole('complementary', { name: /cart/i })
      ).toBeInTheDocument();
      expect(mockLoadCartSidebar).toHaveBeenCalledTimes(2);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('lets shoppers dismiss the cart chunk error panel', async () => {
    mockLoadCartSidebar.mockRejectedValueOnce(new Error('cart chunk failed'));
    let cartState = {
      isCartOpen: true,
      setIsCartOpen: mockSetIsCartOpen,
    };
    mockSetIsCartOpen.mockImplementation((open: boolean) => {
      cartState = {
        ...cartState,
        isCartOpen: open,
      };
    });
    mockUseCartSafe.mockImplementation(() => cartState);
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      const { rerender } = render(<DeferredCartSidebar />);

      expect(await screen.findByRole('alert')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /close cart/i }));
      rerender(<DeferredCartSidebar />);

      expect(mockSetIsCartOpen).toHaveBeenCalledWith(false);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('status', { name: /loading cart/i })
      ).not.toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('clears the error UI synchronously on retry', async () => {
    mockLoadCartSidebar
      .mockRejectedValueOnce(new Error('cart chunk failed'))
      .mockReturnValueOnce(createPendingCartSidebarLoad());
    mockUseCartSafe.mockReturnValue({ isCartOpen: true });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      render(<DeferredCartSidebar />);

      const retryButton = await screen.findByRole('button', { name: /retry/i });

      act(() => {
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(mockLoadCartSidebar).toHaveBeenCalledTimes(2);
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(
        screen.getByRole('status', { name: /loading cart/i })
      ).toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
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
    mockLoadCartSidebar.mockReturnValue(createPendingCartSidebarLoad());
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
