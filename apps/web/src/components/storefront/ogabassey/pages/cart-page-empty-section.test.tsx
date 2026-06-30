import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CartPageEmptySection } from './cart-page-empty-section';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  } & Record<string, unknown>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('CartPageEmptySection', () => {
  it('renders the cart empty state with storefront links', () => {
    render(<CartPageEmptySection basePath="/ogabassey.com" />);

    expect(
      screen.getByRole('heading', { name: 'Your cart is empty' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /start shopping/i })
    ).toHaveAttribute('href', '/ogabassey.com');
    expect(
      screen.getByRole('link', { name: /browse smartphones/i })
    ).toHaveAttribute('href', '/ogabassey.com/smartphones');
  });
});
