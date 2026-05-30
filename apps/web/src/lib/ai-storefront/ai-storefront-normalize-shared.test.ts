import { describe, expect, it } from 'vitest';
import {
  normalizeCtaButton,
  normalizeFeatureItems,
  normalizeLinks,
} from './ai-storefront-normalize-shared';

const fallbackLinks = [{ label: 'Fallback', url: '/fallback' }];
const fallbackFeatures = [
  {
    title: 'Fallback one',
    description: 'First fallback',
    icon: 'check' as const,
  },
  {
    title: 'Fallback two',
    description: 'Second fallback',
    icon: 'star' as const,
  },
];

describe('ai storefront normalize shared helpers', () => {
  it('returns fallback links for non-array or fully invalid inputs', () => {
    expect(normalizeLinks(null, fallbackLinks, 4)).toBe(fallbackLinks);
    expect(
      normalizeLinks(
        [{ label: 'Bad', url: 'http://bad.test' }],
        fallbackLinks,
        4
      )
    ).toBe(fallbackLinks);
  });

  it('extracts links from alternate fields and enforces max length', () => {
    expect(
      normalizeLinks(
        [
          { name: 'Catalog', href: '/products' },
          { title: 'Support', link: 'https://help.example.com' },
          { label: 'Ignored', url: '/ignored' },
        ],
        fallbackLinks,
        2
      )
    ).toEqual([
      { label: 'Catalog', url: '/products' },
      { label: 'Support', url: 'https://help.example.com' },
    ]);
  });

  it('normalizes CTA strings and records', () => {
    expect(normalizeCtaButton('Shop now')).toEqual({
      show: true,
      text: 'Shop now',
      url: '/products',
    });
    expect(
      normalizeCtaButton({ label: 'Contact us', href: '/contact' })
    ).toEqual({
      show: true,
      text: 'Contact us',
      url: '/contact',
    });
    expect(normalizeCtaButton({ label: '' })).toBeUndefined();
  });

  it('normalizes feature strings and records when at least two items survive', () => {
    expect(
      normalizeFeatureItems(
        [
          'Secure checkout',
          { title: 'Fast delivery', text: 'Tracked fulfilment', icon: 'truck' },
          { name: 'Support', subtitle: 'Real help', icon: 'not-real' },
        ],
        fallbackFeatures,
        3
      )
    ).toEqual([
      {
        title: 'Secure checkout',
        description: 'Secure checkout',
        icon: 'check',
      },
      {
        title: 'Fast delivery',
        description: 'Tracked fulfilment',
        icon: 'truck',
      },
      { title: 'Support', description: 'Real help', icon: 'check' },
    ]);
  });

  it('falls back when feature normalization yields fewer than two items', () => {
    expect(
      normalizeFeatureItems(['Only one valid item'], fallbackFeatures, 3)
    ).toBe(fallbackFeatures);
  });
});
