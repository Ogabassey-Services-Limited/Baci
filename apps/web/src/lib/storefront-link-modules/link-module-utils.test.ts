import { describe, expect, it } from 'vitest';
import {
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
});
