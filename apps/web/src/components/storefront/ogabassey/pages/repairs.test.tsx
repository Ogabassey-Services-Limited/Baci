import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OgabasseyV2Repairs } from './repairs';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (path: string) => path,
}));

describe('OgabasseyV2Repairs', () => {
  it('links repair and swap actions at the custom-domain root', () => {
    render(<OgabasseyV2Repairs basePath="" />);

    expect(
      screen.getByRole('link', { name: /book a repair/i })
    ).toHaveAttribute('href', '/repair');
    expect(
      screen.getByRole('link', { name: /trade-in instead/i })
    ).toHaveAttribute('href', '/swap');
  });

  it('keeps path-based storefront links under the merchant slug', () => {
    render(<OgabasseyV2Repairs basePath="/ogabassey" />);

    expect(
      screen.getByRole('link', { name: /book a repair/i })
    ).toHaveAttribute('href', '/ogabassey/repair');
    expect(
      screen.getByRole('link', { name: /trade-in instead/i })
    ).toHaveAttribute('href', '/ogabassey/swap');
  });

  it('normalizes fallback and trailing-slash storefront paths', () => {
    const { rerender } = render(<OgabasseyV2Repairs storeSlug="ogabassey" />);

    expect(
      screen.getByRole('link', { name: /book a repair/i })
    ).toHaveAttribute('href', '/ogabassey/repair');
    expect(
      screen.getByRole('link', { name: /trade-in instead/i })
    ).toHaveAttribute('href', '/ogabassey/swap');

    rerender(<OgabasseyV2Repairs basePath="/ogabassey/" />);

    expect(
      screen.getByRole('link', { name: /book a repair/i })
    ).toHaveAttribute('href', '/ogabassey/repair');
    expect(
      screen.getByRole('link', { name: /trade-in instead/i })
    ).toHaveAttribute('href', '/ogabassey/swap');
  });

  it('renders the repair lab content and service cards', () => {
    render(<OgabasseyV2Repairs />);

    expect(
      screen.getByRole('heading', { name: /repair lab/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/don't ditch it/i)).toBeInTheDocument();
    expect(screen.getByText('Screen Renewal')).toBeInTheDocument();
    expect(screen.getByText('Battery Boost')).toBeInTheDocument();
  });
});
