import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StorefrontThemeProvider } from './storefront-theme-provider';

describe('StorefrontThemeProvider', () => {
  it('renders children inside a light-mode wrapper', () => {
    render(
      <StorefrontThemeProvider>
        <main>Storefront content</main>
      </StorefrontThemeProvider>
    );

    expect(screen.getByRole('main')).toHaveTextContent('Storefront content');
  });

  it('applies the light class to the wrapper element', () => {
    const { container } = render(
      <StorefrontThemeProvider>
        <span>child</span>
      </StorefrontThemeProvider>
    );

    // The outermost element must carry the `light` class so that
    // CSS variables in globals.css scope light-mode tokens to this subtree,
    // overriding any `html.dark` class set by the root ThemeProvider.
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('light');
  });
});
