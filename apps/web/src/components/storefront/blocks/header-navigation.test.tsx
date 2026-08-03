import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { getContrastRatio } from '@/lib/color-utils';
import { deriveCuratedTheme } from '@/lib/storefront-defaults/derive-curated-theme';
import { HeaderNavigation } from './header-navigation';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (value: string) => value,
}));

describe('HeaderNavigation', () => {
  it.each([
    ['light', '#000000', '#ffffff', '#777777'],
    ['dark', '#ffffff', '#000000', '#777777'],
    ['boundary', '#777777', '#777777', '#ffffff'],
    ['threshold', '#757575', '#757575', '#ffffff'],
  ])('keeps normal and hover navigation text at AA contrast for the %s palette', (_name, primary, background, accent) => {
    const theme = deriveCuratedTheme({ primary, background, accent });

    render(
      <div
        style={{
          backgroundColor: theme.colors.header.background,
          color: theme.colors.header.text,
        }}
      >
        <HeaderNavigation
          getHref={(path) => path}
          links={[{ label: 'Shop', url: '/shop' }]}
          layout="logo-left-nav-center"
        />
      </div>
    );

    const link = screen.getByRole('link', { name: 'Shop' });
    expect(link).toHaveClass('hover:underline');
    expect(link).not.toHaveClass('hover:opacity-70');
    expect(
      getContrastRatio(theme.colors.header.text, theme.colors.header.background)
    ).toBeGreaterThanOrEqual(4.5);
  });
});
