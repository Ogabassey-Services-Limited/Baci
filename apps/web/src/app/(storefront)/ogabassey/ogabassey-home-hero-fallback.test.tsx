import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock(
  '@/components/storefront/ogabassey/components/ogabassey-shell-mobile-hero',
  () => ({
    OgabasseyShellMobileHero: () => (
      <div data-testid="mobile-shell-hero">Mobile shell hero</div>
    ),
  })
);

import { OgabasseyHomeHeroFallback } from './ogabassey-home-hero-fallback';

describe('OgabasseyHomeHeroFallback', () => {
  it('preserves mobile and desktop hero geometry while dynamic content streams', () => {
    const { container } = render(<OgabasseyHomeHeroFallback />);

    expect(
      container.querySelector('[data-ogabassey-home-hero-fallback="true"]')
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="mobile-shell-hero"]')
    ).toBeInTheDocument();
    const classNames = Array.from(container.querySelectorAll('[class]')).map(
      (node) => node.getAttribute('class') ?? ''
    );
    expect(
      classNames.some((className) => className.includes('lg:h-[540px]'))
    ).toBe(true);
    expect(
      classNames.some((className) => className.includes('lg:col-span-3'))
    ).toBe(true);
    expect(
      classNames.some((className) => className.includes('lg:col-span-2'))
    ).toBe(true);
  });
});
