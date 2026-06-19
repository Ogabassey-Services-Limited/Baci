import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { OgabasseyStaticResourceHints } from '@/app/(storefront)/ogabassey/ogabassey-static-resource-hints';
import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';

describe('OgabasseyStaticResourceHints', () => {
  it('keeps static hints connection-only so viewport image preloads stay owned by markup', () => {
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
    expect(dnsPrefetch).toBeDefined();
    expect(preconnect).toBeDefined();
    expect(
      links.filter((link) => link.getAttribute('rel') === 'preload')
    ).toHaveLength(0);
  });
});
