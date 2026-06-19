import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OGABASSEY_SHELL_BANNER_INLINE_SRC } from '@/config/ogabassey-shell-banner-inline';
import { OgabasseyShellMobileHero } from './ogabassey-shell-mobile-hero';

describe('OgabasseyShellMobileHero', () => {
  it('paints a full-width inline-AVIF banner as the LCP candidate', () => {
    const { container } = render(<OgabasseyShellMobileHero />);

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    // Inline data-URI => zero network, paints in the first static-shell flush.
    expect(img?.getAttribute('src')).toBe(OGABASSEY_SHELL_BANNER_INLINE_SRC);
    expect(img?.getAttribute('src')).toMatch(/^data:image\/avif;base64,/);
    // Full-bleed so the element box is large enough to be the Largest
    // Contentful Paint (the bug this fixes demoted LCP to the navbar logo).
    expect(img?.className).toContain('h-full');
    expect(img?.className).toContain('w-full');
    expect(img?.className).toContain('object-cover');
    expect(img?.getAttribute('fetchpriority')).toBe('high');
    expect(img?.getAttribute('decoding')).toBe('sync');
    expect(img?.getAttribute('loading')).toBe('eager');
    expect(img?.getAttribute('width')).toBe('960');
    expect(img?.getAttribute('height')).toBe('540');
  });

  it('is decorative and emits no preload hint or interactive control', () => {
    const html = renderToString(<OgabasseyShellMobileHero />);
    const template = document.createElement('template');
    template.innerHTML = html;

    const img = template.content.querySelector('img');
    // The real streamed carousel owns the accessible banner; the shell copy is
    // baked into the image, so it must not be announced or focusable.
    expect(img?.getAttribute('aria-hidden')).toBe('true');
    expect(img?.getAttribute('alt')).toBe('');
    expect(template.content.querySelector('a')).toBeNull();
    expect(template.content.querySelector('link[rel="preload"]')).toBeNull();
  });

  it('keeps the carousel hero geometry so the streamed banner fills it cleanly', () => {
    const { container } = render(<OgabasseyShellMobileHero />);

    const panel = container.querySelector('.h-48');
    expect(panel).toBeInTheDocument();
    expect(panel?.className).toContain('rounded-2xl');
    expect(panel?.className).toContain('overflow-hidden');
  });
});
