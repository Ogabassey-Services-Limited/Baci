import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { dirname, isAbsolute, parse, resolve } from 'node:path';
import {
  type StorefrontDeliveryEvidenceManifest,
  validateStorefrontDeliveryManifest,
} from '../../../../packages/shared/src/storefront/delivery-evidence-manifest';

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
  const validation = validateStorefrontDeliveryManifest(value, {
    now: options.now,
  });
  const days = validation.ok ? validation.manifest.days : [];
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
  // Origin-fallback and edge-error counts are final decision classes; the
  // independent origin-event count must not double-count those outcomes.
  const originAttemptsForDay = (day: (typeof days)[number]) =>
    day.canonicalEligibleOriginAttemptCount +
    day.dynamicOriginAttemptCount +
    day.unknownOriginAttemptCount +
    day.aliasEligibleOriginRequestCount +
    day.aliasDynamicOriginCount +
    day.rejectedMethodOriginCount +
    day.allowedOriginRateLimitCount;
  const originEventRequests = sum(
    days.map((day) => day.sourceEvidence.originEvent.requestCount)
  );
  const classifiedOriginAttempts = sum(days.map(originAttemptsForDay));
  const originEventReconciled =
    validation.ok &&
    days.every(
      (day) =>
        day.sourceEvidence.originEvent.requestCount ===
        originAttemptsForDay(day)
    );
  // Dynamic/API and rate-limit origins are outside the static eligibility
  // numerator, but they still require an explicit reconciliation. A complete
  // census must not silently pass while these origin events are unaccounted.
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
    originEventReconciled &&
    unaccountedOriginAttempts === 0 &&
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
        day.sourceEvidence.syntheticQualification.requestCount ===
          day.syntheticQualificationRequestCount &&
        day.canonicalEligibleRequestCount +
          day.aliasEligibleRequestCount +
          day.syntheticQualificationRequestCount <=
          day.totalDecisionCount &&
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
      originRate > (options.thresholdOverride ?? 0.001));
  return {
    evidenceMode,
    evidenceComplete,
    canonicalEligibleRequests,
    aliasEligibleRequests,
    syntheticQualificationRequests,
    allEligibleIngress,
    canonicalEligibleOriginAttempts,
    aliasEligibleOriginAttempts,
    originEventRequests,
    classifiedOriginAttempts,
    originEventReconciled,
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
      if (!Number.isFinite(threshold) || threshold < 0)
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
  import.meta.url === new URL(process.argv[1], 'file:').href
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
