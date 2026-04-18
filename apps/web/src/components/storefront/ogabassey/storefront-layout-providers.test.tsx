import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./providers/v2-theme-context', () => ({
  V2ThemeProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  ),
}));

vi.mock('./providers/v2-saved-context', () => ({
  V2SavedProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="saved-provider">{children}</div>
  ),
}));

vi.mock('./providers/v2-comparison-context', () => ({
  V2ComparisonProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="comparison-provider">{children}</div>
  ),
}));

import { OgabasseyLayoutProviders } from './storefront-layout-providers';

describe('OgabasseyLayoutProviders', () => {
  it('keeps only theme and saved providers in the global shell', () => {
    render(
      <OgabasseyLayoutProviders>
        <div>Storefront shell</div>
      </OgabasseyLayoutProviders>
    );

    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
    expect(screen.getByTestId('saved-provider')).toBeInTheDocument();
    expect(screen.queryByTestId('comparison-provider')).not.toBeInTheDocument();
    expect(screen.getByText('Storefront shell')).toBeInTheDocument();
  });
});
