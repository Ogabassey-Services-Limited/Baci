import { describe, expect, it } from 'vitest';
import { buildCuratedStorefront } from './build-curated-storefront';
import {
  blankCuratedProfileCase,
  curatedProfileCases,
} from './curated-profile-cases.test-support';

describe('buildCuratedStorefront', () => {
  it('builds a provider-independent single-H1 hero for a normalized fashion store', () => {
    const input = Object.freeze({
      businessName: 'Threaded',
      businessType: 'fashion-apparel',
      country: 'Nigeria',
      brandColors: {
        primary: '#14532d',
        background: '#fff7ed',
        accent: '#f97316',
      },
      logoUrl: 'https://cdn.example.com/threaded-logo.png',
    });

    const storefront = buildCuratedStorefront(input);
    const hero = storefront.content.find((block) => block.type === 'Hero');

    expect(storefront.content.map((block) => block.type)).toEqual([
      'Header',
      'Hero',
      'ProductGrid',
      'Features',
      'Text',
      'Newsletter',
      'Footer',
    ]);
    expect(hero?.props).toMatchObject({
      id: 'Hero-home',
      headingLevel: 'h1',
      ctaText: 'Explore products',
      ctaLink: '#products',
    });
    expect(hero?.props?.backgroundImage).toBeUndefined();
    expect(hero?.props?.backgroundGradient).toContain('linear-gradient');
    expect(
      storefront.content.filter((block) => block.type === 'HeroCarousel')
    ).toHaveLength(0);
    expect(input).toEqual({
      businessName: 'Threaded',
      businessType: 'fashion-apparel',
      country: 'Nigeria',
      brandColors: {
        primary: '#14532d',
        background: '#fff7ed',
        accent: '#f97316',
      },
      logoUrl: 'https://cdn.example.com/threaded-logo.png',
    });
  });
});

it.each(
  curatedProfileCases
)('is repeatable and structurally complete for $businessType', ({
  businessType,
}) => {
  const input = Object.freeze({
    businessName: 'North Star',
    businessType,
    country: 'Nigeria',
    brandColors: Object.freeze({
      primary: '#14532d',
      background: '#fff7ed',
      accent: '#f97316',
    }),
  });
  const first = buildCuratedStorefront(input);
  const second = buildCuratedStorefront(input);
  expect(first).toEqual(second);
  expect(first.content.map((block) => block.type)).toContain('Hero');
  expect(first.content.filter((block) => block.type === 'Header')).toHaveLength(
    1
  );
  expect(first.content.filter((block) => block.type === 'Footer')).toHaveLength(
    1
  );
  expect(
    first.content.filter((block) => block.type === 'ProductGrid')
  ).toHaveLength(1);
  expect(
    first.content.filter(
      (block) => block.type === 'Hero' && block.props?.headingLevel === 'h1'
    )
  ).toHaveLength(1);
  expect(
    first.content
      .filter((block) => block.type !== 'Hero')
      .every((block) => block.props?.headingLevel === undefined)
  ).toBe(true);
});

it('uses a neutral merchant name for a blank profile fixture', () => {
  const storefront = buildCuratedStorefront({
    businessName: blankCuratedProfileCase.businessName,
    businessType: blankCuratedProfileCase.businessType,
    country: 'Nigeria',
    brandColors: {
      primary: '#14532d',
      background: '#fff7ed',
      accent: '#f97316',
    },
  });
  const header = storefront.content.find((block) => block.type === 'Header');
  const footer = storefront.content.find((block) => block.type === 'Footer');
  expect(header?.props?.storeName).toBe(blankCuratedProfileCase.expectedName);
  expect(footer?.props?.copyrightText).toBe(
    '© Your Store. All rights reserved.'
  );
});
