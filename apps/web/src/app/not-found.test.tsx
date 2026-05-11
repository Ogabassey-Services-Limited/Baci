import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import NotFound from './not-found';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/logo', () => ({
  Logo: () => <span>Baci</span>,
}));

describe('NotFound', () => {
  it('renders the recovery heading', () => {
    render(<NotFound />);

    expect(
      screen.getByRole('heading', {
        name: /looks like you've ventured off the map/i,
      })
    ).toBeInTheDocument();
  });

  it('renders the Baci logo', () => {
    render(<NotFound />);

    expect(screen.getByText('Baci')).toBeInTheDocument();
  });

  it('links back to the homepage', () => {
    render(<NotFound />);

    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute(
      'href',
      '/'
    );
  });

  it('links to contact support', () => {
    render(<NotFound />);

    expect(
      screen.getByRole('link', { name: /contact support/i })
    ).toHaveAttribute('href', '/contact');
  });
});
