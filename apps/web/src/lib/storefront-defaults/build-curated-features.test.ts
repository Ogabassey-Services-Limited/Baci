import { expect, it } from 'vitest';
import { buildCuratedCopy } from './build-curated-copy';
import { buildCuratedFeatures } from './build-curated-features';

it('returns neutral nonempty feature copy', () => {
  const features = buildCuratedFeatures(
    buildCuratedCopy({
      businessName: 'North Star',
      businessType: 'fashion',
      country: 'Nigeria',
    }).features.items
  );
  expect(features).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        title: expect.any(String),
        description: expect.any(String),
        icon: expect.any(String),
      }),
    ])
  );
  expect(JSON.stringify(features).toLowerCase()).not.toMatch(
    /delivery|trusted|quality|secure|reliable|warranty|expert|confidence/
  );
});
