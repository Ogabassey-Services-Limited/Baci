import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem } from '@/hooks/cart/cart-types';
import { Cart } from './cart';

const { mockRemoveFromCart, mockUpdateQuantity, mockUseCart } = vi.hoisted(
  () => ({
    mockRemoveFromCart: vi.fn(),
    mockUpdateQuantity: vi.fn(),
    mockUseCart: vi.fn(),
  })
);

vi.mock('framer-motion', () => {
  const stripMotionProps = <T extends object>(props: T): T => {
    const propsRecord = props as Record<string, unknown>;
    const {
      animate: _animate,
      exit: _exit,
      initial: _initial,
      layout: _layout,
      transition: _transition,
      whileHover: _whileHover,
      whileTap: _whileTap,
      ...rest
    } = propsRecord;
    return rest as T;
  };

  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: {
      button: (props: ComponentProps<'button'>) => (
        <button type="button" {...stripMotionProps(props)} />
      ),
      div: (props: ComponentProps<'div'>) => (
        <div {...stripMotionProps(props)} />
      ),
      p: (props: ComponentProps<'p'>) => <p {...stripMotionProps(props)} />,
    },
  };
});

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span aria-label={alt} data-src={src} role="img" />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/themed', () => ({
  ThemedButton: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  ThemedSheetContent: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/sheet', () => ({
  SheetClose: ({ children }: { children: ReactNode }) => <>{children}</>,
  SheetFooter: ({ children }: { children: ReactNode }) => (
    <footer>{children}</footer>
  ),
  SheetHeader: ({ children }: { children: ReactNode }) => (
    <header>{children}</header>
  ),
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('./ui/animated-icons', () => ({
  QuantityButton: ({
    disabled,
    onClick,
    type,
  }: {
    disabled?: boolean;
    onClick: () => void;
    type: 'minus' | 'plus';
  }) => (
    <button
      aria-label={type}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {type}
    </button>
  ),
}));

vi.mock('@/hooks/use-cart', () => ({
  useCart: mockUseCart,
}));

vi.mock('@/hooks/use-currency', () => ({
  useCurrency: () => ({
    formatCurrency: (amount: number) => `₦${amount}`,
  }),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({
    basePath: '/demo',
  }),
}));

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'product-1',
    cartItemId: 'product-1::variant=variant-128',
    name: 'Legacy Variant',
    description: '',
    status: 'active',
    price: 100,
    quantity: 2,
    manage_stock: true,
    stock: 10,
    image: '/product.jpg',
    imageLarge: '/product.jpg',
    imageHint: '',
    brand: '',
    gtin: '',
    mpn: '',
    variantId: 'variant-128',
    ...overrides,
  } as CartItem;
}

describe('Cart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCart.mockReturnValue({
      cart: [makeCartItem()],
      cartCount: 2,
      cartTotal: 200,
      removeFromCart: mockRemoveFromCart,
      updateQuantity: mockUpdateQuantity,
    });
  });

  it('uses cartItemId for normalized variant line quantity and remove controls', () => {
    render(<Cart />);

    fireEvent.change(screen.getByLabelText('Quantity for Legacy Variant'), {
      target: { value: '3' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Legacy Variant from cart' })
    );

    expect(mockUpdateQuantity).toHaveBeenCalledWith(
      'product-1::variant=variant-128',
      3
    );
    expect(mockRemoveFromCart).toHaveBeenCalledWith(
      'product-1::variant=variant-128'
    );
  });
});
