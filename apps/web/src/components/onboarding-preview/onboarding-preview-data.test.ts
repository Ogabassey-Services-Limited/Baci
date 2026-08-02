import type { Data } from '@puckeditor/core';
import { describe, expect, it } from 'vitest';
import { buildCuratedStorefront } from '@/lib/storefront-defaults/build-curated-storefront';
import { forbiddenCuratedStorefrontClaims } from '@/lib/storefront-defaults/curated-claim-test-support';
import {
  blankCuratedProfileCase,
  curatedProfileCases,
} from '@/lib/storefront-defaults/curated-profile-cases.test-support';
import { generatePreviewTemplate } from './onboarding-preview-data';

function withoutPreviewOnlyHeaderFlag(content: Data['content']) {
  return content.map((block) => {
    if (block.type !== 'Header') return block;
    const { isPreview: _isPreview, ...props } = block.props;
    return { ...block, props };
  });
}

describe('generatePreviewTemplate', () => {
  it.each(
    curatedProfileCases
  )('matches the safe persisted scaffold and exact order for $businessType', async ({
    businessType,
    contentOrder,
  }) => {
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

    const previewHeader = preview.content.find(
      (block) => block.type === 'Header'
    );
    const persistedHeader = persisted.content.find(
      (block) => block.type === 'Header'
    );
    expect(previewHeader?.props?.isPreview).toBe(true);
    expect(persistedHeader?.props?.isPreview).toBeUndefined();
    expect(withoutPreviewOnlyHeaderFlag(preview.content)).toEqual(
      persisted.content
    );
    expect(preview.content.map((block) => block.type)).toEqual([
      'Header',
      ...contentOrder.map(
        (section) =>
          ({
            hero: 'Hero',
            story: 'Text',
            features: 'Features',
            products: 'ProductGrid',
            newsletter: 'Newsletter',
          })[section]
      ),
      'Footer',
    ]);
    expect(
      preview.content.filter(
        (block) => block.type === 'Hero' && block.props?.headingLevel === 'h1'
      )
    ).toHaveLength(1);
    const ids = preview.content.map((block) => block.props?.id);
    expect(
      ids.every((id) => typeof id === 'string' && id.trim().length > 0)
    ).toBe(true);
    expect(new Set(ids).size).toBe(preview.content.length);

    const serialized = JSON.stringify({ persisted, preview }).toLowerCase();
    expect(serialized).toContain('north star');
    for (const claim of forbiddenCuratedStorefrontClaims)
      expect(serialized).not.toContain(claim);
  });

  it('uses the neutral merchant name in blank previews', async () => {
    const preview = await generatePreviewTemplate({
      businessName: blankCuratedProfileCase.businessName,
      businessType: blankCuratedProfileCase.businessType,
      logoDataUri: null,
    });
    expect(preview.content[0]?.props?.storeName).toBe(
      blankCuratedProfileCase.expectedName
    );
  });
});
