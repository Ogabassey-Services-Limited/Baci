import { render, screen } from '@testing-library/react';
import type { MerchantData } from '@/hooks/use-merchant';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a {...props}>{children}</a>,
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: vi.fn(() => ({
    navigationCategories: [
      { name: 'Laptops', slug: 'laptops' },
      { name: 'Gaming Laptops', slug: 'gaming-laptops' },
    ],
  })),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: vi.fn((path: string) => path),
}));

vi.mock('@/lib/social', () => ({
  normalizeSocialUrl: vi.fn(() => null),
}));

vi.mock('./Logo', () => ({
  Logo: () => <div>Logo</div>,
}));

import { Footer } from './Footer';

describe('Footer', () => {
  it('renders crawlable category links with the store base path', () => {
    render(
      <Footer
        merchant={{ business_name: 'Ogabassey' } as MerchantData}
        storeSlug="/ogabassey"
      />
    );

    expect(screen.getByRole('link', { name: 'Laptops' })).toHaveAttribute(
      'href',
      '/ogabassey/laptops'
    );
    expect(
      screen.getByRole('link', { name: 'Gaming Laptops' })
    ).toHaveAttribute('href', '/ogabassey/gaming-laptops');
  });
});
