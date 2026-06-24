import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OGABASSEY_MERCHANT_ID } from '@/config/ogabassey';
import { OgabasseyHomeShellFallback } from './ogabassey-home-shell-fallback';

vi.mock('./ogabassey-home-hero-section', () => ({
  OgabasseyHomeHeroSection: ({
    merchantId,
    pathPrefix,
  }: {
    merchantId: string;
    pathPrefix: string;
  }) => (
    <section
      aria-label="Product hero"
      data-merchant={merchantId}
      data-prefix={pathPrefix}
    />
  ),
}));

describe('OgabasseyHomeShellFallback', () => {
  it('renders storefront chrome and the product hero in the static shell', () => {
    render(<OgabasseyHomeShellFallback />);

    expect(
      screen.getByRole('status', { name: /loading storefront chrome/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: /product hero/i })
    ).toHaveAttribute('data-merchant', OGABASSEY_MERCHANT_ID);
    expect(
      screen.getByRole('region', { name: /product hero/i })
    ).toHaveAttribute('data-prefix', '');
  });

  it('accepts an explicit prefix for isolated route tests', () => {
    render(<OgabasseyHomeShellFallback pathPrefix="/preview" />);

    expect(
      screen.getByRole('region', { name: /product hero/i })
    ).toHaveAttribute('data-prefix', '/preview');
  });
});
