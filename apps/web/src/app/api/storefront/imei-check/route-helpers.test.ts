import { describe, expect, it } from 'vitest';
import type { ImeiLookupRow } from './route-helpers';
import {
  isValidImeiChecksum,
  mapExistingLookup,
  mapExistingTerminalLookupWithoutImeiHash,
} from './route-helpers';

const pendingRow = {
  amount_ngn: 1500,
  cached_response: null,
  cached_status: null,
  customer_id: 'customer-1',
  device_category: 'smartphone',
  id: 'lookup-1',
  imei_hash: 'hash-1',
  merchant_id: 'merchant-1',
  status: 'pending_provider',
  tier: 'blacklist',
} satisfies ImeiLookupRow;

describe('isValidImeiChecksum', () => {
  it('rejects empty, short, and non-numeric IMEI values before checksum math', () => {
    expect(isValidImeiChecksum('')).toBe(false);
    expect(isValidImeiChecksum('49015420323751')).toBe(false);
    expect(isValidImeiChecksum('49015420323751x')).toBe(false);
  });

  it('validates 15-digit IMEI checksums', () => {
    expect(isValidImeiChecksum('490154203237518')).toBe(true);
    expect(isValidImeiChecksum('123456789012345')).toBe(false);
  });
});

describe('mapExistingLookup', () => {
  it.each([
    'provider_submitting',
    'pending_provider',
    'submission_unknown',
  ] as const)('replays %s as the same pending lookup', async (status) => {
    const response = mapExistingLookup(
      { ...pendingRow, status },
      {
        customerId: 'customer-1',
        deviceCategory: 'smartphone',
        imeiHash: 'hash-1',
        merchantId: 'merchant-1',
        tier: 'blacklist',
      }
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      lookupId: 'lookup-1',
      pollAfterMs: 2000,
      status: 'pending',
      success: true,
    });
  });

  it('rejects reuse with a different device category', async () => {
    const response = mapExistingLookup(pendingRow, {
      customerId: 'customer-1',
      deviceCategory: 'tablet',
      imeiHash: 'hash-1',
      merchantId: 'merchant-1',
      tier: 'blacklist',
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
  });
});

describe('mapExistingTerminalLookupWithoutImeiHash', () => {
  it('still replays a charged Petrock request while hash configuration is unavailable', async () => {
    const response = mapExistingTerminalLookupWithoutImeiHash(pendingRow, {
      customerId: 'customer-1',
      merchantId: 'merchant-1',
      tier: 'blacklist',
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      lookupId: 'lookup-1',
      status: 'pending',
      success: true,
    });
  });
});
