import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/test-store'),
}));
vi.mock('@/hooks/use-cart', () => ({
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
});
