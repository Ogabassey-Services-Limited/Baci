import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  HERO_DESKTOP_LCP_SRC,
  HERO_MOBILE_LCP_FALLBACK_SRC,
  HERO_MOBILE_LCP_SRC,
} from './hero-data';
import { OgabasseyHeroPreloads } from './ogabassey-hero-preloads';

describe('OgabasseyHeroPreloads', () => {
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

  it('emits viewport-scoped manual LCP preloads', () => {
    clearHints();
    render(<OgabasseyHeroPreloads />);

    const preloads = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="image"]')
    ).map((link) => ({
      fetchPriority: link.getAttribute('fetchpriority'),
      href: link.getAttribute('href'),
      media: link.getAttribute('media'),
      type: link.getAttribute('type'),
    }));

    expect(preloads).toHaveLength(2);
    expect(preloads).toEqual(
      expect.arrayContaining([
        {
          fetchPriority: 'high',
          href: HERO_DESKTOP_LCP_SRC,
          media: '(min-width: 768px)',
          type: 'image/avif',
        },
        {
          fetchPriority: 'high',
          href: HERO_MOBILE_LCP_SRC,
          media: '(max-width: 767px)',
          type: 'image/avif',
        },
      ])
    );
    expect(
      preloads.some((preload) => preload.href === HERO_MOBILE_LCP_FALLBACK_SRC)
    ).toBe(false);
  });
});
