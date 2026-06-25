import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STOREFRONT_APPEARANCE,
  getStorefrontAppearanceClasses,
  getStorefrontAppearanceClassName,
  getStorefrontDocumentAppearanceClasses,
  resolveStorefrontAppearance,
} from './storefront-appearance';

describe('resolveStorefrontAppearance', () => {
  it('keeps generic storefronts in forced light mode', () => {
    expect(resolveStorefrontAppearance('generic-store')).toEqual({
      mode: 'light',
      variant: 'default',
    });
    expect(resolveStorefrontAppearance(undefined)).toEqual({
      mode: 'light',
      variant: 'default',
    });
    expect(resolveStorefrontAppearance(null)).toEqual({
      mode: 'light',
      variant: 'default',
    });
  });

  it('returns fresh defaults so callers cannot mutate shared appearance state', () => {
    const firstDefault = resolveStorefrontAppearance('generic-store');
    firstDefault.mode = 'system';
    firstDefault.variant = 'ogabassey';

    expect(DEFAULT_STOREFRONT_APPEARANCE).toEqual({
      mode: 'light',
      variant: 'default',
    });
    expect(resolveStorefrontAppearance('another-store')).toEqual({
      mode: 'light',
      variant: 'default',
    });
  });

  it('uses system appearance for OgaBassey slug and custom domain', () => {
    expect(resolveStorefrontAppearance('ogabassey')).toEqual({
      mode: 'system',
      variant: 'ogabassey',
    });
    expect(resolveStorefrontAppearance('https://www.ogabassey.com/')).toEqual({
      mode: 'system',
      variant: 'ogabassey',
    });
  });
});

describe('getStorefrontAppearanceClasses', () => {
  it('keeps the existing light guard classes for default storefronts', () => {
    expect(
      getStorefrontAppearanceClasses({ mode: 'light', variant: 'default' })
    ).toEqual([
      'storefront-theme-scope',
      'storefront-variant-default',
      'light',
      'storefront-light',
    ]);
  });

  it('adds stable system and variant classes for OgaBassey', () => {
    expect(
      getStorefrontAppearanceClassName({
        mode: 'system',
        variant: 'ogabassey',
      })
    ).toBe(
      'storefront-theme-scope storefront-variant-ogabassey storefront-mode-system contents'
    );
  });

  it('keeps wrapper-only classes out of document-level appearance classes', () => {
    expect(
      getStorefrontDocumentAppearanceClasses({
        mode: 'system',
        variant: 'ogabassey',
      })
    ).toEqual([
      'storefront-theme-scope',
      'storefront-variant-ogabassey',
      'storefront-mode-system',
    ]);
  });
});
