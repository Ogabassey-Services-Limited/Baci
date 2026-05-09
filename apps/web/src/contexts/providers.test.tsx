import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/contexts/providers';

const TEST_NONCE = 'nonce-123';

const themeProviderMock = vi.fn(
  ({
    children,
  }: {
    children: ReactNode;
    forcedTheme?: string;
    nonce?: string;
  }) => <div data-testid="theme-provider">{children}</div>
);

vi.mock('next-themes', () => ({
  ThemeProvider: (props: {
    children: ReactNode;
    forcedTheme?: string;
    nonce?: string;
  }) => themeProviderMock(props),
}));

vi.mock('@/contexts/auth-context', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}));

vi.mock('@/hooks/use-cart', () => ({
  CartProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="cart-provider">{children}</div>
  ),
}));

describe('Providers', () => {
  beforeEach(() => {
    themeProviderMock.mockClear();
  });

  it('wraps app content with root client providers in order', () => {
    render(
      <Providers nonce={TEST_NONCE}>
        <main>App content</main>
      </Providers>
    );

    const themeProvider = screen.getByTestId('theme-provider');
    const authProvider = screen.getByTestId('auth-provider');
    const cartProvider = screen.getByTestId('cart-provider');
    const content = screen.getByRole('main');

    expect(content).toHaveTextContent('App content');
    expect(themeProvider).toContainElement(authProvider);
    expect(authProvider).toContainElement(cartProvider);
    expect(cartProvider).toContainElement(content);
    const themeProviderProps = themeProviderMock.mock.calls[0]?.[0];
    expect(themeProviderProps).not.toHaveProperty('forcedTheme');
    expect(themeProviderProps).toEqual(
      expect.objectContaining({
        nonce: TEST_NONCE,
      })
    );
  });

  it.each([
    'light',
    'dark',
  ])('passes through the %s forced theme', (forcedTheme) => {
    render(
      <Providers forcedTheme={forcedTheme} nonce={TEST_NONCE}>
        <main>App content</main>
      </Providers>
    );

    expect(themeProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        forcedTheme,
        nonce: TEST_NONCE,
      })
    );
  });
});
