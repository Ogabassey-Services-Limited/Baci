import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getContrastRatio } from '@/lib/color-utils';
import { deriveCuratedTheme } from '@/lib/storefront-defaults/derive-curated-theme';
import { Header } from './header';

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.stubGlobal('fetch', mocks.fetch);

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
  DropdownMenuItem: ({
    asChild: _asChild,
    children,
    ...props
  }: ComponentProps<'div'> & { asChild?: boolean }) => (
    <div {...props}>{children}</div>
  ),
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
    merchant: { business_name: 'North Star', id: 'merchant-1', slug: 'north' },
  }),
}));
vi.mock('@/lib/routes', () => ({ asRoute: (value: string) => value }));

describe('Header mobile search', () => {
  beforeEach(() => {
    mocks.fetch.mockReset();
    mocks.fetch.mockResolvedValue({
      json: async () => ({
        authenticated: true,
        customer: {
          email: 'customer@example.com',
          first_name: 'Customer',
          last_name: 'Example',
        },
      }),
    });
  });
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

  it.each([
    ['dark', '#ffffff', '#000000', '#777777'],
    ['boundary', '#777777', '#777777', '#ffffff'],
    ['threshold', '#757575', '#757575', '#ffffff'],
  ])('keeps authenticated mobile account controls contrast-safe for %s', async (_name, primary, background, accent) => {
    const theme = deriveCuratedTheme({ primary, background, accent });
    render(
      <div
        style={{
          backgroundColor: theme.colors.background,
          color: theme.colors.foreground,
        }}
      >
        <Header
          backgroundColor={theme.colors.header.background}
          glassEffect={false}
          showCart={false}
          showMenu
          showSearch={false}
          textColor={theme.colors.header.text}
        />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }));
    const signedIn = await screen.findByText(
      'Signed in as customer@example.com'
    );
    const signOut = screen.getByRole('button', { name: 'Sign out' });
    expect(signedIn).toHaveClass('text-current');
    expect(signOut).toHaveClass(
      'bg-destructive',
      'text-destructive-foreground'
    );
    expect(
      getContrastRatio(theme.colors.foreground, theme.colors.background)
    ).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio('#B91C1C', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });

  it('uses a destructive foreground-background pair when desktop sign out is focused', async () => {
    const theme = deriveCuratedTheme({
      primary: '#777777',
      background: '#777777',
      accent: '#ffffff',
    });
    render(
      <div
        style={{
          backgroundColor: theme.colors.header.background,
          color: theme.colors.header.text,
        }}
      >
        <Header
          backgroundColor={theme.colors.header.background}
          glassEffect={false}
          showCart={false}
          showMenu={false}
          showSearch={false}
          textColor={theme.colors.header.text}
        />
      </div>
    );

    const signOut = await screen.findByText('Sign out');
    expect(signOut).toHaveClass(
      'focus:bg-destructive',
      'focus:text-destructive-foreground'
    );
    expect(getContrastRatio('#B91C1C', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });
});
