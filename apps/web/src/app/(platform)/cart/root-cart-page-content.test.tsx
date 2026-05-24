import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RootCartPageContent } from './root-cart-page-content';

const mockCookies = vi.fn();
const redirect = vi.fn((target: string) => {
  throw new Error(`NEXT_REDIRECT:${target}`);
});

vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

vi.mock('next/navigation', () => ({
  redirect: (target: string) => redirect(target),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('RootCartPageContent', () => {
  beforeEach(() => {
    mockCookies.mockReset();
    redirect.mockClear();
  });

  it('redirects to the recent merchant cart when a storefront cookie exists', async () => {
    mockCookies.mockResolvedValue({
      get: () => ({ value: 'ogabassey' }),
    });

    await expect(RootCartPageContent()).rejects.toThrow(
      'NEXT_REDIRECT:/ogabassey/cart'
    );
    expect(redirect).toHaveBeenCalledWith('/ogabassey/cart');
  });

  it('renders the marketplace guidance when there is no recent storefront', async () => {
    mockCookies.mockResolvedValue({
      get: () => undefined,
    });

    render(await RootCartPageContent());

    expect(
      screen.getByRole('heading', { name: 'Your Cart is Empty' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Browse Ogabassey Store' })
    ).toHaveAttribute('href', '/ogabassey');
    expect(
      screen.getByRole('link', { name: 'Explore Baci Marketplace' })
    ).toHaveAttribute('href', '/');
  });
});
