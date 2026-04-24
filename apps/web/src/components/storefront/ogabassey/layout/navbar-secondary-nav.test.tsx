import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NavbarSecondaryNav } from './navbar-secondary-nav';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: {
    children: ReactNode;
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('NavbarSecondaryNav', () => {
  it('renders category and utility links under the store base path', async () => {
    const user = userEvent.setup();

    render(
      <NavbarSecondaryNav
        basePath="/ogabassey"
        categories={[{ name: 'Phones', slug: 'smartphones' }]}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /shop by category/i })
    );

    expect(screen.getByRole('link', { name: 'Phones' })).toHaveAttribute(
      'href',
      '/ogabassey/smartphones'
    );
    expect(screen.getByRole('link', { name: /imei checker/i })).toHaveAttribute(
      'href',
      '/ogabassey/imei-check'
    );
    expect(screen.getByRole('link', { name: /blog/i })).toHaveAttribute(
      'href',
      '/ogabassey/blog'
    );
  });

  it('normalizes legacy phone aliases to the smartphones route', async () => {
    const user = userEvent.setup();

    render(
      <NavbarSecondaryNav
        basePath="/ogabassey"
        categories={[{ name: 'Phones', slug: 'phones' }]}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /shop by category/i })
    );

    expect(screen.getByRole('link', { name: 'Phones' })).toHaveAttribute(
      'href',
      '/ogabassey/smartphones'
    );
    expect(screen.getByRole('link', { name: /imei checker/i })).toHaveAttribute(
      'href',
      '/ogabassey/imei-check'
    );
    expect(screen.getByRole('link', { name: /blog/i })).toHaveAttribute(
      'href',
      '/ogabassey/blog'
    );
  });

  it('shows a loading placeholder when categories are not available yet', async () => {
    const user = userEvent.setup();

    render(<NavbarSecondaryNav basePath="/ogabassey" categories={[]} />);

    await user.click(
      screen.getByRole('button', { name: /shop by category/i })
    );

    expect(screen.getByText('Loading categories...')).toBeInTheDocument();
  });

  it('closes the category dropdown when the user clicks outside', async () => {
    const user = userEvent.setup();

    render(
      <NavbarSecondaryNav
        basePath="/ogabassey"
        categories={[{ name: 'Phones', slug: 'phones' }]}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /shop by category/i })
    );
    expect(screen.getByRole('link', { name: 'Phones' })).toBeInTheDocument();

    await user.click(document.body);

    expect(screen.queryByRole('link', { name: 'Phones' })).not.toBeInTheDocument();
  });
});
