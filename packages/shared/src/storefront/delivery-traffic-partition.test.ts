import { describe, expect, it } from 'vitest';
import {
  reconcileStorefrontDeliveryTrafficPartition,
  type StorefrontDeliveryTrafficPartitionRow,
  StorefrontDeliveryTrafficPartitionRowSchema,
} from './delivery-traffic-partition';

const inventoryHostnames = [
  'ogabassey.com',
  'ogabassey.usebaci.com',
  'www.ogabassey.com',
] as const;
const rows: StorefrontDeliveryTrafficPartitionRow[] = [
  {
    hostname: 'ogabassey.com',
    methodClass: 'GET_HEAD',
    pathClass: 'document',
    ruleId: 'worker-static',
    requestCount: 10,
    eligibleRequestCount: 10,
    eligibleOriginAttemptCount: 0,
  },
  {
    hostname: 'ogabassey.usebaci.com',
    methodClass: 'GET_HEAD',
    pathClass: 'document',
    ruleId: 'alias-static',
    requestCount: 2,
    eligibleRequestCount: 2,
    eligibleOriginAttemptCount: 0,
  },
  {
    hostname: 'www.ogabassey.com',
    methodClass: 'OTHER',
    pathClass: 'api',
    ruleId: 'alias-origin',
    requestCount: 1,
    eligibleRequestCount: 0,
    eligibleOriginAttemptCount: 0,
  },
];

describe('storefront delivery traffic partition', () => {
  it('reconciles complete raw rows for canonical and alias hosts', () => {
    expect(
      reconcileStorefrontDeliveryTrafficPartition({
        rows,
        inventoryHostnames,
        canonicalHostname: 'ogabassey.com',
        canonicalRawRequestCount: 10,
        aliasRawRequestCount: 3,
        canonicalEligibleRequestCount: 10,
        aliasEligibleRequestCount: 2,
        canonicalEligibleOriginAttemptCount: 0,
        aliasEligibleOriginRequestCount: 0,
      })
    ).toBe(true);
  });

  it('rejects omitted hosts, duplicate dimensions, and raw-count drift', () => {
    expect(
      reconcileStorefrontDeliveryTrafficPartition({
        rows: rows.slice(0, 2),
        inventoryHostnames,
        canonicalHostname: 'ogabassey.com',
        canonicalRawRequestCount: 10,
        aliasRawRequestCount: 3,
        canonicalEligibleRequestCount: 10,
        aliasEligibleRequestCount: 2,
        canonicalEligibleOriginAttemptCount: 0,
        aliasEligibleOriginRequestCount: 0,
      })
    ).toBe(false);
    const duplicate = [...rows, rows[0]];
    expect(
      reconcileStorefrontDeliveryTrafficPartition({
        rows: duplicate,
        inventoryHostnames,
        canonicalHostname: 'ogabassey.com',
        canonicalRawRequestCount: 20,
        aliasRawRequestCount: 3,
        canonicalEligibleRequestCount: 20,
        aliasEligibleRequestCount: 2,
        canonicalEligibleOriginAttemptCount: 0,
        aliasEligibleOriginRequestCount: 0,
      })
    ).toBe(false);
    expect(
      reconcileStorefrontDeliveryTrafficPartition({
        rows,
        inventoryHostnames,
        canonicalHostname: 'ogabassey.com',
        canonicalRawRequestCount: 9,
        aliasRawRequestCount: 3,
        canonicalEligibleRequestCount: 10,
        aliasEligibleRequestCount: 2,
        canonicalEligibleOriginAttemptCount: 0,
        aliasEligibleOriginRequestCount: 0,
      })
    ).toBe(false);
  });

  it('rejects an unbounded path class at schema parse time', () => {
    expect(
      StorefrontDeliveryTrafficPartitionRowSchema.safeParse({
        ...rows[0],
        pathClass: '/products/secret?customer=1',
      }).success
    ).toBe(false);
  });
});
