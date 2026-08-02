import { describe, expect, it } from 'vitest';
import { buildCuratedStorefront } from '@/lib/storefront-defaults/build-curated-storefront';
import { generatePreviewTemplate } from './onboarding-preview-data';

const categories = [
  [
    'fashion',
    [
      'Header',
      'Hero',
      'ProductGrid',
      'Features',
      'Text',
      'Newsletter',
      'Footer',
    ],
  ],
  [
    'food',
    [
      'Header',
      'Hero',
      'ProductGrid',
      'Text',
      'Features',
      'Newsletter',
      'Footer',
    ],
  ],
  [
    'electronics',
    [
      'Header',
      'Hero',
      'Features',
      'ProductGrid',
      'Text',
      'Newsletter',
      'Footer',
    ],
  ],
  [
    'pharmacy',
    [
      'Header',
      'Hero',
      'Text',
      'Features',
      'ProductGrid',
      'Newsletter',
      'Footer',
    ],
  ],
  [
    'unknown-type',
    [
      'Header',
      'Hero',
      'Text',
      'Features',
      'ProductGrid',
      'Newsletter',
      'Footer',
    ],
  ],
] as const;

const unsupportedClaims = [
  'nationwide delivery',
  'flexible payment',
  'trusted quality',
  'best seller',
  'expert',
  'warranty',
  'secure checkout',
  'reliable fulfillment',
  'delivery-ready',
  'first access',
  'exclusive offers',
];

describe('generatePreviewTemplate', () => {
  it.each(
    categories
  )('matches the safe persisted scaffold and exact order for %s', async (businessType, order) => {
    const preview = await generatePreviewTemplate({
      businessName: 'North Star',
      businessType,
      logoDataUri: null,
    });
    const persisted = buildCuratedStorefront({
      businessName: 'North Star',
      businessType,
      country: 'Nigeria',
      brandColors: {
        primary: '#14532d',
        background: '#fff7ed',
        accent: '#f97316',
      },
    });

    expect(preview.content).toEqual(persisted.content);
    expect(preview.content.map((block) => block.type)).toEqual(order);
    expect(
      preview.content.filter(
        (block) => block.type === 'Hero' && block.props?.headingLevel === 'h1'
      )
    ).toHaveLength(1);
    expect(new Set(preview.content.map((block) => block.props?.id)).size).toBe(
      preview.content.length
    );

    const serialized = JSON.stringify({ persisted, preview }).toLowerCase();
    expect(serialized).toContain('north star');
    for (const claim of unsupportedClaims)
      expect(serialized).not.toContain(claim);
  });
});
