import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { OgabasseyStaticResourceHints } from '@/app/(storefront)/ogabassey/ogabassey-static-resource-hints';
import {
  HERO_DESKTOP_LCP_SRC,
  HERO_MOBILE_LCP_SRC,
} from '@/components/storefront/ogabassey/components/hero-data';
import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';

describe('OgabasseyStaticResourceHints', () => {
  it('emits viewport-scoped hero image hints into server HTML', () => {
    const html = renderToString(<OgabasseyStaticResourceHints />);
    const template = document.createElement('template');
    template.innerHTML = html;
    const links = Array.from(template.content.querySelectorAll('link'));
    const findLink = (predicate: (link: HTMLLinkElement) => boolean) =>
      links.find(predicate);

    const dnsPrefetch = findLink(
      (link) =>
        link.getAttribute('rel') === 'dns-prefetch' &&
        link.getAttribute('href') === OGABASSEY_CDN_ORIGIN
    );
    const preconnect = findLink(
      (link) =>
        link.getAttribute('rel') === 'preconnect' &&
        link.getAttribute('href') === OGABASSEY_CDN_ORIGIN
    );
    const desktopPreload = findLink(
      (link) =>
        link.getAttribute('rel') === 'preload' &&
        link.getAttribute('href') === HERO_DESKTOP_LCP_SRC
    );
    const mobilePreload = findLink(
      (link) =>
        link.getAttribute('rel') === 'preload' &&
        link.getAttribute('href') === HERO_MOBILE_LCP_SRC
    );

    expect(dnsPrefetch).toBeDefined();
    expect(preconnect).toBeDefined();
    expect(desktopPreload).toBeDefined();
    expect(desktopPreload?.getAttribute('as')).toBe('image');
    expect(desktopPreload?.getAttribute('type')).toBe('image/avif');
    expect(desktopPreload?.getAttribute('fetchpriority')).toBe('high');
    expect(desktopPreload?.getAttribute('media')).toBe('(min-width: 768px)');
    expect(mobilePreload).toBeDefined();
    expect(mobilePreload?.getAttribute('as')).toBe('image');
    expect(mobilePreload?.getAttribute('type')).toBe('image/avif');
    expect(mobilePreload?.getAttribute('fetchpriority')).toBe('high');
    expect(mobilePreload?.getAttribute('media')).toBe('(max-width: 767px)');
    expect(
      links.filter((link) => link.getAttribute('rel') === 'preload')
    ).toHaveLength(2);
  });
});
