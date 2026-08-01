import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { dirname, isAbsolute, parse, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  type StorefrontDeliveryEvidenceManifest,
  validateStorefrontDeliveryManifest,
} from '../../../../packages/shared/src/storefront/delivery-evidence-manifest';
import { DEFAULT_ORIGIN_RATE_THRESHOLD } from './origin-rate-constants';
import { reconcileStorefrontDeliveryEvidence } from './storefront-origin-budget-reconciliation';

export type StorefrontDeliverySummary = {
  evidenceMode: 'census' | 'sampled';
  evidenceComplete: boolean;
  canonicalEligibleRequests: number;
  aliasEligibleRequests: number;
  syntheticQualificationRequests: number;
  allEligibleIngress: number;
  canonicalEligibleOriginAttempts: number;
  aliasEligibleOriginAttempts: number;
  originEventRequests: number;
  classifiedOriginAttempts: number;
  originEventReconciled: boolean;
  trafficPartitionReconciled: boolean;
  independentSourceCountsReconciled: boolean;
  dynamicOriginAttempts: number;
  aliasDynamicOriginAttempts: number;
  allowedOriginRateLimitAttempts: number;
  unaccountedOriginAttempts: number;
  allEligibleOriginAttempts: number;
  originRate: number;
  unknownOriginAttempts: number;
  rejectedMethodOriginAttempts: number;
  verdict: 'PASS' | 'FAIL' | 'NOT_PROVEN';
};
type OriginBudgetOptions = Readonly<{
  thresholdOverride?: number;
  now?: Date;
}>;
const sum = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0);
const isValidThresholdOverride = (threshold: number) =>
  Number.isFinite(threshold) && threshold >= 0 && threshold <= 1;
const assertValidThresholdOverride = (threshold: number | undefined) => {
  if (threshold !== undefined && !isValidThresholdOverride(threshold))
    throw new Error('cost gate threshold must be between 0 and 1');
};
const EMPTY_RECONCILIATION = {
  originEventRequests: 0,
  classifiedOriginAttempts: 0,
  originEventReconciled: false,
  hostPartitionReconciled: false,
  trafficPartitionReconciled: false,
  independentSourceCountsReconciled: false,
} as const;
async function assertNoSymlinkAncestors(path: string) {
  const root = parse(path).root;
  const benignSystemAliases = new Set(['/var', '/tmp']);
  let current = path;
  while (current !== root) {
    const stat = await lstat(current);
    if (stat.isSymbolicLink() && !benignSystemAliases.has(current))
      throw new Error('manifest path must not traverse a symlink');
    current = dirname(current);
  }
}
/** Produces the fail-closed all-ingress production origin-avoidance decision. */
export function summarizeStorefrontDelivery(
  value: unknown,
  options: OriginBudgetOptions = {}
): StorefrontDeliverySummary {
  assertValidThresholdOverride(options.thresholdOverride);
  const validation = validateStorefrontDeliveryManifest(value, {
    now: options.now,
  });
  const days = validation.ok ? validation.manifest.days : [];
  const reconciliation = validation.ok
    ? reconcileStorefrontDeliveryEvidence(validation.manifest)
    : EMPTY_RECONCILIATION;
  const canonicalEligibleRequests = sum(
    days.map((day) => day.canonicalEligibleRequestCount ?? 0)
  );
  const aliasEligibleRequests = sum(
    days.map((day) => day.aliasEligibleRequestCount ?? 0)
  );
  const syntheticQualificationRequests = sum(
    days.map((day) => day.syntheticQualificationRequestCount ?? 0)
  );
  const canonicalEligibleOriginAttempts = sum(
    days.map((day) => day.canonicalEligibleOriginAttemptCount ?? 0)
  );
  const aliasEligibleOriginAttempts = sum(
    days.map((day) => day.aliasEligibleOriginRequestCount ?? 0)
  );
  // Dynamic and rate-limit origins stay outside the eligible equation.
  const dynamicOriginAttempts = sum(
    days.map((day) => day.dynamicOriginAttemptCount ?? 0)
  );
  const aliasDynamicOriginAttempts = sum(
    days.map((day) => day.aliasDynamicOriginCount ?? 0)
  );
  const allowedOriginRateLimitAttempts = sum(
    days.map((day) => day.allowedOriginRateLimitCount ?? 0)
  );
  const unaccountedOriginAttempts =
    dynamicOriginAttempts +
    aliasDynamicOriginAttempts +
    allowedOriginRateLimitAttempts;
  const unknownOriginAttempts = sum(
    days.map((day) => day.unknownOriginAttemptCount ?? 0)
  );
  const rejectedMethodOriginAttempts = sum(
    days.map((day) => day.rejectedMethodOriginCount ?? 0)
  );
  const allEligibleIngress = canonicalEligibleRequests + aliasEligibleRequests;
  const allEligibleOriginAttempts =
    canonicalEligibleOriginAttempts + aliasEligibleOriginAttempts;
  const originRate =
    allEligibleIngress > 0
      ? allEligibleOriginAttempts / allEligibleIngress
      : Number.NaN;
  const evidenceComplete =
    validation.ok &&
    reconciliation.originEventReconciled &&
    reconciliation.hostPartitionReconciled &&
    reconciliation.trafficPartitionReconciled &&
    reconciliation.independentSourceCountsReconciled &&
    days.every(
      (day) =>
        day.exportComplete &&
        !day.providerSamplingApplied &&
        day.maxSampleInterval === 1 &&
        day.invocationCountExact &&
        day.totalDecisionCount === day.workerInvocationCount &&
        day.edgeReleaseCount +
          day.edgeRejectCount +
          day.terminalCount +
          day.edgeErrorCount +
          day.originFallbackCount ===
          day.totalDecisionCount &&
        day.canonicalEligibleRequestCount +
          day.syntheticQualificationRequestCount <=
          day.edgeReleaseCount + day.originFallbackCount + day.edgeErrorCount &&
        day.aliasEligibleRequestCount === day.aliasEdgeRedirectCount &&
        Object.values(day.sourceEvidence).every(
          (source) =>
            source.complete &&
            source.exact &&
            !source.providerSamplingApplied &&
            source.maxSampleInterval === 1
        )
    );
  const evidenceMode = evidenceComplete ? 'census' : 'sampled';
  const hardFailure =
    unknownOriginAttempts > 0 ||
    rejectedMethodOriginAttempts > 0 ||
    aliasEligibleOriginAttempts > 0 ||
    (evidenceComplete &&
      Number.isFinite(originRate) &&
      originRate >
        (options.thresholdOverride ?? DEFAULT_ORIGIN_RATE_THRESHOLD));
  return {
    evidenceMode,
    evidenceComplete,
    canonicalEligibleRequests,
    aliasEligibleRequests,
    syntheticQualificationRequests,
    allEligibleIngress,
    canonicalEligibleOriginAttempts,
    aliasEligibleOriginAttempts,
    originEventRequests: reconciliation.originEventRequests,
    classifiedOriginAttempts: reconciliation.classifiedOriginAttempts,
    originEventReconciled: reconciliation.originEventReconciled,
    trafficPartitionReconciled: reconciliation.trafficPartitionReconciled,
    independentSourceCountsReconciled:
      reconciliation.independentSourceCountsReconciled,
    dynamicOriginAttempts,
    aliasDynamicOriginAttempts,
    allowedOriginRateLimitAttempts,
    unaccountedOriginAttempts,
    allEligibleOriginAttempts,
    originRate,
    unknownOriginAttempts,
    rejectedMethodOriginAttempts,
    verdict: hardFailure
      ? 'FAIL'
      : evidenceComplete && allEligibleIngress > 0
        ? 'PASS'
        : 'NOT_PROVEN',
  };
}
export async function readSealedStorefrontDeliveryManifest(
  path: string,
  options: {
    environment: 'production' | 'comparison';
    thresholdOverride?: number;
    now?: Date;
  } = {
    environment: 'production',
  }
): Promise<StorefrontDeliveryEvidenceManifest> {
  if (!isAbsolute(path) || resolve(path) !== path)
    throw new Error('manifest path must be an absolute canonical path');
  if (
    options.environment === 'production' &&
    options.thresholdOverride !== undefined
  )
    throw new Error('production cost gate rejects threshold overrides');
  await assertNoSymlinkAncestors(path);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  let value: unknown;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || (stat.mode & 0o077) !== 0)
      throw new Error('sealed manifest must be a private regular file');
    value = JSON.parse(await handle.readFile('utf8'));
  } finally {
    await handle.close();
  }
  const validation = validateStorefrontDeliveryManifest(value, {
    now: options.now,
  });
  if (!validation.ok)
    throw new Error(
      `sealed manifest is invalid: ${validation.reasonCodes.join(',')}`
    );
  return validation.manifest;
}
export function parseStorefrontOriginBudgetArguments(args: readonly string[]) {
  if (args.length < 2 || args[0] !== '--manifest' || !args[1])
    throw new Error('cost gate requires --manifest <absolute-sealed-manifest>');
  const result: {
    manifestPath: string;
    environment: 'production' | 'comparison';
    thresholdOverride?: number;
  } = {
    manifestPath: args[1],
    environment: 'production',
  };
  for (let index = 2; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (!value || (option !== '--environment' && option !== '--threshold'))
      throw new Error('cost gate options are invalid');
    if (option === '--environment') {
      if (value !== 'production' && value !== 'comparison')
        throw new Error('cost gate environment is invalid');
      result.environment = value;
    } else {
      const threshold = Number(value);
      if (!isValidThresholdOverride(threshold))
        throw new Error('cost gate threshold is invalid');
      result.thresholdOverride = threshold;
    }
  }
  if (
    result.environment === 'production' &&
    result.thresholdOverride !== undefined
  )
    throw new Error('production cost gate rejects threshold overrides');
  if (
    result.environment === 'comparison' &&
    result.thresholdOverride === undefined
  )
    throw new Error('comparison cost gate requires a threshold override');
  return result;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { manifestPath, environment, thresholdOverride } =
    parseStorefrontOriginBudgetArguments(process.argv.slice(2));
  const manifest = await readSealedStorefrontDeliveryManifest(manifestPath, {
    environment,
    thresholdOverride,
  });
  const summary = summarizeStorefrontDelivery(manifest, { thresholdOverride });
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (summary.verdict !== 'PASS') process.exitCode = 1;
}
