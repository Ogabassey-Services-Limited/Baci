import { z } from 'zod';
import {
  calculateCanonicalSha256,
  calculateStorefrontDeliveryDailyEvidenceSha256,
  canonicalizeJson,
  type StorefrontDeliveryDailyEvidence,
  StorefrontDeliveryDailyEvidenceSchema,
} from './delivery-evidence';

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const ClosedUtc = z.string().regex(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
const SourceFingerprintsSchema = z
  .object({
    invocation: z.string().min(1),
    aliasRedirect: z.string().min(1),
    wafRateLimit: z.string().min(1),
    originEvent: z.string().min(1),
  })
  .strict();
const EvidenceSourceSchema = z.enum(['worker-analytics', 'worker-log']);
export const StorefrontDeliveryEvidenceManifestSchema = z
  .object({
    windowStart: ClosedUtc,
    windowEnd: ClosedUtc,
    canonicalHostname: z.literal('ogabassey.com'),
    aliasHostnames: z.array(z.string().min(1)).min(1),
    inventoryHostnames: z.array(z.string().min(1)).min(2),
    hostnameInventorySha256: Hash,
    eligibilityPolicySha256: Hash,
    aliasRulesetVersion: z.string().min(1),
    wafRulesetVersion: z.string().min(1),
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
  options: Readonly<{ now?: Date }> = {}
): StorefrontDeliveryManifestValidation {
  const parsed = StorefrontDeliveryEvidenceManifestSchema.safeParse(value);
  if (!parsed.success) return { ok: false, reasonCodes: ['manifest_invalid'] };
  const manifest = parsed.data;
  const reasons: string[] = [];
  const start = new Date(manifest.windowStart);
  const end = new Date(manifest.windowEnd);
  if (end.valueOf() - start.valueOf() !== 7 * 86_400_000)
    reasons.push('window_not_seven_days');
  const now = options.now ?? new Date();
  if (
    !Number.isFinite(now.valueOf()) ||
    end.valueOf() > startOfCurrentUtcDay(now)
  )
    reasons.push('window_not_closed');
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
    inventory.join('\n') !== expectedInventory.join('\n') ||
    manifest.hostnameInventorySha256 !==
      calculateHostnameInventorySha256(inventory)
  )
    reasons.push('inventory_partition_invalid');
  const keys = [
    'hostnameInventorySha256',
    'eligibilityPolicySha256',
    'aliasRulesetVersion',
    'wafRulesetVersion',
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
    manifest.days.some(
      (day) =>
        new Date(day.exportedAt).valueOf() <
        new Date(`${day.utcDate}T00:00:00.000Z`).valueOf() + 86_400_000
    )
  )
    reasons.push('day_exported_before_close');
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
