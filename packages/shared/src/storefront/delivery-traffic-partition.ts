import { z } from 'zod';

const CountSchema = z.number().int().nonnegative();
const BoundedDimensionSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

/** Hostnames are bounded identifiers; request URLs and control characters are not valid. */
export const StorefrontDeliveryHostnameSchema = z
  .string()
  .min(1)
  .max(253)
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/
  );

/**
 * One privacy-bounded raw traffic aggregate. Dimensions are provider-owned
 * classes, never raw paths, queries, cookies, or request identifiers.
 */
export const StorefrontDeliveryTrafficPartitionRowSchema = z
  .object({
    hostname: StorefrontDeliveryHostnameSchema,
    methodClass: BoundedDimensionSchema,
    pathClass: BoundedDimensionSchema,
    ruleId: BoundedDimensionSchema,
    requestCount: CountSchema,
    eligibleRequestCount: CountSchema,
    eligibleOriginAttemptCount: CountSchema,
    rejectedMethodRequestCount: CountSchema,
  })
  .strict()
  .superRefine((row, context) => {
    if (row.eligibleRequestCount > row.requestCount)
      context.addIssue({
        code: 'custom',
        path: ['eligibleRequestCount'],
        message: 'eligible traffic cannot exceed raw traffic',
      });
    if (row.eligibleOriginAttemptCount > row.eligibleRequestCount)
      context.addIssue({
        code: 'custom',
        path: ['eligibleOriginAttemptCount'],
        message: 'eligible origin attempts cannot exceed eligible traffic',
      });
    if (row.rejectedMethodRequestCount > row.requestCount)
      context.addIssue({
        code: 'custom',
        path: ['rejectedMethodRequestCount'],
        message: 'rejected traffic cannot exceed raw traffic',
      });
    if (
      row.eligibleRequestCount + row.rejectedMethodRequestCount >
      row.requestCount
    )
      context.addIssue({
        code: 'custom',
        path: ['rejectedMethodRequestCount'],
        message: 'eligible and rejected traffic cannot overlap raw traffic',
      });
  });

export type StorefrontDeliveryTrafficPartitionRow = z.infer<
  typeof StorefrontDeliveryTrafficPartitionRowSchema
>;

type TrafficPartitionReconciliationInput = Readonly<{
  rows: readonly StorefrontDeliveryTrafficPartitionRow[];
  inventoryHostnames: readonly string[];
  canonicalHostname: string;
  canonicalRawRequestCount: number;
  aliasRawRequestCount: number;
  canonicalEligibleRequestCount: number;
  aliasEligibleRequestCount: number;
  canonicalEligibleOriginAttemptCount: number;
  aliasEligibleOriginRequestCount: number;
  rejectedMethodRequestCount: number;
}>;

const sum = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0);

/**
 * Reconciles every inventory host's raw dimensions with the daily eligibility
 * projections. Duplicate composite keys, unknown/omitted hosts, and any row
 * whose bounded counts cannot explain the daily totals fail closed.
 */
export function reconcileStorefrontDeliveryTrafficPartition({
  rows,
  inventoryHostnames,
  canonicalHostname,
  canonicalRawRequestCount,
  aliasRawRequestCount,
  canonicalEligibleRequestCount,
  aliasEligibleRequestCount,
  canonicalEligibleOriginAttemptCount,
  aliasEligibleOriginRequestCount,
  rejectedMethodRequestCount,
}: TrafficPartitionReconciliationInput) {
  const expectedHosts = new Set(inventoryHostnames);
  if (
    expectedHosts.size !== inventoryHostnames.length ||
    !expectedHosts.has(canonicalHostname) ||
    rows.length === 0
  )
    return false;

  const seenKeys = new Set<string>();
  const seenHosts = new Set<string>();
  const canonicalRows = [] as StorefrontDeliveryTrafficPartitionRow[];
  const aliasRows = [] as StorefrontDeliveryTrafficPartitionRow[];
  for (const row of rows) {
    if (!expectedHosts.has(row.hostname)) return false;
    const key = [row.hostname, row.methodClass, row.pathClass, row.ruleId].join(
      '\u0000'
    );
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    seenHosts.add(row.hostname);
    if (
      row.eligibleRequestCount > row.requestCount ||
      row.eligibleOriginAttemptCount > row.eligibleRequestCount ||
      row.rejectedMethodRequestCount > row.requestCount ||
      row.eligibleRequestCount + row.rejectedMethodRequestCount >
        row.requestCount
    )
      return false;
    if (row.hostname === canonicalHostname) canonicalRows.push(row);
    else aliasRows.push(row);
  }
  if (seenHosts.size !== expectedHosts.size) return false;
  return (
    sum(canonicalRows.map((row) => row.requestCount)) ===
      canonicalRawRequestCount &&
    sum(aliasRows.map((row) => row.requestCount)) === aliasRawRequestCount &&
    sum(canonicalRows.map((row) => row.eligibleRequestCount)) ===
      canonicalEligibleRequestCount &&
    sum(aliasRows.map((row) => row.eligibleRequestCount)) ===
      aliasEligibleRequestCount &&
    sum(canonicalRows.map((row) => row.eligibleOriginAttemptCount)) ===
      canonicalEligibleOriginAttemptCount &&
    sum(aliasRows.map((row) => row.eligibleOriginAttemptCount)) ===
      aliasEligibleOriginRequestCount &&
    sum(rows.map((row) => row.rejectedMethodRequestCount)) ===
      rejectedMethodRequestCount
  );
}
