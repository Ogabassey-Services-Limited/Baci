import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OgabasseyHomeShellFallback } from './ogabassey-home-shell-fallback';

vi.mock('./ogabassey-home-hero-fallback', () => ({
  OgabasseyHomeHeroFallback: () => (
    <section aria-hidden="true" data-testid="hero-fallback" />
  ),
}));

describe('OgabasseyHomeShellFallback', () => {
  it('renders themed storefront chrome and a non-interactive hero skeleton in the static shell', () => {
    const { container } = render(<OgabasseyHomeShellFallback />);

    const fallback = container.querySelector(
      '[data-ogabassey-static-shell-fallback="true"]'
    );

    expect(fallback).toHaveStyle({ '--store-primary': '#d62027' });
    expect(
      screen.getByRole('status', { name: /loading storefront chrome/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId('hero-fallback')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
