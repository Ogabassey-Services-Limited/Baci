import { describe, expect, it } from 'vitest';
import {
  capLinkModuleItems,
  dedupeLinkModuleItems,
  pruneEmptyLinkModules,
  validateInternalModuleHref,
} from './link-module-utils';

describe('storefront link module utilities', () => {
  it('rejects non-internal hrefs before module rendering', () => {
    expect(() => validateInternalModuleHref('/smartphones')).not.toThrow();
    expect(() => validateInternalModuleHref('smartphones')).toThrow(
      "Storefront link module href must start with '/'"
    );
    expect(() =>
      validateInternalModuleHref('https://ogabassey.com/smartphones')
    ).toThrow("Storefront link module href must start with '/'");
    expect(() => validateInternalModuleHref('//evil.com')).toThrow(
      "Storefront link module href must start with '/'"
    );
  });

  it('deduplicates module items by href while preserving first useful label', () => {
    expect(
      dedupeLinkModuleItems([
        { href: '/smartphones', label: 'Smartphones' },
        { href: '/laptops', label: 'Laptops' },
        { href: '/smartphones', label: 'Phones' },
      ])
    ).toEqual([
      { href: '/smartphones', label: 'Smartphones' },
      { href: '/laptops', label: 'Laptops' },
    ]);
  });

  it('drops modules with no links after generation', () => {
    expect(
      pruneEmptyLinkModules([
        {
          id: 'empty',
          title: 'Empty',
          description: 'No links',
          items: [],
        },
        {
          id: 'categories',
          title: 'Categories',
          description: 'Useful category paths',
          items: [{ href: '/smartphones', label: 'Smartphones' }],
        },
      ])
    ).toEqual([
      {
        id: 'categories',
        title: 'Categories',
        description: 'Useful category paths',
        items: [{ href: '/smartphones', label: 'Smartphones' }],
      },
    ]);
  });

  it('caps module items after deduping while preserving order', () => {
    expect(
      capLinkModuleItems(
        [
          { href: '/smartphones', label: 'Smartphones' },
          { href: '/laptops', label: 'Laptops' },
          { href: '/smartphones', label: 'Phones' },
          { href: '/audio', label: 'Audio' },
        ],
        2
      )
    ).toEqual([
      { href: '/smartphones', label: 'Smartphones' },
      { href: '/laptops', label: 'Laptops' },
    ]);
  });

  it('returns no module items when the cap is zero or lower', () => {
    expect(
      capLinkModuleItems([{ href: '/smartphones', label: 'Smartphones' }], 0)
    ).toEqual([]);
    expect(
      capLinkModuleItems([{ href: '/smartphones', label: 'Smartphones' }], -1)
    ).toEqual([]);
  });
});
