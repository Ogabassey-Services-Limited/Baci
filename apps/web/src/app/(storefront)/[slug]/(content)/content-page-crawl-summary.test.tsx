import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ContentPageCrawlSummary } from './content-page-crawl-summary';

describe('ContentPageCrawlSummary', () => {
  it('renders contact support context for crawler-visible content pages', () => {
    render(<ContentPageCrawlSummary kind="contact" merchantName="Ogabassey" />);

    expect(
      screen.getByText(
        /Use this contact page when you need help from Ogabassey/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /product availability, order status, delivery questions/i
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/repair bookings/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/swap requests/i)).not.toBeInTheDocument();
  });

  it('keeps electronics-specific contact context for electronics merchants', () => {
    render(
      <ContentPageCrawlSummary
        kind="contact"
        merchantName="Ogabassey"
        businessType="electronics"
      />
    );

    expect(
      screen.getByText(/repair bookings, swap requests/i)
    ).toBeInTheDocument();
  });

  it('renders FAQ context that points shoppers back to exact product pages', () => {
    render(<ContentPageCrawlSummary kind="faq" merchantName="Ogabassey" />);

    expect(
      screen.getByText(/ordering, payments, delivery, returns/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/current price, stock status, condition/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/specific phone, laptop, console/i)
    ).not.toBeInTheDocument();
  });

  it('renders generic about copy for non-electronics merchants', () => {
    render(
      <ContentPageCrawlSummary
        kind="about"
        merchantName="Ike Air and Hair"
        businessType="beauty"
      />
    );

    expect(
      screen.getByText(/type of support shoppers can expect/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/electronics support/i)).not.toBeInTheDocument();
  });
});
