import { describe, expect, it } from 'vitest';
import { normalizeComponent } from './ai-storefront-normalize-component';

describe('normalizeComponent', () => {
  it.each([
    ['Header', { show_logo: false }],
    ['Hero', { title: 'Custom hero' }],
    ['Features', { title: 'Why choose us' }],
    ['ProductGrid', { columns: 4 }],
    ['TrustBadges', { layout: 'grid' }],
    ['Newsletter', { cta_button: { label: 'Join now' } }],
    ['Footer', { show_newsletter: true }],
  ] as const)('dispatches %s components to the matching normalizer', (type, props) => {
    const component = normalizeComponent('Bassey Phones', { type, props }, 1);

    expect(component).toEqual(
      expect.objectContaining({
        type,
        props: expect.objectContaining({
          id: expect.any(String),
        }),
      })
    );
  });

  it('propagates the business name through fallback hero and footer props', () => {
    const hero = normalizeComponent('Bassey Phones', { type: 'Hero' }, 0);
    const footer = normalizeComponent('Bassey Phones', { type: 'Footer' }, 0);

    expect(hero).toEqual(
      expect.objectContaining({
        type: 'Hero',
        props: expect.objectContaining({
          title: expect.stringContaining('Bassey Phones'),
        }),
      })
    );
    expect(footer).toEqual(
      expect.objectContaining({
        type: 'Footer',
        props: expect.objectContaining({
          copyrightText: expect.stringContaining('Bassey Phones'),
        }),
      })
    );
  });

  it('returns null for unknown, null, and invalid component inputs', () => {
    expect(
      normalizeComponent('Bassey Phones', { type: 'Unknown' }, 0)
    ).toBeNull();
    expect(normalizeComponent('Bassey Phones', null, 0)).toBeNull();
    expect(normalizeComponent('Bassey Phones', 'Hero', 0)).toBeNull();
  });
});
