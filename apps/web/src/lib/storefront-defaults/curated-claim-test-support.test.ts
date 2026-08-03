import { expect, it } from 'vitest';
import { forbiddenCuratedStorefrontClaims } from './curated-claim-test-support';

it('keeps representative unsupported claims in the shared policy', () => {
  expect(forbiddenCuratedStorefrontClaims).toEqual(
    expect.arrayContaining([
      'free shipping',
      'nationwide delivery',
      'easy payments',
      'warranty',
    ])
  );
});
