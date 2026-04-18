import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({
    children,
    prefetch,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
  }) => (
    <a data-prefetch={String(prefetch)} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/test-store'),
}));
vi.mock('@/hooks/cart', () => ({
  useCart: vi.fn(() => ({ totalItems: 3 })),
}));
vi.mock('@/lib/routes', () => ({ asRoute: vi.fn((p: string) => p) }));

import { MobileFooter } from './MobileFooter';

describe('MobileFooter', () => {
  it('renders navigation links', () => {
    render(<MobileFooter storeSlug="test" />);
    expect(screen.getByRole('navigation')).toBeDefined();
  });

  it('renders without storeSlug', () => {
    const { container } = render(<MobileFooter />);
    expect(container).toBeDefined();
  });

  it('disables Next prefetch for always-visible mobile navigation links', () => {
    render(<MobileFooter storeSlug="test-store" />);

    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute(
      'data-prefetch',
      'false'
    );
    expect(screen.getByRole('link', { name: /saved/i })).toHaveAttribute(
      'data-prefetch',
      'false'
    );
    expect(screen.getByRole('link', { name: /cart/i })).toHaveAttribute(
      'data-prefetch',
      'false'
    );
    expect(screen.getByRole('link', { name: /wallet/i })).toHaveAttribute(
      'data-prefetch',
      'false'
    );
    expect(screen.getByRole('link', { name: /account/i })).toHaveAttribute(
      'data-prefetch',
      'false'
    );
  });
});
