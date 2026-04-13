import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a {...props}>{children}</a>,
}));

const { default: RootCartPage, RootCartPageContent } = await import('./page');

describe('RootCartPage', () => {
  beforeEach(() => {
    mockCookies.mockReset();
    redirect.mockClear();
  });

  it('redirects to the recent merchant cart when the cookie exists', async () => {
    mockCookies.mockResolvedValue({
      get: () => ({ value: 'ogabassey' }),
    });

    await expect(RootCartPageContent()).rejects.toThrow(
      'NEXT_REDIRECT:/ogabassey/cart'
    );
    expect(redirect).toHaveBeenCalledWith('/ogabassey/cart');
  });

  it('renders marketplace guidance when no recent merchant cookie exists', async () => {
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
  });

  it('renders a local fallback while cart cookies are pending', () => {
    mockCookies.mockReturnValue(
      new Promise(() => {
        // Intentionally never resolves to keep the local fallback visible.
      })
    );

    render(<RootCartPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading cart');
  });
});
