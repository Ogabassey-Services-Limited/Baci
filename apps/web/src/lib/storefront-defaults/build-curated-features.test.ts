import { expect, it } from 'vitest';
import { buildCuratedCopy } from './build-curated-copy';
import { buildCuratedFeatures } from './build-curated-features';
import { forbiddenCuratedStorefrontClaims } from './curated-claim-test-support';
import { curatedProfileCases } from './curated-profile-cases.test-support';

it.each(
  curatedProfileCases
)('returns neutral nonempty feature copy for $businessType', ({
  businessType,
}) => {
  const features = buildCuratedFeatures(
    buildCuratedCopy({
      businessName: 'North Star',
      businessType,
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
  const serialized = JSON.stringify(features).toLowerCase();
  for (const claim of forbiddenCuratedStorefrontClaims)
    expect(serialized).not.toContain(claim);
});
