import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CartEmptyState } from './cart-empty-state';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: { children: React.ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (path: string) => path,
}));

describe('CartEmptyState', () => {
  it('renders cart-specific empty state copy without unavailable-product messaging', () => {
    render(<CartEmptyState basePath="/ogabassey" />);

    expect(
      screen.getByRole('heading', { name: 'Your cart is empty' })
    ).toBeInTheDocument();
    expect(screen.getByText('Nothing in your cart yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Add phones, accessories, or repair services/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/currently not available/i)
    ).not.toBeInTheDocument();
  });

  it('links shoppers back to the storefront and smartphones category', () => {
    render(<CartEmptyState basePath="/ogabassey/" />);

    expect(
      screen.getByRole('link', { name: /start shopping/i })
    ).toHaveAttribute('href', '/ogabassey');
    expect(
      screen.getByRole('link', { name: 'Browse smartphones' })
    ).toHaveAttribute('href', '/ogabassey/smartphones');
  });

  it('normalizes plain merchant base paths', () => {
    render(<CartEmptyState basePath="ogabassey" />);

    expect(
      screen.getByRole('link', { name: /start shopping/i })
    ).toHaveAttribute('href', '/ogabassey');
    expect(
      screen.getByRole('link', { name: 'Browse smartphones' })
    ).toHaveAttribute('href', '/ogabassey/smartphones');
  });

  it('keeps root-routed stores root-relative', () => {
    render(<CartEmptyState basePath="/" />);

    expect(
      screen.getByRole('link', { name: /start shopping/i })
    ).toHaveAttribute('href', '/');
    expect(
      screen.getByRole('link', { name: 'Browse smartphones' })
    ).toHaveAttribute('href', '/smartphones');
  });

  it('treats whitespace-only base paths as root-relative', () => {
    render(<CartEmptyState basePath="   " />);

    expect(
      screen.getByRole('link', { name: /start shopping/i })
    ).toHaveAttribute('href', '/');
    expect(
      screen.getByRole('link', { name: 'Browse smartphones' })
    ).toHaveAttribute('href', '/smartphones');
  });
});
