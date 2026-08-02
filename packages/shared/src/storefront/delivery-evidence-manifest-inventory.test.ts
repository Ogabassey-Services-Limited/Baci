import { describe, expect, it } from 'vitest';
import { calculateStorefrontDeliveryDailyEvidenceSha256 } from './delivery-evidence';
import {
  calculateHostnameInventorySha256,
  calculateStorefrontDeliveryWindowFingerprintSha256,
  validateStorefrontDeliveryManifest,
} from './delivery-evidence-manifest';
import { manifest } from './delivery-evidence-manifest.test-fixtures';

describe('StorefrontDeliveryEvidenceManifest reviewed hostname inventory', () => {
  it('rejects an extra alias even when inventory and window hashes are self-resealed', () => {
    const candidate = manifest();
    candidate.aliasHostnames = [
      'ogabassey.usebaci.com',
      'www.ogabassey.com',
      'extra.ogabassey.com',
    ];
    candidate.inventoryHostnames = [
      'ogabassey.com',
      ...candidate.aliasHostnames,
    ];
    candidate.hostnameInventorySha256 = calculateHostnameInventorySha256(
      candidate.inventoryHostnames
    );
    candidate.days = candidate.days.map((day) => ({
      ...day,
      hostnameInventorySha256: candidate.hostnameInventorySha256,
      sha256: '',
    }));
    candidate.days = candidate.days.map((day) => ({
      ...day,
      sha256: calculateStorefrontDeliveryDailyEvidenceSha256(day),
    }));
    candidate.windowFingerprintSha256 =
      calculateStorefrontDeliveryWindowFingerprintSha256(candidate);
    expect(validateStorefrontDeliveryManifest(candidate)).toMatchObject({
      ok: false,
      reasonCodes: ['manifest_invalid'],
    });
  });
});
