import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CategoryHubCardGrid } from './category-hub-card-grid';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('CategoryHubCardGrid', () => {
  it('renders crawlable card links and the optional compare CTA when both fields are present', () => {
    render(
      <CategoryHubCardGrid
        title="Best for"
        cards={[
          {
            title: 'Best for Photography',
            description: 'Strong camera options.',
            href: '/smartphones/apple-pro',
            eyebrow: 'Smartphones',
            secondaryHref: '/smartphones/compare/apple-pro-vs-samsung-ultra',
            secondaryLabel: 'Compare Apple Pro vs Samsung Ultra',
          },
        ]}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Best for' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Best for' }).closest('section')
    ).toHaveClass('ogabassey-category-hub-card');
    expect(
      screen.getByRole('link', { name: 'Best for Photography' })
    ).toHaveAttribute('href', '/smartphones/apple-pro');
    expect(
      screen.getByRole('link', { name: 'Best for Photography' }).closest('h4')
    ).toHaveClass('ogabassey-category-hub-card-grid__title');
    expect(
      screen
        .getByRole('link', { name: 'Best for Photography' })
        .closest('article')
    ).toHaveClass('ogabassey-category-hub-card-grid__item');
    expect(
      screen.getByRole('link', {
        name: 'Compare Apple Pro vs Samsung Ultra',
      })
    ).toHaveAttribute(
      'href',
      '/smartphones/compare/apple-pro-vs-samsung-ultra'
    );
  });

  it('omits the compare CTA when only one secondary field is provided', () => {
    render(
      <CategoryHubCardGrid
        title="Popular brands"
        cards={[
          {
            title: 'Samsung',
            description: 'A broad selection of Samsung phones.',
            href: '/smartphones/samsung-galaxy-s24',
            secondaryHref: '/smartphones/compare/samsung-vs-apple',
          },
        ]}
      />
    );

    expect(screen.getByRole('link', { name: 'Samsung' })).toHaveAttribute(
      'href',
      '/smartphones/samsung-galaxy-s24'
    );
    expect(
      screen.queryByRole('link', { name: /compare samsung/i })
    ).not.toBeInTheDocument();
  });

  it('does not depend on PDP-only semantic classes for category listing pages', () => {
    const { container } = render(
      <CategoryHubCardGrid
        title="Best price bands"
        cards={[
          {
            title: 'Best Smartphones Under ₦500,000',
            description: 'Value picks in the first band.',
            href: '/smartphones/best-under/under-500k',
          },
        ]}
      />
    );

    expect(
      container.querySelector('.ogabassey-category-hub-card')
    ).not.toBeNull();
    expect(container.innerHTML).not.toContain('ogabassey-pdp-semantic');
  });
});
