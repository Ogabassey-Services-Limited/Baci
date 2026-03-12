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
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
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

vi.mock('@/hooks/use-cart', () => ({
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
    onSelectProduct,
  }: {
    onSelectProduct: (url: string) => void;
  }) => (
    <button
      type="button"
      aria-label="Select product"
      onClick={() => onSelectProduct('/products/iphone 15')}
    >
      Select product
    </button>
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
        '/ogabassey/account',
        '/ogabassey/blog',
        '/ogabassey/cart',
        '/ogabassey/phones',
      ])
    );
  });

  it('pushes encoded store-prefixed product routes from search selection', () => {
    render(<OgabasseyNavbar storeSlug="/ogabassey" />);

    fireEvent.click(screen.getByRole('button', { name: /select product/i }));

    expect(mocks.asRoute).toHaveBeenCalledWith('/ogabassey/products/iphone%2015');
    expect(mocks.push).toHaveBeenCalledWith('/ogabassey/products/iphone%2015');
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

    expect(mocks.asRoute).toHaveBeenCalledWith(
      '/ogabassey/blog?search=flash%20sale'
    );
    expect(mocks.push).toHaveBeenCalledWith(
      '/ogabassey/blog?search=flash%20sale'
    );
  });
});
