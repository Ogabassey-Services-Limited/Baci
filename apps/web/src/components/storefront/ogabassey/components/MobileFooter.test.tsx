import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCart } from '@/hooks/cart';

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
  useCart: vi.fn(() => ({ totalItems: 3, isHydrated: true })),
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

  it('renders a dynamic accessible name for the Cart link based on item count', () => {
    render(<MobileFooter storeSlug="test" />);

    // Total items is 3 in mock useCart, so the label should be 'Cart (3 items)'
    expect(screen.getByRole('link', { name: /cart/i })).toHaveAttribute(
      'aria-label',
      'Cart (3 items)'
    );
  });

  it('renders a dynamic accessible name for the Cart link with singular item suffix when there is exactly 1 item', () => {
    vi.mocked(useCart).mockReturnValueOnce({
      totalItems: 1,
      isHydrated: true,
    } as unknown as ReturnType<typeof useCart>);

    render(<MobileFooter storeSlug="test" />);

    expect(screen.getByRole('link', { name: /cart/i })).toHaveAttribute(
      'aria-label',
      'Cart (1 item)'
    );
  });

  it('keeps the clamped cart badge text in the accessible name', () => {
    vi.mocked(useCart).mockReturnValueOnce({
      totalItems: 150,
      isHydrated: true,
    } as unknown as ReturnType<typeof useCart>);

    render(<MobileFooter storeSlug="test" />);

    expect(screen.getByRole('link', { name: /cart/i })).toHaveAttribute(
      'aria-label',
      'Cart (99+ items)'
    );
  });

  it('keeps the cart item count out of first render until hydration finishes', () => {
    vi.mocked(useCart).mockReturnValueOnce({
      totalItems: 3,
      isHydrated: false,
    } as unknown as ReturnType<typeof useCart>);

    render(<MobileFooter storeSlug="test" />);

    expect(screen.getByRole('link', { name: /^cart$/i })).toHaveAttribute(
      'aria-label',
      'Cart'
    );
    expect(
      document.querySelector('.ogabassey-mobile-footer__badge')
    ).not.toBeInTheDocument();
  });

  it('renders the decorative background pattern as an inline SVG tile, not a background-image div', () => {
    // Regression guard mirroring GadgetPattern.test.tsx: a
    // `background-image: url(data:image/svg+xml,...)` div IS an LCP
    // candidate and this exact pattern was field-caught winning homepage
    // LCP at 4648ms (PostHog, 2026-07-11). It must stay an inline <svg>
    // with a <pattern> tile.
    const { container } = render(<MobileFooter storeSlug="test" />);

    const pattern = container.querySelector('.ogabassey-mobile-footer__pattern');
    expect(pattern).not.toBeNull();
    expect(pattern?.tagName.toLowerCase()).toBe('svg');

    const tile = pattern?.querySelector('pattern');
    expect(tile).not.toBeNull();
    expect(tile).toHaveAttribute('width', '140');
    expect(tile).toHaveAttribute('height', '140');

    const fillRect = pattern?.querySelector(`rect[fill="url(#${tile?.id})"]`);
    expect(fillRect).not.toBeNull();

    const style = pattern?.getAttribute('style') ?? '';
    expect(style).not.toContain('background');
    expect(style).not.toContain('data:image/svg+xml');
  });
});
