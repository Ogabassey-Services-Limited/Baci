import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './header';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: ComponentProps<'div'>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock('next/image', () => ({
  default: (props: ComponentProps<'img'>) => (
    // biome-ignore lint/performance/noImgElement: test double
    <img {...props} alt="" />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/components/cart', () => ({ Cart: () => null }));
vi.mock('@/components/logo', () => ({ Logo: () => <span>Logo</span> }));
vi.mock('@/components/storefront/loyalty/loyalty-badge', () => ({
  LoyaltyBadge: () => null,
}));
vi.mock('@/components/themed', () => ({
  ThemedButton: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => children,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => children,
  DropdownMenuItem: ({ children }: { children: ReactNode }) => children,
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => children,
  DropdownMenuSeparator: () => null,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: ReactNode }) => children,
  SheetTrigger: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/contexts/auth-context', () => ({ useAuthSafe: () => null }));
vi.mock('@/hooks/use-cart', () => ({ useCart: () => ({ cartCount: 0 }) }));
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({
    basePath: '',
    merchant: { business_name: 'North Star', id: 'merchant-1' },
  }),
}));
vi.mock('@/lib/routes', () => ({ asRoute: (value: string) => value }));

describe('Header mobile search', () => {
  it('opens the existing mobile search surface from the visible Search button', () => {
    render(<Header showAccount={false} showCart={false} showMenu showSearch />);

    expect(
      screen.queryByPlaceholderText('Search products...')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByPlaceholderText('Search products...')).toBeVisible();
  });

  it('opens and closes a search-only panel when the menu is disabled', () => {
    render(
      <Header
        navigationLinks={[{ label: 'Configured navigation', url: '/catalog' }]}
        showAccount={false}
        showCart={false}
        showMenu={false}
        showSearch
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByPlaceholderText('Search products...')).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Configured navigation' })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close search' }));

    expect(
      screen.queryByPlaceholderText('Search products...')
    ).not.toBeInTheDocument();
  });
});
