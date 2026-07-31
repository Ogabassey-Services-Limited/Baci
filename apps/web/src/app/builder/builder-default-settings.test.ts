import { describe, expect, it } from 'vitest';
import { createDefaultBuilderSettings } from './builder-default-settings';

describe('createDefaultBuilderSettings', () => {
  it('returns distinct nested store and setup settings for every call', () => {
    const first = createDefaultBuilderSettings();
    const second = createDefaultBuilderSettings();

    expect(first).toEqual({
      setupSettings: {
        analytics: {},
        customCode: {},
        site: {
          currency: 'USD',
          language: 'en',
          tagline: 'Premium products at affordable prices',
          timezone: 'America/New_York',
          title: 'My Store',
          units: 'imperial',
        },
        social: {},
      },
      storeSettings: expect.objectContaining({
        cart: expect.objectContaining({ enableCartDrawer: true }),
        productPage: expect.objectContaining({ layout: 'standard' }),
      }),
    });
    expect(first.storeSettings).not.toBe(second.storeSettings);
    expect(first.storeSettings.productPage).not.toBe(
      second.storeSettings.productPage
    );
    expect(first.setupSettings).not.toBe(second.setupSettings);
    expect(first.setupSettings.site).not.toBe(second.setupSettings.site);
  });
});
