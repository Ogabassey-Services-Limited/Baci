import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StorefrontThemeProvider } from './storefront-theme-provider';

const mockThemeProvider = vi.fn(({ children }: { children: ReactNode }) => (
  <div data-testid="theme-provider">{children}</div>
));

vi.mock('next-themes', () => ({
  ThemeProvider: (props: {
    attribute: string;
    children: ReactNode;
    disableTransitionOnChange?: boolean;
    forcedTheme?: string;
    nonce?: string;
  }) => mockThemeProvider(props),
}));

vi.mock('@/contexts/NonceProvider', () => ({
  useNonce: () => ({ nonce: 'nonce-123' }),
}));

describe('StorefrontThemeProvider', () => {
  it('forces the storefront shell to render in light mode', () => {
    mockThemeProvider.mockClear();

    render(
      <StorefrontThemeProvider>
        <main>Storefront content</main>
      </StorefrontThemeProvider>
    );

    expect(screen.getByRole('main')).toHaveTextContent('Storefront content');
    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
    expect(mockThemeProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        attribute: 'class',
        disableTransitionOnChange: true,
        forcedTheme: 'light',
        nonce: 'nonce-123',
      })
    );
  });
});
