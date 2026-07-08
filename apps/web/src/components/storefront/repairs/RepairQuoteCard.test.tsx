import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RepairQuoteCard } from './RepairQuoteCard';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

const baseQuote = {
  id: 'quote-1',
  serviceTypeId: 'st-1',
  serviceTypeName: 'Screen Replacement',
  price: 25000,
  isFromPrice: true,
  partQuality: null,
  turnaround: null,
  warrantyDays: null,
  description: null,
};

describe('RepairQuoteCard', () => {
  it('renders the service name and a "From" price prefix when is_from_price is true', () => {
    render(
      <RepairQuoteCard
        bookHref="/ogabassey/repair?device=apple-iphone-13&quote=quote-1"
        currency="NGN"
        quote={baseQuote}
      />
    );

    expect(screen.getByText('Screen Replacement')).toBeInTheDocument();
    expect(screen.getByText(/from/i)).toBeInTheDocument();
    expect(screen.getByText(/25,000/)).toBeInTheDocument();
  });

  it('omits the "From" prefix for fixed prices', () => {
    render(
      <RepairQuoteCard
        bookHref="/ogabassey/repair?device=apple-iphone-13&quote=quote-1"
        currency="NGN"
        quote={{ ...baseQuote, isFromPrice: false }}
      />
    );

    expect(screen.queryByText(/from/i)).not.toBeInTheDocument();
  });

  it('shows part quality, turnaround and warranty badges when present', () => {
    render(
      <RepairQuoteCard
        bookHref="/ogabassey/repair?device=apple-iphone-13&quote=quote-1"
        currency="NGN"
        quote={{
          ...baseQuote,
          partQuality: 'OEM',
          turnaround: '2-3 days',
          warrantyDays: 90,
        }}
      />
    );

    expect(screen.getByText('OEM')).toBeInTheDocument();
    expect(screen.getByText('2-3 days')).toBeInTheDocument();
    expect(screen.getByText(/90-day warranty/i)).toBeInTheDocument();
  });

  it('links the book-this-repair action to the wizard with device and quote params', () => {
    render(
      <RepairQuoteCard
        bookHref="/ogabassey/repair?device=apple-iphone-13&quote=quote-1"
        currency="NGN"
        quote={baseQuote}
      />
    );

    expect(
      screen.getByRole('link', { name: /book this repair/i })
    ).toHaveAttribute(
      'href',
      '/ogabassey/repair?device=apple-iphone-13&quote=quote-1'
    );
  });

  it('renders the public description when present', () => {
    render(
      <RepairQuoteCard
        bookHref="/ogabassey/repair?device=apple-iphone-13&quote=quote-1"
        currency="NGN"
        quote={{ ...baseQuote, description: 'Includes free diagnostics.' }}
      />
    );

    expect(screen.getByText('Includes free diagnostics.')).toBeInTheDocument();
  });
});
