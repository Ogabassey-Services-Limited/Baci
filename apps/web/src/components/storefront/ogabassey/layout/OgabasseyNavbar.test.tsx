import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  asRoute: vi.fn((path: string) => path),
  merchantContext: {
    merchant: { id: 'merchant-1' },
    navigationCategories: [{ name: 'Phones', slug: 'phones' }],
  },
  pathname: '/ogabassey',
  push: vi.fn(),
  setIsCartOpen: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch,
    onClick,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  }) => (
    <a
      href={href}
      data-prefetch={String(prefetch)}
      onClick={(event) => {
        onClick?.(event);
        mocks.push(href);
        event.preventDefault();
      }}
      {...rest}
    >
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => mocks.pathname),
  useRouter: vi.fn(() => ({
    push: mocks.push,
    back: vi.fn(),
    replace: vi.fn(),
  })),
}));

vi.mock('next/dynamic', () => ({
  default: () => function DynamicComponentMock() {
    return null;
  },
}));

vi.mock('@/hooks/cart', () => ({
  useCart: vi.fn(() => ({
    totalItems: 3,
    setIsCartOpen: mocks.setIsCartOpen,
  })),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: vi.fn(() => mocks.merchantContext),
}));

vi.mock('@/components/storefront/search-autocomplete', () => ({
  SearchAutocomplete: ({
    value,
    onChange,
    onSelectProduct,
  }: {
    value: string;
    onChange: (value: string) => void;
    onSelectProduct: (url: string) => void;
  }) => (
    <div>
      <input
        type="search"
        aria-label="Search products"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        aria-label="Select product"
        onClick={() => onSelectProduct('/products/iphone%2015')}
      >
        Select product
      </button>
      <button
        type="button"
        aria-label="Select invalid product"
        onClick={() => onSelectProduct('https://example.com/bad')}
      >
        Select invalid product
      </button>
    </div>
  ),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: mocks.asRoute,
}));

vi.mock('./logo', () => ({
  Logo: () => <span>Store logo</span>,
}));

vi.mock('./mobile-menu', () => ({
  MobileMenu: () => null,
}));

vi.mock('../components/GadgetPattern', () => ({
  GadgetPattern: () => null,
}));

vi.mock('../components/empty-state', () => ({
  EmptyState: () => null,
}));

import { OgabasseyNavbar } from './navbar';

describe('OgabasseyNavbar', () => {
  beforeEach(() => {
    mocks.asRoute.mockClear();
    mocks.pathname = '/ogabassey';
    mocks.push.mockClear();
    mocks.setIsCartOpen.mockClear();
  });

  it('keeps rendered links under the store slug when the slug includes a leading slash', async () => {
    render(<OgabasseyNavbar storeSlug="/ogabassey" />);

    fireEvent.click(
      screen.getByRole('button', { name: /shop by category/i })
    );

    await screen.findByRole('link', { name: 'Phones' });

    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/ogabassey',
        '/ogabassey/cart',
        '/ogabassey/account',
        '/ogabassey/smartphones',
        '/ogabassey/imei-check',
        '/ogabassey/repairs',
        '/ogabassey/wallet',
        '/ogabassey/blog',
      ])
    );
  });

  it('pushes store-prefixed product routes from search selection', async () => {
    render(<OgabasseyNavbar storeSlug="/ogabassey" />);

    fireEvent.focus(screen.getByRole('searchbox', { name: /search products/i }));
    fireEvent.click(await screen.findByRole('button', { name: /select product/i }));

    expect(mocks.push).toHaveBeenCalledWith('/ogabassey/products/iphone%2015');
  });

  it('names the mobile menu button for assistive technology', () => {
    render(<OgabasseyNavbar storeSlug="/ogabassey" />);

    const menuButton = screen.getByRole('button', { name: /open menu/i });

    expect(menuButton).toHaveAttribute('type', 'button');
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('pushes store-prefixed blog search routes on the blog page', () => {
    mocks.pathname = '/ogabassey/blog';

    render(<OgabasseyNavbar storeSlug="/ogabassey" />);

    const input = screen.getByRole('searchbox', {
      name: /search blog posts/i,
    });

    fireEvent.change(input, { target: { value: 'flash sale' } });
    const form = input.closest('form');
    if (!(form instanceof HTMLFormElement)) {
      throw new Error('Expected the blog search input to be inside a form');
    }
    fireEvent.submit(form);

    expect(mocks.push).toHaveBeenCalledWith(
      '/ogabassey/blog?search=flash%20sale'
    );
  });

  it('uses store-prefixed routes for navigation links', () => {
    render(<OgabasseyNavbar storeSlug="/ogabassey" />);

    fireEvent.click(screen.getByRole('link', { name: /imei checker/i }));
    fireEvent.click(screen.getByRole('link', { name: /repairs/i }));
    fireEvent.click(screen.getByRole('link', { name: /wallet/i }));

    expect(mocks.push).toHaveBeenCalledWith('/ogabassey/imei-check');
    expect(mocks.push).toHaveBeenCalledWith('/ogabassey/repairs');
    expect(mocks.push).toHaveBeenCalledWith('/ogabassey/wallet');
  });

  it('emits root-relative first-render links for domain-routed storefronts', async () => {
    mocks.pathname = '/blog';

    render(<OgabasseyNavbar storeSlug="" />);

    fireEvent.click(
      screen.getByRole('button', { name: /shop by category/i })
    );

    await screen.findByRole('link', { name: 'Phones' });

    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/',
        '/cart',
        '/account',
        '/smartphones',
        '/imei-check',
        '/repairs',
        '/wallet',
        '/blog',
      ])
    );
    expect(hrefs).toEqual(
      expect.not.arrayContaining([
        '/ogabassey',
        '/ogabassey/account',
        '/ogabassey/blog',
      ])
    );
  });

  it('disables prefetch on visible shell navigation links', async () => {
    render(<OgabasseyNavbar storeSlug="/ogabassey" />);

    fireEvent.click(
      screen.getByRole('button', { name: /shop by category/i })
    );

    expect(screen.getByRole('link', { name: /store logo/i })).toHaveAttribute(
      'data-prefetch',
      'false'
    );
    expect(screen.getByRole('link', { name: /imei checker/i })).toHaveAttribute(
      'data-prefetch',
      'false'
    );
    expect(screen.getByRole('link', { name: /repairs/i })).toHaveAttribute(
      'data-prefetch',
      'false'
    );
    expect(screen.getByRole('link', { name: /wallet/i })).toHaveAttribute(
      'data-prefetch',
      'false'
    );
    expect(await screen.findByRole('link', { name: 'Phones' })).toHaveAttribute(
      'data-prefetch',
      'false'
    );
  });

  it('rejects invalid product URLs from search selection', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<OgabasseyNavbar storeSlug="/ogabassey" />);

    fireEvent.focus(screen.getByRole('searchbox', { name: /search products/i }));
    fireEvent.click(
      await screen.findByRole('button', { name: /select invalid product/i })
    );

    expect(mocks.asRoute).not.toHaveBeenCalledWith('https://example.com/bad');
    expect(mocks.push).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith(
      'Invalid product URL rejected:',
      'https://example.com/bad'
    );

    consoleWarn.mockRestore();
  });
});
