import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CommercialSupportLinks } from './commercial-support-links';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe('CommercialSupportLinks', () => {
  it('renders crawlable compare/support links when provided', () => {
    render(
      <CommercialSupportLinks
        heading="Compare and Buying Guides"
        links={[
          {
            href: '/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
            label: 'iPhone 17 Pro Max vs Samsung Galaxy Z TriFold',
          },
        ]}
      />
    );

    expect(
      screen.getByRole('heading', { name: /Compare and Buying Guides/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: /iPhone 17 Pro Max vs Samsung Galaxy Z TriFold/i,
      })
    ).toHaveAttribute(
      'href',
      '/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
    );
  });
});
