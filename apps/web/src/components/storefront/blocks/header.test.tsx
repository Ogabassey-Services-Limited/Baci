import { render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: null as { user: { id: string } } | null,
}));

vi.mock('next/image', () => ({
  default: (props: ComponentProps<'img'>) => (
    // biome-ignore lint/performance/noImgElement: test double
    <img {...props} alt={props.alt ?? ''} />
  ),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/cart', () => ({
  Cart: () => <div>Cart</div>,
}));

vi.mock('@/components/logo', () => ({
  Logo: () => <span>Logo</span>,
}));

vi.mock('@/components/storefront/loyalty/loyalty-badge', () => ({
  LoyaltyBadge: ({ customerId }: { customerId: string }) => (
    <div>Loyalty {customerId}</div>
  ),
}));

vi.mock('@/components/themed', () => ({
  ThemedButton: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    asChild,
    ...rest
  }: {
    children: ReactNode;
    asChild?: boolean;
  }) =>
    asChild ? (
      children
    ) : (
      <button type="button" {...rest}>
        {children}
      </button>
    ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    asChild,
  }: {
    children: ReactNode;
    asChild?: boolean;
  }) => (asChild ? children : <div>{children}</div>),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: ComponentProps<'input'>) => <input {...props} />,
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuthSafe: () => mocks.auth,
}));

vi.mock('@/hooks/use-cart', () => ({
  useCart: () => ({
    cartCount: 2,
  }),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchant: () => ({
    merchant: {
      id: 'merchant-1',
      slug: 'demo-store',
      business_name: 'Demo Store',
      logo_url: null,
    },
    basePath: '/demo-store',
  }),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (value: string) => value,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...values: Array<string | false | null | undefined>) =>
    values.filter(Boolean).join(' '),
}));

import { Header } from './header';

describe('Header', () => {
  beforeEach(() => {
    mocks.auth = null;
  });

  it('renders without a platform auth provider', () => {
    render(
      <Header
        showAccount={false}
        showCart={false}
        showMenu={false}
        showSearch={false}
      />
    );

    expect(screen.getByText('Demo Store')).toBeInTheDocument();
    expect(screen.queryByText(/^Loyalty /)).not.toBeInTheDocument();
  });

  it('shows the loyalty badge when auth context is available', () => {
    mocks.auth = { user: { id: 'user-1' } };

    render(
      <Header
        showAccount={false}
        showCart={false}
        showMenu={false}
        showSearch={false}
      />
    );

    expect(screen.getByText('Loyalty user-1')).toBeInTheDocument();
  });
});
