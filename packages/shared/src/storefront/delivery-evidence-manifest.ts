import { z } from 'zod';
import {
  calculateCanonicalSha256,
  calculateStorefrontDeliveryDailyEvidenceSha256,
  canonicalizeJson,
  type StorefrontDeliveryDailyEvidence,
  StorefrontDeliveryDailyEvidenceSchema,
} from './delivery-evidence';
import {
  parseStrictUtcBoundary,
  STRICT_UTC_BOUNDARY_PATTERN,
  UTC_DAY_MILLISECONDS,
} from './utc-boundary';

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const KNOWN_OGABASSEY_ALIASES = [
  'ogabassey.usebaci.com',
  'www.ogabassey.com',
] as const;

const ClosedUtc = z
  .string()
  .regex(STRICT_UTC_BOUNDARY_PATTERN)
  .refine((value) => parseStrictUtcBoundary(value) !== null);
const HostnameSchema = z
  .string()
  .min(1)
  .max(253)
  .refine((hostname) => !/[\r\n]/.test(hostname), {
    message: 'hostname must not contain line breaks',
  });
const SourceFingerprintsSchema = z
  .object({
    invocation: Hash,
    aliasRedirect: Hash,
    wafRateLimit: Hash,
    originEvent: Hash,
    syntheticQualification: Hash,
  })
  .strict();
const EvidenceSourceSchema = z.enum(['worker-analytics', 'worker-log']);
const AliasHostnamesSchema = z
  .array(HostnameSchema)
  .min(KNOWN_OGABASSEY_ALIASES.length)
  .superRefine((aliases, context) => {
    for (const hostname of KNOWN_OGABASSEY_ALIASES) {
      if (!aliases.includes(hostname))
        context.addIssue({
          code: 'custom',
          message: `missing mandatory Ogabassey alias: ${hostname}`,
        });
    }
  });
const InventoryHostnamesSchema = z
  .array(HostnameSchema)
  .min(KNOWN_OGABASSEY_ALIASES.length + 1)
  .superRefine((hostnames, context) => {
    for (const hostname of ['ogabassey.com', ...KNOWN_OGABASSEY_ALIASES]) {
      if (!hostnames.includes(hostname))
        context.addIssue({
          code: 'custom',
          message: `missing mandatory Ogabassey inventory hostname: ${hostname}`,
        });
    }
  });
export const StorefrontDeliveryEvidenceManifestSchema = z
  .object({
    windowStart: ClosedUtc,
    windowEnd: ClosedUtc,
    canonicalHostname: z.literal('ogabassey.com'),
    aliasHostnames: AliasHostnamesSchema,
    inventoryHostnames: InventoryHostnamesSchema,
    hostnameInventorySha256: Hash,
    eligibilityPolicySha256: Hash,
    aliasRulesetVersion: z.string().min(1),
    wafRulesetVersion: z.string().min(1),
    responseHeaderRulesetSha256: Hash,
    rawOriginRobotsTxtSha256: Hash,
    workerDeploymentId: z.string().min(1),
    originOnlyVersionId: z.string().min(1),
    edgeVersionId: z.string().min(1),
    sourceFingerprints: SourceFingerprintsSchema,
    evidenceSource: EvidenceSourceSchema,
    windowFingerprintSha256: Hash,
    days: z.array(StorefrontDeliveryDailyEvidenceSchema).length(7),
  })
  .strict();
export type StorefrontDeliveryEvidenceManifest = z.infer<
  typeof StorefrontDeliveryEvidenceManifestSchema
>;
export type StorefrontDeliveryManifestValidation =
  | { ok: true; manifest: StorefrontDeliveryEvidenceManifest }
  | { ok: false; reasonCodes: readonly string[] };
export type StorefrontDeliveryManifestValidationOptions = Readonly<{
  now?: Date;
  maximumWindowAgeDays?: number;
}>;

export function calculateHostnameInventorySha256(hostnames: readonly string[]) {
  return calculateCanonicalSha256(canonicalizeJson([...hostnames]));
}
/** Binds the complete seven-day contract, including all independent source fingerprints. */
export function calculateStorefrontDeliveryWindowFingerprintSha256(
  value: Record<string, unknown>
) {
  const { windowFingerprintSha256: _ignored, ...canonical } = value;
  return calculateCanonicalSha256(canonicalizeJson(canonical));
}
function startOfCurrentUtcDay(now: Date) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}
function expectedDates(windowStart: string) {
  const start = new Date(windowStart);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}
function matchesDailyHash(day: StorefrontDeliveryDailyEvidence) {
  const { sha256, ...withoutHash } = day;
  return sha256 === calculateStorefrontDeliveryDailyEvidenceSha256(withoutHash);
}

/** Parses, canonicalizes, and seals the exact seven-day manifest without casts. */
export function validateStorefrontDeliveryManifest(
  value: unknown,
  options: StorefrontDeliveryManifestValidationOptions = {}
): StorefrontDeliveryManifestValidation {
  const parsed = StorefrontDeliveryEvidenceManifestSchema.safeParse(value);
  if (!parsed.success) return { ok: false, reasonCodes: ['manifest_invalid'] };
  const manifest = parsed.data;
  const reasons: string[] = [];
  const start = new Date(manifest.windowStart);
  const end = new Date(manifest.windowEnd);
  if (end.valueOf() - start.valueOf() !== 7 * UTC_DAY_MILLISECONDS)
    reasons.push('window_not_seven_days');
  const now = options.now ?? new Date();
  const maximumWindowAgeDays = options.maximumWindowAgeDays ?? 7;
  const nowMs = now.valueOf();
  const currentUtcDayStart = Number.isFinite(nowMs)
    ? startOfCurrentUtcDay(now)
    : null;
  if (currentUtcDayStart === null) reasons.push('validation_clock_invalid');
  else if (end.valueOf() > currentUtcDayStart)
    reasons.push('window_not_closed');
  if (
    !Number.isFinite(maximumWindowAgeDays) ||
    !Number.isInteger(maximumWindowAgeDays) ||
    maximumWindowAgeDays < 0
  )
    reasons.push('window_age_invalid');
  else if (
    currentUtcDayStart !== null &&
    currentUtcDayStart - end.valueOf() >
      maximumWindowAgeDays * UTC_DAY_MILLISECONDS
  )
    reasons.push('window_stale');
  if (
    manifest.days.some(
      (day, index) => day.utcDate !== expectedDates(manifest.windowStart)[index]
    )
  )
    reasons.push('days_not_contiguous');
  const aliases = manifest.aliasHostnames;
  if (
    new Set(aliases).size !== aliases.length ||
    aliases.includes(manifest.canonicalHostname) ||
    aliases.some((host, index) => index > 0 && aliases[index - 1] >= host)
  )
    reasons.push('alias_partition_invalid');
  const inventory = manifest.inventoryHostnames;
  const expectedInventory = [manifest.canonicalHostname, ...aliases];
  if (
    inventory.length !== expectedInventory.length ||
    inventory.some(
      (hostname, index) => hostname !== expectedInventory[index]
    ) ||
    manifest.hostnameInventorySha256 !==
      calculateHostnameInventorySha256(inventory)
  )
    reasons.push('inventory_partition_invalid');
  const keys = [
    'hostnameInventorySha256',
    'eligibilityPolicySha256',
    'aliasRulesetVersion',
    'wafRulesetVersion',
    'responseHeaderRulesetSha256',
    'rawOriginRobotsTxtSha256',
    'workerDeploymentId',
    'originOnlyVersionId',
    'edgeVersionId',
  ] as const;
  if (
    manifest.days.some((day) => keys.some((key) => day[key] !== manifest[key]))
  )
    reasons.push('fingerprint_drift');
  if (
    manifest.days.some((day) =>
      Object.entries(manifest.sourceFingerprints).some(
        ([source, fingerprint]) =>
          day.sourceEvidence[source as keyof typeof day.sourceEvidence]
            .sourceFingerprint !== fingerprint
      )
    )
  )
    reasons.push('source_fingerprint_drift');
  if (manifest.days.some((day) => day.source !== manifest.evidenceSource))
    reasons.push('evidence_source_drift');
  if (
    manifest.days.some((day) => {
      const exportedAtMs = new Date(day.exportedAt).valueOf();
      const dayStart = parseStrictUtcBoundary(`${day.utcDate}T00:00:00.000Z`);
      return (
        !Number.isFinite(exportedAtMs) ||
        dayStart === null ||
        exportedAtMs < dayStart.valueOf() + UTC_DAY_MILLISECONDS
      );
    })
  )
    reasons.push('day_exported_before_close');
  if (
    currentUtcDayStart !== null &&
    manifest.days.some((day) => {
      const exportedAtMs = new Date(day.exportedAt).valueOf();
      return !Number.isFinite(exportedAtMs) || exportedAtMs > nowMs;
    })
  )
    reasons.push('day_exported_in_future');
  if (
    manifest.windowFingerprintSha256 !==
    calculateStorefrontDeliveryWindowFingerprintSha256(manifest)
  )
    reasons.push('window_fingerprint_invalid');
  if (manifest.days.some((day) => !matchesDailyHash(day)))
    reasons.push('daily_hash_invalid');
  return reasons.length
    ? { ok: false, reasonCodes: reasons }
    : { ok: true, manifest };
}
