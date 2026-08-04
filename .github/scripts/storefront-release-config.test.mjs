import assert from 'node:assert/strict';
import test from 'node:test';
import { readReleaseConfig } from './storefront-release-config.mjs';

test('binds release coherence to the normalized prebuilt deployment marker', () => {
  const config = readReleaseConfig({
    BACI_NEXT_DEPLOYMENT_ID_SOURCE:
      '28113940786_2_4ed230c08d512b42aed6824b19c2427710247cbf',
    CLOUDFLARE_API_TOKEN: 'token',
    CLOUDFLARE_ZONE_ID: 'zone-123',
  });

  assert.equal(config.expectedMarker, '28113940786_2_4ed230c08d512b42ae');
});
