import assert from 'node:assert/strict';
import test from 'node:test';
import { readExpectedStorefrontReleaseMarker } from './storefront-release-marker.mjs';

test('normalizes the prebuilt deployment source into the expected storefront marker', () => {
  assert.equal(
    readExpectedStorefrontReleaseMarker({
      BACI_NEXT_DEPLOYMENT_ID_SOURCE:
        '28113940786_2_4ed230c08d512b42aed6824b19c2427710247cbf',
    }),
    '28113940786_2_4ed230c08d512b42ae'
  );
});

test('fails closed when the prebuilt deployment source is absent or unsafe', () => {
  assert.throws(
    () => readExpectedStorefrontReleaseMarker({}),
    /BACI_NEXT_DEPLOYMENT_ID_SOURCE must yield a safe storefront release marker/
  );
  assert.throws(
    () =>
      readExpectedStorefrontReleaseMarker({
        BACI_NEXT_DEPLOYMENT_ID_SOURCE: '///',
      }),
    /BACI_NEXT_DEPLOYMENT_ID_SOURCE must yield a safe storefront release marker/
  );
});
