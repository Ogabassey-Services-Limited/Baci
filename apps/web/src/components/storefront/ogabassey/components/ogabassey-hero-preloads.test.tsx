import { render } from '@testing-library/react';
import * as ReactDOM from 'react-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HERO_DESKTOP_LCP_SRC,
  HERO_MOBILE_LCP_FALLBACK_SRC,
  HERO_MOBILE_LCP_SRC,
} from './hero-data';
import { OgabasseyHeroPreloads } from './ogabassey-hero-preloads';

describe('OgabasseyHeroPreloads', () => {
  const preloadSpy = vi.spyOn(ReactDOM, 'preload');

  beforeEach(() => {
    preloadSpy.mockClear();
  });

  function clearHints() {
    document
      .querySelectorAll(
        'link[rel="preload"], link[rel="preconnect"], link[rel="dns-prefetch"]'
      )
      .forEach((link) => {
        link.remove();
      });
  }

  it('does not emit duplicate third-party warmups', () => {
    clearHints();
    render(<OgabasseyHeroPreloads />);

    const preconnectHrefs = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="preconnect"]')
    ).map((l) => l.getAttribute('href'));
    expect(preconnectHrefs).toEqual([]);

    const dnsHrefs = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="dns-prefetch"]')
    ).map((l) => l.getAttribute('href'));
    expect(dnsHrefs).toEqual([]);
  });

  it('emits viewport-scoped manual LCP preloads through React resource hints', () => {
    clearHints();
    render(<OgabasseyHeroPreloads />);

    expect(preloadSpy).toHaveBeenCalledWith(
      HERO_DESKTOP_LCP_SRC,
      expect.objectContaining({
        as: 'image',
        fetchPriority: 'high',
        media: '(min-width: 768px)',
        type: 'image/avif',
      })
    );
    expect(preloadSpy).toHaveBeenCalledWith(
      HERO_MOBILE_LCP_SRC,
      expect.objectContaining({
        as: 'image',
        fetchPriority: 'high',
        media: '(max-width: 767px)',
        type: 'image/avif',
      })
    );
    expect(
      preloadSpy.mock.calls.some(([href]) => href === HERO_MOBILE_LCP_FALLBACK_SRC)
    ).toBe(false);
  });
});
