import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  HERO_DESKTOP_LCP_SRC,
  HERO_MOBILE_LCP_SRC,
} from './hero-data';
import {
  OGABASSEY_HERO_PRECONNECT_ORIGINS,
  OgabasseyHeroPreloads,
} from './ogabassey-hero-preloads';

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

  it('emits dns-prefetch + preconnect hints for every origin in the constant', () => {
    clearHints();
    render(<OgabasseyHeroPreloads />);

    const expectedOrigins = Array.from(OGABASSEY_HERO_PRECONNECT_ORIGINS);

    const preconnectHrefs = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="preconnect"]')
    ).map((l) => l.getAttribute('href'));
    expect(preconnectHrefs.sort()).toEqual([...expectedOrigins].sort());

    const dnsHrefs = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="dns-prefetch"]')
    ).map((l) => l.getAttribute('href'));
    expect(dnsHrefs.sort()).toEqual([...expectedOrigins].sort());
  });

  it('omits crossorigin so the preconnect pool matches the no-CORS image fetches', () => {
    clearHints();
    render(<OgabasseyHeroPreloads />);

    const preconnects = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="preconnect"]')
    );
    expect(preconnects.length).toBeGreaterThan(0);
    // Next.js <Image> requests these origins without CORS. A `crossorigin`
    // preconnect would open a separate connection pool the actual <img>
    // GETs can't reuse, defeating the warmup.
    for (const link of preconnects) {
      expect(link).not.toHaveAttribute('crossorigin');
    }
  });

  it('emits viewport-conditional preloads for the desktop and mobile LCP assets', () => {
    clearHints();
    render(<OgabasseyHeroPreloads />);

    const preloads = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="image"]')
    ).map((link) => ({
      as: link.getAttribute('as'),
      fetchPriority: link.getAttribute('fetchpriority'),
      href: link.getAttribute('href'),
      media: link.getAttribute('media'),
    }));

    expect(preloads).toHaveLength(2);
    expect(preloads).toEqual(
      expect.arrayContaining([
        {
          as: 'image',
          fetchPriority: 'high',
          href: HERO_DESKTOP_LCP_SRC,
          media: '(min-width: 768px)',
        },
        {
          as: 'image',
          fetchPriority: 'high',
          href: HERO_MOBILE_LCP_SRC,
          media: '(max-width: 767px)',
        },
      ])
    );
  });
});
