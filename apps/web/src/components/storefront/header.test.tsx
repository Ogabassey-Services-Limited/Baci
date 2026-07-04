import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorefrontHeader } from './header';

const mockUseMerchant = vi.fn();

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => mockUseMerchant(),
}));

vi.mock('@/hooks/use-cart', () => ({
  useCart: () => ({ cartCount: 0 }),
}));

vi.mock('@/contexts/storefront-context', () => ({
  useStorefront: () => ({ searchQuery: '', setSearchQuery: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/cart', () => ({
  Cart: () => null,
}));

vi.mock('./search-autocomplete', () => ({
  SearchAutocomplete: () => null,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const merchant = {
  id: 'merchant-1',
  slug: 'ogabassey',
  business_name: 'OgaBassey',
  logo_url: null,
  country: 'NG',
  template_id: 'ogabassey',
};

describe('StorefrontHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMerchant.mockReturnValue({ merchant, basePath: '/ogabassey' });
  });

  it('shows the Book Repair link on Ogabassey-template stores', () => {
    render(<StorefrontHeader />);

    expect(screen.getByRole('link', { name: 'Book Repair' })).toHaveAttribute(
      'href',
      '/ogabassey/repair'
    );
  });

  it('hides the Book Repair link on other templates because /repair 404s there', () => {
    mockUseMerchant.mockReturnValue({
      merchant: { ...merchant, template_id: 'default' },
      basePath: '/other-store',
    });

    render(<StorefrontHeader />);

    expect(
      screen.queryByRole('link', { name: 'Book Repair' })
    ).not.toBeInTheDocument();
  });
});
