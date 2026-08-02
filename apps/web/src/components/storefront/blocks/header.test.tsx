import type { PuckContext } from '@puckeditor/core';
import { render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { builderConfig } from '@/components/builder/config';
import { generatePreviewTemplate } from '@/components/onboarding-preview/onboarding-preview-data';
import { getContrastRatio } from '@/lib/color-utils';
import { buildCuratedStorefront } from '@/lib/storefront-defaults/build-curated-storefront';
import { deriveCuratedTheme } from '@/lib/storefront-defaults/derive-curated-theme';
import { Header } from './header';

const mocks = vi.hoisted(() => ({
  auth: null as { user: { id: string } } | null,
  fetch: vi.fn(),
}));

vi.stubGlobal('fetch', mocks.fetch);

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
    ...props
  }: {
    children: ReactNode;
    asChild?: boolean;
  }) => (asChild ? children : <div {...props}>{children}</div>),
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

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({
    merchant: {
      id: 'merchant-1',
      slug: 'preview-store',
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

const puck = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
} satisfies PuckContext;

describe('Header', () => {
  beforeEach(() => {
    mocks.auth = null;
    mocks.fetch.mockReset();
    mocks.fetch.mockResolvedValue({
      json: async () => ({ authenticated: false, customer: null }),
    });
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

  it.each([
    {
      name: 'light',
      brandColors: {
        primary: '#000000',
        background: '#ffffff',
        accent: '#777777',
      },
    },
    {
      name: 'dark',
      brandColors: {
        primary: '#ffffff',
        background: '#000000',
        accent: '#777777',
      },
    },
    {
      name: 'boundary',
      brandColors: {
        primary: '#777777',
        background: '#777777',
        accent: '#ffffff',
      },
    },
    {
      name: 'threshold',
      brandColors: {
        primary: '#757575',
        background: '#757575',
        accent: '#ffffff',
      },
    },
  ])('renders $name persisted and onboarding Headers with AA-safe inherited content', async ({
    brandColors,
  }) => {
    const persisted = buildCuratedStorefront({
      businessName: 'North Star',
      businessType: 'fashion',
      country: 'Nigeria',
      brandColors,
    });
    const preview = await generatePreviewTemplate({
      businessName: 'North Star',
      businessType: 'fashion',
      logoDataUri: null,
    });
    const persistedHeader = persisted.content.find(
      (block) => block.type === 'Header'
    );
    const previewHeader = preview.content.find(
      (block) => block.type === 'Header'
    );
    if (persistedHeader?.type !== 'Header' || previewHeader?.type !== 'Header')
      throw new Error('Curated pages must contain a Header block');

    const renderHeader = builderConfig.components.Header.render;
    if (!renderHeader) throw new Error('Builder Header renderer is required');
    const theme = deriveCuratedTheme(brandColors, 'fashion');
    mocks.auth = { user: { id: 'customer-1' } };
    mocks.fetch.mockResolvedValue({
      json: async () => ({
        authenticated: true,
        customer: {
          first_name: 'North',
          last_name: 'Star',
          email: 'north@example.com',
        },
      }),
    });

    render(
      <>
        {renderHeader({ ...persistedHeader.props, puck } as never)}
        {renderHeader({ ...previewHeader.props, puck } as never)}
      </>
    );

    const headers = screen.getAllByRole('banner');
    expect(persistedHeader.props).toMatchObject({
      glassEffect: false,
      backgroundColor: 'var(--store-background)',
      textColor: 'var(--store-background-text)',
    });
    expect(previewHeader.props).toMatchObject({
      glassEffect: persistedHeader.props.glassEffect,
      backgroundColor: persistedHeader.props.backgroundColor,
      textColor: persistedHeader.props.textColor,
    });
    expect(previewHeader.props).toMatchObject({ isPreview: true });
    for (const header of headers) {
      expect(header).toHaveStyle({
        backgroundColor: 'var(--store-background)',
        color: 'var(--store-background-text)',
      });
      expect(header).toHaveTextContent('Logo');
      expect(header).toHaveTextContent('Home');
    }
    expect(
      getContrastRatio(theme.colors.foreground, theme.colors.background)
    ).toBeGreaterThanOrEqual(4.5);
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    expect(mocks.fetch).toHaveBeenCalledWith(
      '/api/storefront/auth/session?merchantSlug=preview-store'
    );
    expect(await screen.findByText('Sign out')).toHaveClass('text-destructive');
    expect(getContrastRatio('#B91C1C', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });
});
