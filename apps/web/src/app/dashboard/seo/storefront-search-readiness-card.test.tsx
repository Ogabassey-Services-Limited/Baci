import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { StorefrontSearchReadinessCard } from './storefront-search-readiness-card';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('StorefrontSearchReadinessCard', () => {
  it('renders an advisory indexable foundation with existing-route links', () => {
    render(
      <StorefrontSearchReadinessCard
        assessment={{
          tier: 'indexable',
          blockers: [],
          improvements: [
            { code: 'products_missing_image', href: '/dashboard/products' },
          ],
        }}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Indexable foundation' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'products missing image' })
    ).toHaveAttribute('href', '/dashboard/products');
  });
});
