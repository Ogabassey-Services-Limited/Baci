import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StorefrontLayoutLoadingFallback } from './storefront-layout-loading-fallback';

describe('StorefrontLayoutLoadingFallback', () => {
  it('reserves the storefront header and hero shell while layout data streams', () => {
    render(<StorefrontLayoutLoadingFallback />);

    expect(
      screen.getByRole('status', { name: /loading storefront shell/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(
      screen.getByRole('region', {
        name: /mobile hero loading placeholder/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', {
        name: /desktop hero loading placeholder/i,
      })
    ).toBeInTheDocument();
  });
});
