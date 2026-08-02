import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getContrastRatio } from '@/lib/color-utils';
import { deriveCuratedTheme } from '@/lib/storefront-defaults/derive-curated-theme';
import { HeaderSearch } from './header-search';

describe('HeaderSearch', () => {
  it.each([
    ['light', '#000000', '#ffffff', '#777777'],
    ['dark', '#ffffff', '#000000', '#777777'],
    ['boundary', '#777777', '#777777', '#ffffff'],
    ['threshold', '#757575', '#757575', '#ffffff'],
  ])('keeps desktop and mobile search descendants accessible for the %s palette', (_name, primary, background, accent) => {
    const theme = deriveCuratedTheme({ primary, background, accent });
    const onChange = vi.fn();

    const { container } = render(
      <div
        style={{
          backgroundColor: theme.colors.header.background,
          color: theme.colors.header.text,
        }}
      >
        <HeaderSearch
          glassEffect={false}
          isScrolled={false}
          layout="logo-left-nav-center"
          onChange={onChange}
          radius="full"
          style="outline"
          value=""
        />
        <HeaderSearch
          mobile
          onChange={onChange}
          radius="full"
          style="outline"
          value=""
        />
      </div>
    );

    const [desktop, mobile] = screen.getAllByRole('searchbox');
    const icon = container.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).not.toHaveClass('opacity-50');
    expect(desktop).toHaveClass('border-current!');
    expect(mobile).toHaveClass('border-current!');
    expect(desktop).toHaveClass('placeholder:!text-current');
    expect(mobile).toHaveClass('placeholder:!text-current');
    expect(
      getContrastRatio(theme.colors.header.text, theme.colors.header.background)
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      getContrastRatio(theme.colors.header.text, theme.colors.header.background)
    ).toBeGreaterThanOrEqual(3);
  });
});
