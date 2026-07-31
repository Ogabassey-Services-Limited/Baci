import {
  type StorefrontDeliveryDailyEvidence,
  StorefrontDeliveryDailyEvidenceSchema,
} from './delivery-evidence';

export type StorefrontDeliveryEvidenceManifest = {
  windowStart: string;
  windowEnd: string;
  canonicalHostname: 'ogabassey.com';
  aliasHostnames: readonly string[];
  /** Hostnames from the separately canonicalized and hashed inventory artifact. */
  inventoryHostnames: readonly string[];
  hostnameInventorySha256: string;
  eligibilityPolicySha256: string;
  aliasRulesetVersion: string;
  wafRulesetVersion: string;
  workerDeploymentId: string;
  originOnlyVersionId: string;
  edgeVersionId: string;
  days: readonly StorefrontDeliveryDailyEvidence[];
};

export type StorefrontDeliveryManifestValidation =
  | { ok: true; manifest: StorefrontDeliveryEvidenceManifest }
  | { ok: false; reasonCodes: readonly string[] };

const SHA256 = /^[a-f0-9]{64}$/;
const UTC_MIDNIGHT = /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/;

function utcDates(windowStart: string): readonly string[] {
  const start = new Date(windowStart);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}

/** Validates the sealed seven-day aggregate manifest before a cost decision. */
export function validateStorefrontDeliveryManifest(
  value: unknown
): StorefrontDeliveryManifestValidation {
  if (!value || typeof value !== 'object')
    return { ok: false, reasonCodes: ['manifest_invalid'] };
  const manifest = value as StorefrontDeliveryEvidenceManifest;
  const reasonCodes: string[] = [];
  if (manifest.canonicalHostname !== 'ogabassey.com')
    reasonCodes.push('canonical_hostname_invalid');
  if (
    !UTC_MIDNIGHT.test(manifest.windowStart) ||
    !UTC_MIDNIGHT.test(manifest.windowEnd)
  )
    reasonCodes.push('window_not_closed_utc');
  const start = new Date(manifest.windowStart);
  const end = new Date(manifest.windowEnd);
  if (
    Number.isNaN(start.valueOf()) ||
    Number.isNaN(end.valueOf()) ||
    end.valueOf() - start.valueOf() !== 7 * 86_400_000
  )
    reasonCodes.push('window_not_seven_days');
  if (!Array.isArray(manifest.days) || manifest.days.length !== 7)
    reasonCodes.push('day_count_invalid');
  const expectedDays = utcDates(manifest.windowStart);
  if (manifest.days?.some((day, index) => day.utcDate !== expectedDays[index]))
    reasonCodes.push('days_not_contiguous');
  const aliases = [...(manifest.aliasHostnames ?? [])];
  if (
    !aliases.length ||
    aliases.includes(manifest.canonicalHostname) ||
    aliases.some((alias, index) => index > 0 && aliases[index - 1] >= alias) ||
    new Set(aliases).size !== aliases.length
  )
    reasonCodes.push('alias_partition_invalid');
  const inventory = [...(manifest.inventoryHostnames ?? [])];
  const expectedHosts = new Set([manifest.canonicalHostname, ...aliases]);
  if (
    inventory.length !== expectedHosts.size ||
    inventory.some((host) => !expectedHosts.has(host)) ||
    [...expectedHosts].some((host) => !inventory.includes(host))
  )
    reasonCodes.push('inventory_partition_invalid');
  if (
    ![manifest.hostnameInventorySha256, manifest.eligibilityPolicySha256].every(
      (hash) => SHA256.test(hash)
    )
  )
    reasonCodes.push('artifact_hash_invalid');
  const fingerprints = [
    'hostnameInventorySha256',
    'eligibilityPolicySha256',
    'aliasRulesetVersion',
    'wafRulesetVersion',
    'workerDeploymentId',
    'originOnlyVersionId',
    'edgeVersionId',
  ] as const;
  for (const day of manifest.days ?? []) {
    if (!StorefrontDeliveryDailyEvidenceSchema.safeParse(day).success) {
      reasonCodes.push('daily_evidence_invalid');
      break;
    }
    if (fingerprints.some((key) => day[key] !== manifest[key])) {
      reasonCodes.push('fingerprint_drift');
      break;
    }
  }
  return reasonCodes.length
    ? { ok: false, reasonCodes }
    : { ok: true, manifest };
}
