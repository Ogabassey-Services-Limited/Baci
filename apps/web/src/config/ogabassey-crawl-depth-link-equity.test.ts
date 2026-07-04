import { describe, expect, it } from 'vitest';
import {
  linkPairs,
  OGABASSEY_CRAWL_DEPTH_LINK_EQUITY_GROUPS,
  parsePipePair,
  productLinkPairs,
} from './ogabassey-crawl-depth-link-equity';

describe('Ogabassey crawl-depth link equity helpers', () => {
  it('parses valid pipe-delimited entries', () => {
    expect(parsePipePair(' /smartphones | Smartphones ')).toEqual({
      value: '/smartphones',
      label: 'Smartphones',
    });
    expect(linkPairs(['/compare|Compare products'])).toEqual([
      { href: '/compare', label: 'Compare products' },
    ]);
    expect(productLinkPairs(['iphone-xr-3gb-128gb|iPhone XR 128GB'])).toEqual([
      { productSlug: 'iphone-xr-3gb-128gb', label: 'iPhone XR 128GB' },
    ]);
  });

  it('throws for malformed or blank pipe-delimited entries', () => {
    const malformedEntries = [
      'missing-separator',
      '/smartphones|',
      '|Smartphones',
      '/smartphones| ',
      ' |Smartphones',
      '/smartphones|Smartphones|Extra',
    ];

    for (const entry of malformedEntries) {
      expect(() => parsePipePair(entry)).toThrow(
        'Malformed Ogabassey crawl-depth link entry'
      );
    }
  });

  it('throws when literal href entries are not internal paths', () => {
    expect(() => linkPairs(['smartphones|Smartphones'])).toThrow(
      "Ogabassey crawl-depth link href must start with '/'"
    );
    expect(() =>
      linkPairs(['https://ogabassey.com/smartphones|Smartphones'])
    ).toThrow("Ogabassey crawl-depth link href must start with '/'");
  });

  it('keeps the exported crawl-depth groups well formed', () => {
    const links = OGABASSEY_CRAWL_DEPTH_LINK_EQUITY_GROUPS.flatMap(
      (group) => group.links
    );
    const productLinks = OGABASSEY_CRAWL_DEPTH_LINK_EQUITY_GROUPS.flatMap(
      (group) => group.productLinks
    );

    expect(links.length).toBeGreaterThan(0);
    expect(productLinks.length).toBeGreaterThan(0);
    expect(links.every((link) => link.href.startsWith('/'))).toBe(true);
    expect(productLinks.every((link) => link.productSlug.trim())).toBe(true);
  });
});
