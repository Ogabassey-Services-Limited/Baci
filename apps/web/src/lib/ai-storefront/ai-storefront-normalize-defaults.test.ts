import { describe, expect, it } from 'vitest';
import {
  defaultFeatureItems,
  defaultFooter,
  defaultHeader,
  defaultHero,
  defaultLinks,
  defaultProductGrid,
  defaultTrustBadges,
} from './ai-storefront-normalize-defaults';

describe('ai storefront normalize defaults', () => {
  it('returns non-empty default navigation links', () => {
    expect(defaultLinks()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: expect.any(String),
          url: expect.any(String),
        }),
      ])
    );
  });

  it('returns feature and trust items with required fields', () => {
    for (const item of [...defaultFeatureItems(), ...defaultTrustBadges()]) {
      expect(item).toEqual(
        expect.objectContaining({
          title: expect.any(String),
          description: expect.any(String),
          icon: expect.any(String),
        })
      );
    }
  });

  it('builds a header with navigation and boolean flags', () => {
    const header = defaultHeader();

    expect(header.type).toBe('Header');
    expect(header.props.navigationLinks).toEqual(defaultLinks());
    expect(header.props.showLogo).toBe(true);
    expect(header.props.showSearch).toBe(true);
    expect(header.props.showCart).toBe(true);
    expect(header.props.showMenu).toBe(true);
  });

  it('builds a hero for the business name', () => {
    const hero = defaultHero('Bassey Phones');

    expect(hero.type).toBe('Hero');
    expect(hero.props.title).toContain('Bassey Phones');
    expect(hero.props.ctaLink).toBe('/products');
  });

  it('builds a product grid with required rendering props', () => {
    const productGrid = defaultProductGrid();

    expect(productGrid.type).toBe('ProductGrid');
    expect(productGrid.props).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        columns: expect.any(Number),
        limit: expect.any(Number),
        sortBy: expect.any(String),
      })
    );
  });

  it('builds a footer for the business name', () => {
    const footer = defaultFooter('Bassey Phones');

    expect(footer.type).toBe('Footer');
    expect(footer.props.copyrightText).toContain('Bassey Phones');
    expect(footer.props.quickLinks?.length).toBeGreaterThan(0);
  });
});
