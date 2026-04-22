import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorefrontThemeProvider } from './storefront-theme-provider';

describe('StorefrontThemeProvider', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('storefront-light');
    document.documentElement.removeAttribute('data-storefront-light-count');
    document.body.classList.remove('storefront-light');
    document.body.removeAttribute('data-storefront-light-count');
  });

  afterEach(() => {
    document.documentElement.classList.remove('storefront-light');
    document.documentElement.removeAttribute('data-storefront-light-count');
    document.body.classList.remove('storefront-light');
    document.body.removeAttribute('data-storefront-light-count');
  });

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

    // The outermost element must carry the `light` class so that:
    // 1. CSS variables in globals.css scope light-mode tokens to this subtree,
    //    overriding any `html.dark` class set by the root ThemeProvider.
    // 2. The Tailwind `darkMode` selector configured in tailwind.config.ts
    //    (`&:where(.dark, .dark *):not(.light):not(.light *)`) excludes this
    //    wrapper and its descendants from raw `dark:*` utility variants.
    // Without both, components using utilities like `dark:bg-gray-900` would
    // still render dark styles inside the storefront subtree.
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('light');
  });

  it('forces light mode for portal surfaces while mounted', () => {
    const { unmount } = render(
      <StorefrontThemeProvider>
        <div>content</div>
      </StorefrontThemeProvider>
    );

    expect(document.documentElement).toHaveClass('storefront-light');
    expect(document.body).toHaveClass('storefront-light');
    expect(
      document.documentElement.getAttribute('data-storefront-light-count')
    ).toBe('1');

    unmount();

    expect(document.documentElement).not.toHaveClass('storefront-light');
    expect(document.body).not.toHaveClass('storefront-light');
    expect(
      document.documentElement.getAttribute('data-storefront-light-count')
    ).toBeNull();
  });

  it('reference-counts portal light mode across multiple mounted providers', () => {
    const first = render(
      <StorefrontThemeProvider>
        <div>first</div>
      </StorefrontThemeProvider>
    );
    const second = render(
      <StorefrontThemeProvider>
        <div>second</div>
      </StorefrontThemeProvider>
    );

    expect(document.documentElement).toHaveClass('storefront-light');
    expect(document.body).toHaveClass('storefront-light');
    expect(
      document.documentElement.getAttribute('data-storefront-light-count')
    ).toBe('2');
    expect(document.body.getAttribute('data-storefront-light-count')).toBe('2');

    first.unmount();

    expect(document.documentElement).toHaveClass('storefront-light');
    expect(document.body).toHaveClass('storefront-light');
    expect(
      document.documentElement.getAttribute('data-storefront-light-count')
    ).toBe('1');
    expect(document.body.getAttribute('data-storefront-light-count')).toBe('1');

    second.unmount();

    expect(document.documentElement).not.toHaveClass('storefront-light');
    expect(document.body).not.toHaveClass('storefront-light');
    expect(
      document.documentElement.getAttribute('data-storefront-light-count')
    ).toBeNull();
    expect(
      document.body.getAttribute('data-storefront-light-count')
    ).toBeNull();
  });
});
